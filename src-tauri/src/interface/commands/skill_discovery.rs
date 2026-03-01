use tauri::State;

use crate::{
    application::SkillRepositoryDiscoveryService,
    interface::contracts::{
        command::{CommandEnvelope, CommandError, CommandMeta},
        skill_discovery::{DiscoverSkillRepositoryRequest, DiscoverSkillRepositoryResponse},
    },
    interface::state::AppState,
};

#[tauri::command]
pub fn discover_skill_repository(
    state: State<'_, AppState>,
    request: DiscoverSkillRepositoryRequest,
) -> CommandEnvelope<DiscoverSkillRepositoryResponse> {
    let meta = CommandMeta::new(
        state.next_operation_id("discover_skill_repo"),
        state.lifecycle_snapshot(),
    );

    if state.is_shutting_down() {
        return CommandEnvelope::failure(CommandError::shutting_down(), meta);
    }

    let service = SkillRepositoryDiscoveryService::new();
    match service.discover(&request.github_repo_url) {
        Ok(response) => CommandEnvelope::success(response, meta),
        Err(error) => CommandEnvelope::failure(error, meta),
    }
}
