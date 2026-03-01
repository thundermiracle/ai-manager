mod application;
mod commands;
mod contracts;
mod detection;
mod domain;
mod infra;
mod state;

use commands::{detect_clients, discover_skill_repository, list_resources, mutate_resource};
use state::AppState;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            detect_clients,
            discover_skill_repository,
            list_resources,
            mutate_resource
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if matches!(
                event,
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
            ) {
                let app_state: tauri::State<'_, AppState> = app_handle.state();
                app_state.mark_shutdown_requested();
            }
        });
}
