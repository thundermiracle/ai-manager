use tauri::State;

use crate::{
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

  if let Err(validation_error) = validate_mutation_request(&request) {
    return CommandEnvelope::failure(validation_error, meta);
  }

  CommandEnvelope::failure(build_not_implemented_error(&request), meta)
}

fn validate_mutation_request(request: &MutateResourceRequest) -> Result<(), CommandError> {
  if request.target_id.trim().is_empty() {
    return Err(CommandError::validation(
      "target_id must not be empty for mutation commands.",
    ));
  }

  Ok(())
}

fn build_not_implemented_error(request: &MutateResourceRequest) -> CommandError {
  let message = format!(
    "Mutation '{}' for {} on '{}' is not implemented yet.",
    request.action.as_str(),
    request.resource_kind.as_str(),
    request.client.as_str()
  );

  CommandError::not_implemented(message)
}

#[cfg(test)]
mod tests {
  use super::{build_not_implemented_error, validate_mutation_request};
  use crate::contracts::{
    common::{ClientKind, ResourceKind},
    mutate::{MutateResourceRequest, MutationAction},
  };

  fn request_with_target(target_id: &str) -> MutateResourceRequest {
    MutateResourceRequest {
      client: ClientKind::Cursor,
      resource_kind: ResourceKind::Skill,
      action: MutationAction::Add,
      target_id: target_id.to_string(),
      payload: None,
    }
  }

  #[test]
  fn mutate_validation_rejects_blank_target() {
    assert!(validate_mutation_request(&request_with_target("   ")).is_err());
  }

  #[test]
  fn mutate_validation_accepts_non_blank_target() {
    assert!(validate_mutation_request(&request_with_target("skill.alpha")).is_ok());
  }

  #[test]
  fn mutate_not_implemented_message_contains_action_and_resource_kind() {
    let error = build_not_implemented_error(&request_with_target("skill.alpha"));

    assert!(error.message.contains("add"));
    assert!(error.message.contains("skill"));
    assert!(error.message.contains("cursor"));
  }
}
