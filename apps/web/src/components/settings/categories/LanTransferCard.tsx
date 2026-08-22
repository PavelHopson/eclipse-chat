import { FormEvent, useMemo, useState } from "react";
import { useLanTransfer } from "../../../hooks/useLanTransfer";

function bytes(value: number) {
  if (value < 1024) return `${value} Б`;
  const units = ["КБ", "МБ", "ГБ", "ТБ"];
  let size = value / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unit]}`;
}

function DeviceGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8M12 17v4M7.5 10.5h9M14 8l2.5 2.5L14 13" />
    </svg>
  );
}

export function LanTransferCard() {
  const lan = useLanTransfer();
  const [pin, setPin] = useState("");
  const percentage = useMemo(() => {
    if (!lan.progress?.totalBytes) return 0;
    return Math.min(100, Math.round((lan.progress.sentBytes / lan.progress.totalBytes) * 100));
  }, [lan.progress]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void lan.send(pin);
  };

  if (!lan.supported) {
    return (
      <section className="ec-settings-card ec-lan-card ec-settings-card--sunken">
        <div className="ec-settings-icon"><DeviceGlyph /></div>
        <div className="ec-settings-card__body">
          <strong>Jarvis · Передача рядом</strong>
          <span className="ec-settings-muted">
            Локальная передача между компьютером и телефоном доступна в Eclipse Desktop.
            В браузере доступ к файлам и локальной сети намеренно закрыт.
          </span>
        </div>
        <span className="ec-settings-status-pill">Desktop</span>
      </section>
    );
  }

  return (
    <section className="ec-settings-card ec-settings-card--stack ec-lan-card" aria-labelledby="lan-transfer-title">
      <div className="ec-lan-card__head">
        <div className="ec-settings-icon"><DeviceGlyph /></div>
        <div className="ec-settings-card__body">
          <strong id="lan-transfer-title">Jarvis · Передача рядом</strong>
          <span className="ec-settings-muted">
            Находит устройства LocalSend в вашей Wi-Fi или LAN и отправляет файлы напрямую — без облака.
          </span>
        </div>
        <span className="ec-settings-status-pill ec-settings-status-pill--ok">TLS + SHA-256</span>
      </div>

      <div className="ec-lan-card__trust" aria-label="Защита передачи">
        <span>Получатель подтверждает приём</span>
        <span>Входящие выключены</span>
        <span>Пути к файлам скрыты от чата</span>
      </div>

      <div className="ec-lan-card__step">
        <div className="ec-lan-card__step-title"><span>1</span><strong>Выберите устройство</strong></div>
        <button className="ec-btn ec-btn--secondary ec-btn--sm" type="button" onClick={() => void lan.scan()} disabled={lan.busy !== null}>
          {lan.busy === "scan" ? "Ищу…" : lan.devices.length ? "Обновить список" : "Найти рядом"}
        </button>
      </div>

      {lan.devices.length > 0 && (
        <div className="ec-lan-devices" role="list" aria-label="Устройства рядом">
          {lan.devices.map((item) => (
            <button
              type="button"
              role="listitem"
              className={`ec-lan-device${lan.device?.fingerprint === item.fingerprint ? " is-selected" : ""}`}
              key={item.fingerprint}
              onClick={() => lan.setDevice(item)}
              aria-pressed={lan.device?.fingerprint === item.fingerprint}
            >
              <span className="ec-lan-device__signal" aria-hidden />
              <span><strong>{item.alias}</strong><small>{item.model || item.deviceType}</small></span>
              <span className="ec-lan-device__secure">Защищено</span>
            </button>
          ))}
        </div>
      )}

      {lan.busy !== "scan" && lan.devices.length === 0 && (
        <p className="ec-lan-card__empty">Нажмите «Найти рядом». На другом устройстве должен быть открыт LocalSend в той же сети.</p>
      )}

      <div className="ec-lan-card__step">
        <div className="ec-lan-card__step-title"><span>2</span><strong>Добавьте файлы</strong></div>
        <button className="ec-btn ec-btn--secondary ec-btn--sm" type="button" onClick={() => void lan.pickFiles()} disabled={lan.busy !== null || !lan.device}>
          {lan.busy === "pick" ? "Открываю…" : "Выбрать файлы"}
        </button>
      </div>

      {lan.selection && (
        <div className="ec-lan-selection">
          <div>
            <strong>{lan.selection.files.length} файл(а) · {bytes(lan.selection.totalBytes)}</strong>
            <span>{lan.selection.files.slice(0, 3).map((file) => file.name).join(" · ")}{lan.selection.files.length > 3 ? ` · ещё ${lan.selection.files.length - 3}` : ""}</span>
          </div>
          <span className="ec-settings-status-pill">Готово</span>
        </div>
      )}

      <form className="ec-lan-card__send" onSubmit={submit}>
        <label>
          <span>PIN получателя <small>необязательно</small></span>
          <input className="ec-input" inputMode="numeric" autoComplete="off" maxLength={12} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} placeholder="Если включён в LocalSend" />
        </label>
        {lan.busy === "send" ? (
          <button className="ec-btn ec-btn--secondary" type="button" onClick={() => void lan.cancel()}>Отменить</button>
        ) : (
          <button className="ec-btn ec-btn--primary" type="submit" disabled={!lan.device || !lan.selection || lan.busy !== null}>
            {lan.device && lan.selection ? `Отправить на ${lan.device.alias}` : "Сначала выберите устройство и файлы"}
          </button>
        )}
      </form>

      {lan.progress && lan.busy === "send" && (
        <div className="ec-lan-progress" aria-live="polite">
          <div><span>{lan.progress.phase === "approval" ? "Жду подтверждения на устройстве" : "Передаю и проверяю"}</span><strong>{percentage}%</strong></div>
          <progress max="100" value={percentage}>{percentage}%</progress>
          <small>{bytes(lan.progress.sentBytes)} из {bytes(lan.progress.totalBytes)}</small>
        </div>
      )}

      {lan.receipt && (
        <div className="ec-lan-result ec-lan-result--ok" role="status">
          <strong>Передача завершена</strong>
          <span>{lan.receipt.filesSent} файл(а), {bytes(lan.receipt.bytesSent)} · контрольные суммы совпали.</span>
        </div>
      )}
      {lan.error && <div className="ec-lan-result ec-lan-result--error" role="alert">{lan.error}</div>}
    </section>
  );
}
