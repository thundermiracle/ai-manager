use tauri::State;

use crate::{
    application::AdapterService,
    contracts::{
        command::{CommandEnvelope, CommandError, CommandMeta},
        mutate::{MutateResourceRequest, MutateResourceResponse},
    },
    state::AppState,
};

#[tauri::command]
pub fn mutate_resource(
    state: State<'_, AppState>,
    request: MutateResourceRequest,
) -> CommandEnvelope<MutateResourceResponse> {
    let meta = CommandMeta::new(
        state.next_operation_id("mutate"),
        state.lifecycle_snapshot(),
    );

    if state.is_shutting_down() {
        return CommandEnvelope::failure(CommandError::shutting_down(), meta);
    }

    let service = AdapterService::new(state.adapter_registry());

    match service.mutate_resource(&request) {
        Ok(response) if response.accepted => CommandEnvelope::success(response, meta),
        Ok(response) => {
            CommandEnvelope::failure(CommandError::not_implemented(response.message), meta)
        }
        Err(error) => CommandEnvelope::failure(error, meta),
    }
}
