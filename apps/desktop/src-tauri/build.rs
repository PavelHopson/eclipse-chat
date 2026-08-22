fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "lan_transfer_status",
            "lan_transfer_scan",
            "lan_transfer_pick_files",
            "lan_transfer_send",
            "lan_transfer_cancel",
        ]),
    ))
    .expect("failed to build Tauri application manifest")
}
