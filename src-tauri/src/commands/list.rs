use tauri::State;

use crate::{
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

  CommandEnvelope::success(build_list_placeholder_response(request), meta)
}

fn build_list_placeholder_response(request: ListResourcesRequest) -> ListResourcesResponse {
  let warning = Some(format!(
    "{} listing for '{}' is not implemented yet.",
    request.resource_kind.as_str(),
    request.client.as_str()
  ));

  ListResourcesResponse {
    client: request.client,
    resource_kind: request.resource_kind,
    items: Vec::new(),
    warning,
  }
}

#[cfg(test)]
mod tests {
  use super::build_list_placeholder_response;
  use crate::contracts::{
    common::{ClientKind, ResourceKind},
    list::ListResourcesRequest,
  };

  #[test]
  fn list_placeholder_is_stable_and_empty() {
    let response = build_list_placeholder_response(ListResourcesRequest {
      client: ClientKind::CodexCli,
      resource_kind: ResourceKind::Mcp,
    });

    assert_eq!(response.client, ClientKind::CodexCli);
    assert_eq!(response.resource_kind, ResourceKind::Mcp);
    assert!(response.items.is_empty());
    assert!(response
      .warning
      .as_deref()
      .is_some_and(|value| value.contains("not implemented")));
  }
}
