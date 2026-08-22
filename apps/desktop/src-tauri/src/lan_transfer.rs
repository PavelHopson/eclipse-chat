//! Secure, send-only LocalSend bridge for the remote Eclipse Chat webview.
//!
//! The webview never receives or supplies filesystem paths. A native picker
//! creates a short-lived opaque selection, and the selection is consumed only
//! after a second, explicit send confirmation. Incoming transfers remain off.

use bytes::Bytes;
use futures_util::StreamExt;
use localsend::crypto::cert::fingerprint_from_cert_der;
use localsend::crypto::hash::sha256_file_content;
use localsend::discovery::{DeviceIdentity, DiscoveryConfig, DiscoveryHandle, StatefulDevice};
use localsend::http::client::{ClientError, LsHttpClientV2};
use localsend::http::dto_v2::PrepareUploadRequestDtoV2;
use localsend::http::dto_v2::RegisterDtoV2;
use localsend::model::discovery::{DeviceType, ProtocolType, PROTOCOL_VERSION_V2};
use localsend::model::transfer::{FileContent, FileDto, FileMetadata};
use localsend::multicast::{
    MulticastDevice, DEFAULT_MULTICAST_GROUP, DEFAULT_MULTICAST_GROUP_V6, DEFAULT_PORT,
};
use localsend::reqwest;
use localsend::util::interface::{local_interface_addresses, InterfaceFilter};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{oneshot, Mutex as AsyncMutex};
use tokio_stream::wrappers::ReceiverStream;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

const MAX_FILES: usize = 50;
const MAX_TOTAL_BYTES: u64 = 20 * 1024 * 1024 * 1024;
const SELECTION_TTL: Duration = Duration::from_secs(15 * 60);

#[derive(Clone)]
struct LanIdentity {
    alias: String,
    cert_pem: String,
    key_pem: String,
    fingerprint: String,
}

impl LanIdentity {
    fn load_or_generate(dir: &Path) -> Result<Self, String> {
        std::fs::create_dir_all(dir)
            .map_err(|_| "Не удалось открыть защищённое хранилище устройства".to_string())?;
        let path = dir.join("lan-identity.pem");
        match std::fs::read_to_string(&path) {
            Ok(value) => Self::from_pem(&value),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                let generated = Self::generate()?;
                let value = format!("{}{}", generated.cert_pem, generated.key_pem);
                std::fs::write(&path, value)
                    .map_err(|_| "Не удалось сохранить идентификатор устройства".to_string())?;
                Ok(generated)
            }
            Err(_) => Err("Не удалось прочитать идентификатор устройства".to_string()),
        }
    }

    fn from_pem(value: &str) -> Result<Self, String> {
        let blocks =
            pem::parse_many(value).map_err(|_| "Идентификатор устройства повреждён".to_string())?;
        let cert = blocks
            .iter()
            .find(|block| block.tag() == "CERTIFICATE")
            .ok_or_else(|| "В идентификаторе нет сертификата".to_string())?;
        let key = blocks
            .iter()
            .find(|block| block.tag().ends_with("PRIVATE KEY"))
            .ok_or_else(|| "В идентификаторе нет закрытого ключа".to_string())?;
        let key_pem = pem::encode(key);
        rcgen::KeyPair::from_pem(&key_pem)
            .map_err(|_| "Закрытый ключ устройства повреждён".to_string())?;
        Ok(Self {
            alias: device_alias(),
            cert_pem: pem::encode(cert),
            key_pem,
            fingerprint: fingerprint_from_cert_der(cert.contents()),
        })
    }

    fn generate() -> Result<Self, String> {
        let cert = localsend::crypto::cert::generate_self_signed()
            .map_err(|_| "Не удалось создать TLS-идентификатор устройства".to_string())?;
        Ok(Self {
            alias: device_alias(),
            cert_pem: cert.certificate_pem,
            key_pem: cert.private_key_pem,
            fingerprint: cert.fingerprint,
        })
    }

    fn register_dto(&self) -> RegisterDtoV2 {
        RegisterDtoV2 {
            alias: self.alias.clone(),
            version: PROTOCOL_VERSION_V2.to_string(),
            device_model: Some("Eclipse Desktop".to_string()),
            device_type: Some(DeviceType::Desktop),
            fingerprint: self.fingerprint.clone(),
            port: DEFAULT_PORT,
            protocol: ProtocolType::Https,
            download: false,
        }
    }

    fn multicast_device(&self) -> MulticastDevice {
        MulticastDevice {
            alias: self.alias.clone(),
            version: PROTOCOL_VERSION_V2.to_string(),
            device_model: Some("Eclipse Desktop".to_string()),
            device_type: Some(DeviceType::Desktop),
            fingerprint: self.fingerprint.clone(),
            port: DEFAULT_PORT,
            protocol: ProtocolType::Https,
            download: false,
        }
    }
}

fn device_alias() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(|value| format!("Eclipse · {}", value.trim()))
        .unwrap_or_else(|| "Eclipse Desktop".to_string())
}

struct DiscoveryRuntime {
    identity: Arc<LanIdentity>,
    handle: Arc<DiscoveryHandle>,
    _stop_tx: oneshot::Sender<()>,
}

struct PendingSelection {
    created_at: Instant,
    files: Vec<PathBuf>,
}

#[derive(Default)]
pub struct LanTransferState {
    runtime: AsyncMutex<Option<DiscoveryRuntime>>,
    selections: Mutex<HashMap<String, PendingSelection>>,
    active: Mutex<HashMap<String, CancellationToken>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanTransferStatus {
    supported: bool,
    protocol_version: &'static str,
    encrypted: bool,
    checksum_verification: bool,
    receiving_enabled: bool,
    max_files: usize,
    max_total_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NearbyDevice {
    fingerprint: String,
    alias: String,
    model: Option<String>,
    device_type: String,
    host: String,
    port: u16,
    secure: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickedFile {
    name: String,
    size: u64,
    media_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickedSelection {
    selection_id: String,
    files: Vec<PickedFile>,
    total_bytes: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TransferProgress {
    transfer_id: String,
    sent_bytes: u64,
    total_bytes: u64,
    phase: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferReceipt {
    transfer_id: String,
    device_alias: String,
    files_sent: usize,
    bytes_sent: u64,
    checksums_verified: bool,
}

#[tauri::command]
pub fn lan_transfer_status() -> LanTransferStatus {
    LanTransferStatus {
        supported: cfg!(desktop),
        protocol_version: PROTOCOL_VERSION_V2,
        encrypted: true,
        checksum_verification: true,
        receiving_enabled: false,
        max_files: MAX_FILES,
        max_total_bytes: MAX_TOTAL_BYTES,
    }
}

async fn runtime(
    app: &AppHandle,
    state: &LanTransferState,
) -> Result<(Arc<LanIdentity>, Arc<DiscoveryHandle>), String> {
    let mut guard = state.runtime.lock().await;
    if let Some(runtime) = guard.as_ref() {
        return Ok((runtime.identity.clone(), runtime.handle.clone()));
    }

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| "Не удалось определить каталог Eclipse Desktop".to_string())?;
    let identity = Arc::new(LanIdentity::load_or_generate(&data_dir)?);
    let (stop_tx, stop_rx) = oneshot::channel();
    let handle = Arc::new(
        localsend::discovery::start(
            DiscoveryConfig {
                group: DEFAULT_MULTICAST_GROUP,
                group_v6: Some(DEFAULT_MULTICAST_GROUP_V6),
                port: DEFAULT_PORT,
                interface_filter: InterfaceFilter::default(),
                device: identity.multicast_device(),
                identity: DeviceIdentity {
                    cert_pem: identity.cert_pem.clone(),
                    private_key_pem: identity.key_pem.clone(),
                },
                timeout: Duration::from_millis(650),
                event_tx: None,
            },
            stop_rx,
        )
        .await,
    );

    *guard = Some(DiscoveryRuntime {
        identity: identity.clone(),
        handle: handle.clone(),
        _stop_tx: stop_tx,
    });
    Ok((identity, handle))
}

#[tauri::command]
pub async fn lan_transfer_scan(
    app: AppHandle,
    state: State<'_, LanTransferState>,
) -> Result<Vec<NearbyDevice>, String> {
    let (_, handle) = runtime(&app, &state).await?;

    // First allow multicast announcements to arrive. If the LAN blocks them,
    // fall back to LocalSend's bounded /24 scan of local interfaces.
    tokio::time::sleep(Duration::from_millis(900)).await;
    if handle.devices().is_empty() {
        let interfaces = local_interface_addresses(&InterfaceFilter::default()).unwrap_or_default();
        for interface in interfaces {
            let _ = handle
                .scan_subnet(interface, DEFAULT_PORT, ProtocolType::Https)
                .await;
        }
    }

    let mut devices: Vec<_> = handle
        .devices()
        .into_iter()
        .filter_map(device_dto)
        .collect();
    devices.sort_by(|left, right| left.alias.to_lowercase().cmp(&right.alias.to_lowercase()));
    Ok(devices)
}

fn device_dto(device: StatefulDevice) -> Option<NearbyDevice> {
    let channel = device.get_best_channel()?.http()?.clone();
    if channel.protocol != ProtocolType::Https {
        return None;
    }
    Some(NearbyDevice {
        fingerprint: device.device.fingerprint,
        alias: device.device.alias,
        model: device.device.device_model,
        device_type: format!(
            "{:?}",
            device.device.device_type.unwrap_or(DeviceType::Desktop)
        )
        .to_lowercase(),
        host: channel.host,
        port: channel.port,
        secure: true,
    })
}

#[tauri::command]
pub async fn lan_transfer_pick_files(
    state: State<'_, LanTransferState>,
) -> Result<Option<PickedSelection>, String> {
    let picked = tokio::task::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Выберите файлы для локальной передачи")
            .pick_files()
    })
    .await
    .map_err(|_| "Системный выбор файлов завершился с ошибкой".to_string())?;
    let Some(paths) = picked else {
        return Ok(None);
    };
    if paths.is_empty() {
        return Ok(None);
    }
    if paths.len() > MAX_FILES {
        return Err(format!(
            "Можно выбрать не более {MAX_FILES} файлов за одну передачу"
        ));
    }

    let mut files = Vec::with_capacity(paths.len());
    let mut total_bytes = 0u64;
    for path in &paths {
        let symlink = std::fs::symlink_metadata(path)
            .map_err(|_| "Один из выбранных файлов недоступен".to_string())?;
        if symlink.file_type().is_symlink() || !symlink.is_file() {
            return Err("Папки и символические ссылки передавать нельзя".to_string());
        }
        total_bytes = total_bytes
            .checked_add(symlink.len())
            .ok_or_else(|| "Суммарный размер файлов слишком велик".to_string())?;
        if total_bytes > MAX_TOTAL_BYTES {
            return Err("Суммарный размер передачи превышает 20 ГБ".to_string());
        }
        files.push(PickedFile {
            name: safe_file_name(path),
            size: symlink.len(),
            media_type: mime_guess::from_path(path)
                .first_or_octet_stream()
                .to_string(),
        });
    }

    let selection_id = Uuid::new_v4().to_string();
    let mut selections = state
        .selections
        .lock()
        .map_err(|_| "Хранилище выбора недоступно".to_string())?;
    selections.retain(|_, selection| selection.created_at.elapsed() < SELECTION_TTL);
    selections.insert(
        selection_id.clone(),
        PendingSelection {
            created_at: Instant::now(),
            files: paths,
        },
    );
    Ok(Some(PickedSelection {
        selection_id,
        files,
        total_bytes,
    }))
}

fn safe_file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("unnamed")
        .chars()
        .filter(|ch| !ch.is_control())
        .take(180)
        .collect()
}

#[tauri::command]
pub async fn lan_transfer_send(
    app: AppHandle,
    state: State<'_, LanTransferState>,
    selection_id: String,
    transfer_id: String,
    fingerprint: String,
    pin: Option<String>,
    confirmed: bool,
) -> Result<TransferReceipt, String> {
    if !confirmed {
        return Err("Передача требует явного подтверждения".to_string());
    }
    Uuid::parse_str(&selection_id).map_err(|_| "Некорректный идентификатор выбора".to_string())?;
    Uuid::parse_str(&transfer_id).map_err(|_| "Некорректный идентификатор передачи".to_string())?;
    if fingerprint.len() < 32
        || fingerprint.len() > 128
        || !fingerprint.chars().all(|ch| ch.is_ascii_hexdigit())
    {
        return Err("Некорректный fingerprint устройства".to_string());
    }
    let normalized_pin = pin
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    if normalized_pin
        .as_ref()
        .is_some_and(|value| value.len() > 12 || !value.chars().all(|ch| ch.is_ascii_digit()))
    {
        return Err("PIN должен содержать не более 12 цифр".to_string());
    }

    let selection = state
        .selections
        .lock()
        .map_err(|_| "Хранилище выбора недоступно".to_string())?
        .remove(&selection_id)
        .ok_or_else(|| "Выбор файлов истёк. Выберите файлы заново".to_string())?;
    if selection.created_at.elapsed() >= SELECTION_TTL {
        return Err("Выбор файлов истёк. Выберите файлы заново".to_string());
    }

    let (identity, handle) = runtime(&app, &state).await?;
    let device = handle
        .device_by_fingerprint(&fingerprint)
        .ok_or_else(|| "Устройство больше не доступно. Запустите поиск снова".to_string())?;
    let channel = device
        .get_best_channel()
        .and_then(|value| value.http())
        .cloned()
        .ok_or_else(|| "У устройства нет доступного адреса".to_string())?;
    if channel.protocol != ProtocolType::Https {
        return Err("Незашифрованная передача заблокирована".to_string());
    }

    let cancel = CancellationToken::new();
    state
        .active
        .lock()
        .map_err(|_| "Контроллер передачи недоступен".to_string())?
        .insert(transfer_id.clone(), cancel.clone());
    let result = send_files(
        &app,
        &transfer_id,
        &identity,
        &device,
        &selection.files,
        normalized_pin.as_deref(),
        cancel,
    )
    .await;
    if let Ok(mut active) = state.active.lock() {
        active.remove(&transfer_id);
    }
    result
}

#[tauri::command]
pub fn lan_transfer_cancel(
    state: State<'_, LanTransferState>,
    transfer_id: String,
) -> Result<bool, String> {
    Uuid::parse_str(&transfer_id).map_err(|_| "Некорректный идентификатор передачи".to_string())?;
    let active = state
        .active
        .lock()
        .map_err(|_| "Контроллер передачи недоступен".to_string())?;
    if let Some(token) = active.get(&transfer_id) {
        token.cancel();
        Ok(true)
    } else {
        Ok(false)
    }
}

async fn send_files(
    app: &AppHandle,
    transfer_id: &str,
    identity: &LanIdentity,
    device: &StatefulDevice,
    paths: &[PathBuf],
    pin: Option<&str>,
    cancel: CancellationToken,
) -> Result<TransferReceipt, String> {
    let channel = device
        .get_best_channel()
        .and_then(|value| value.http())
        .cloned()
        .ok_or_else(|| "У устройства нет доступного адреса".to_string())?;
    let client = LsHttpClientV2::try_new(
        &identity.key_pem,
        &identity.cert_pem,
        Some(device.device.fingerprint.clone()),
        Some(Duration::from_secs(30)),
    )
    .map_err(|_| "Не удалось создать защищённое соединение".to_string())?;

    let mut files = HashMap::new();
    let mut file_paths = HashMap::new();
    let mut total_bytes = 0u64;
    for path in paths {
        let metadata =
            std::fs::metadata(path).map_err(|_| "Один из файлов стал недоступен".to_string())?;
        let id = Uuid::new_v4().to_string();
        let sha256 = sha256_file_content(FileContent::Path(path.clone()), &cancel, |_| {})
            .await
            .map_err(|error| error.to_string())?;
        total_bytes += metadata.len();
        files.insert(
            id.clone(),
            FileDto {
                id: id.clone(),
                file_name: safe_file_name(path),
                size: metadata.len(),
                file_type: mime_guess::from_path(path)
                    .first_or_octet_stream()
                    .to_string(),
                sha256: Some(sha256),
                preview: None,
                metadata: FileMetadata::from_fs_metadata(&metadata),
            },
        );
        file_paths.insert(id, path.clone());
    }
    emit_progress(app, transfer_id, 0, total_bytes, "approval");

    let prepared = client
        .prepare_upload(
            ProtocolType::Https,
            &channel.host,
            channel.port,
            None,
            PrepareUploadRequestDtoV2 {
                info: identity.register_dto(),
                files: files.clone(),
            },
            pin,
            cancel.clone(),
        )
        .await
        .map_err(client_error)?;
    let response = prepared
        .response
        .ok_or_else(|| "Получатель отклонил все файлы".to_string())?;

    let accepted_total: u64 = response
        .files
        .keys()
        .filter_map(|id| files.get(id))
        .map(|file| file.size)
        .sum();
    let sent = Arc::new(AtomicU64::new(0));
    let mut sent_files = 0usize;
    let mut sent_bytes = 0u64;
    let mut ids: Vec<_> = response.files.keys().cloned().collect();
    ids.sort_by_key(|id| {
        files
            .get(id)
            .map(|file| file.file_name.clone())
            .unwrap_or_default()
    });
    for id in ids {
        let file = files
            .get(&id)
            .ok_or_else(|| "Получатель вернул неизвестный файл".to_string())?;
        let path = file_paths
            .get(&id)
            .ok_or_else(|| "Файл передачи потерян".to_string())?
            .clone();
        let token = response
            .files
            .get(&id)
            .ok_or_else(|| "Токен файла не найден".to_string())?;
        let base = sent_bytes;
        let app_handle = app.clone();
        let progress_id = transfer_id.to_string();
        let progress_counter = sent.clone();
        let body = upload_body(FileContent::Path(path), move |current| {
            let absolute = base + current;
            progress_counter.store(absolute, Ordering::Relaxed);
            emit_progress(
                &app_handle,
                &progress_id,
                absolute,
                accepted_total,
                "upload",
            );
        });
        client
            .upload(
                ProtocolType::Https,
                &channel.host,
                channel.port,
                None,
                &response.session_id,
                &id,
                token,
                body,
                cancel.clone(),
            )
            .await
            .map_err(client_error)?;
        sent_files += 1;
        sent_bytes += file.size;
    }
    emit_progress(app, transfer_id, sent_bytes, accepted_total, "verified");
    Ok(TransferReceipt {
        transfer_id: transfer_id.to_string(),
        device_alias: device.device.alias.clone(),
        files_sent: sent_files,
        bytes_sent: sent_bytes,
        checksums_verified: true,
    })
}

fn client_error(error: ClientError) -> String {
    match error {
        ClientError::Cancelled => "Передача отменена".to_string(),
        ClientError::StatusCode(status) => match status.status {
            401 => "Получатель запросил другой PIN".to_string(),
            403 => "Получатель отклонил передачу".to_string(),
            409 => "Получатель занят другой передачей".to_string(),
            422 => "Получатель обнаружил несовпадение контрольной суммы".to_string(),
            429 => "Получатель временно ограничил новые передачи".to_string(),
            code => format!("Получатель вернул ошибку {code}"),
        },
        ClientError::Reqwest(_) => {
            "Не удалось установить защищённое соединение с устройством".to_string()
        }
        ClientError::Json(_) => "Получен некорректный ответ LocalSend".to_string(),
        ClientError::Io(_) => "Не удалось прочитать выбранный файл".to_string(),
        ClientError::Other(_) => "Ошибка защищённой передачи LocalSend".to_string(),
    }
}

fn upload_body(content: FileContent, progress: impl Fn(u64) + Send + 'static) -> reqwest::Body {
    let mut sent = 0_u64;
    let stream = ReceiverStream::new(content.into_receiver()).map(move |chunk| {
        sent += chunk.len() as u64;
        progress(sent);
        Ok::<Bytes, anyhow::Error>(chunk)
    });
    reqwest::Body::wrap_stream(stream)
}

fn emit_progress(
    app: &AppHandle,
    transfer_id: &str,
    sent_bytes: u64,
    total_bytes: u64,
    phase: &'static str,
) {
    let _ = app.emit(
        "lan-transfer-progress",
        TransferProgress {
            transfer_id: transfer_id.to_string(),
            sent_bytes,
            total_bytes,
            phase,
        },
    );
}
