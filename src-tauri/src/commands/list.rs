use tauri::State;

use crate::{
    application::AdapterService,
    contracts::{
        command::{CommandEnvelope, CommandError, CommandMeta},
        list::{ListResourcesRequest, ListResourcesResponse},
    },
    state::AppState,
};

#[tauri::command]
pub fn list_resources(
    state: State<'_, AppState>,
    request: ListResourcesRequest,
) -> CommandEnvelope<ListResourcesResponse> {
    let meta = CommandMeta::new(state.next_operation_id("list"), state.lifecycle_snapshot());

    if state.is_shutting_down() {
        return CommandEnvelope::failure(CommandError::shutting_down(), meta);
    }

    let service = AdapterService::new(state.adapter_registry(), state.detector_registry());

    match service.list_resources(request) {
        Ok(response) => CommandEnvelope::success(response.redact_sensitive(), meta),
        Err(error) => CommandEnvelope::failure(error, meta),
    }
}
