use serde::{Deserialize, Serialize};

use super::common::{ClientKind, ResourceKind};
use crate::infra::security::redaction::redact_sensitive_text;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplicateResourceRequest {
    pub resource_kind: ResourceKind,
    pub source_client: ClientKind,
    pub source_target_id: String,
    pub source_source_id: String,
    #[serde(default)]
    pub source_project_root: Option<String>,
    pub destination_client: ClientKind,
    #[serde(default)]
    pub destination_target_id: Option<String>,
    #[serde(default)]
    pub destination_source_id: Option<String>,
    #[serde(default)]
    pub destination_project_root: Option<String>,
    #[serde(default)]
    pub overwrite: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReplicateResourceResponse {
    pub accepted: bool,
    pub resource_kind: ResourceKind,
    pub source_client: ClientKind,
    pub source_target_id: String,
    pub destination_client: ClientKind,
    pub destination_target_id: String,
    pub destination_source_id: String,
    pub message: String,
}

impl ReplicateResourceResponse {
    pub fn redact_sensitive(mut self) -> Self {
        self.message = redact_sensitive_text(&self.message);
        self
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{ReplicateResourceRequest, ReplicateResourceResponse};
    use crate::domain::{ClientKind, ResourceKind};

    #[test]
    fn replicate_response_redacts_message() {
        let response = ReplicateResourceResponse {
            accepted: true,
            resource_kind: ResourceKind::Mcp,
            source_client: ClientKind::ClaudeCode,
            source_target_id: "filesystem".to_string(),
            destination_client: ClientKind::Cursor,
            destination_target_id: "filesystem".to_string(),
            destination_source_id: "mcp::cursor::user::/tmp/.cursor/mcp.json::/mcpServers"
                .to_string(),
            message: "token=abc123".to_string(),
        }
        .redact_sensitive();

        assert_eq!(response.message, "token=[REDACTED]");
    }

    #[test]
    fn replicate_request_defaults_optional_fields() {
        let request: ReplicateResourceRequest = serde_json::from_value(json!({
            "resource_kind": "mcp",
            "source_client": "claude_code",
            "source_target_id": "filesystem",
            "source_source_id": "mcp::claude_code::user::/tmp/.claude.json::/mcpServers",
            "destination_client": "cursor",
        }))
        .expect("request should deserialize");

        assert_eq!(request.source_project_root, None);
        assert_eq!(request.destination_project_root, None);
        assert_eq!(request.destination_target_id, None);
        assert_eq!(request.destination_source_id, None);
        assert!(!request.overwrite);
    }
}
