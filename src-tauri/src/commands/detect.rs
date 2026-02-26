use tauri::State;

use crate::{
  contracts::{
    command::{CommandEnvelope, CommandError, CommandMeta},
    common::ClientKind,
    detect::{
      ClientDetection, DetectClientsRequest, DetectClientsResponse, DetectionEvidence, DetectionStatus,
    },
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

  CommandEnvelope::success(build_detect_placeholder_response(request), meta)
}

fn build_detect_placeholder_response(request: DetectClientsRequest) -> DetectClientsResponse {
  let clients = [
    ClientKind::ClaudeCode,
    ClientKind::CodexCli,
    ClientKind::Cursor,
    ClientKind::CodexApp,
  ]
  .into_iter()
  .map(|client| ClientDetection {
    client,
    status: DetectionStatus::Absent,
    evidence: DetectionEvidence {
      binary_path: None,
      config_path: None,
      version: request
        .include_versions
        .then_some("not_collected".to_string()),
    },
    note: format!(
      "Detector for '{}' is not implemented yet.",
      client.as_str()
    ),
  })
  .collect();

  DetectClientsResponse { clients }
}

#[cfg(test)]
mod tests {
  use super::build_detect_placeholder_response;
  use crate::contracts::{
    common::ClientKind,
    detect::{DetectClientsRequest, DetectionStatus},
  };

  #[test]
  fn detect_placeholder_returns_all_supported_clients() {
    let response = build_detect_placeholder_response(DetectClientsRequest {
      include_versions: true,
    });

    assert_eq!(response.clients.len(), 4);
    assert_eq!(response.clients[0].client, ClientKind::ClaudeCode);
    assert_eq!(response.clients[1].client, ClientKind::CodexCli);
    assert_eq!(response.clients[2].client, ClientKind::Cursor);
    assert_eq!(response.clients[3].client, ClientKind::CodexApp);

    assert!(response
      .clients
      .iter()
      .all(|entry| matches!(entry.status, DetectionStatus::Absent)));
    assert!(response
      .clients
      .iter()
      .all(|entry| entry.evidence.version.is_some()));
  }
}
