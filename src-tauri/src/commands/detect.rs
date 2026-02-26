use tauri::State;

use crate::{
    application::AdapterService,
    contracts::{
        command::{CommandEnvelope, CommandError, CommandMeta},
        detect::{DetectClientsRequest, DetectClientsResponse},
    },
    state::AppState,
};

#[tauri::command]
pub fn detect_clients(
    state: State<'_, AppState>,
    request: DetectClientsRequest,
) -> CommandEnvelope<DetectClientsResponse> {
    let meta = CommandMeta::new(
        state.next_operation_id("detect"),
        state.lifecycle_snapshot(),
    );

    if state.is_shutting_down() {
        return CommandEnvelope::failure(CommandError::shutting_down(), meta);
    }

    let service = AdapterService::new(state.adapter_registry());

    CommandEnvelope::success(service.detect_clients(request), meta)
}
