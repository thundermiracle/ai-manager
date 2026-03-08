use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::common::{ClientKind, ResourceKind};
pub use crate::domain::MutationAction;
use crate::infra::security::redaction::redact_sensitive_text;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MutateResourceRequest {
    pub client: ClientKind,
    pub resource_kind: ResourceKind,
    pub action: MutationAction,
    pub target_id: String,
    #[serde(default)]
    pub project_root: Option<String>,
    #[serde(default)]
    pub target_source_id: Option<String>,
    #[serde(default)]
    pub payload: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MutateResourceResponse {
    pub accepted: bool,
    pub action: MutationAction,
    pub target_id: String,
    pub message: String,
    pub source_path: Option<String>,
    pub target_source_id: Option<String>,
}

impl MutateResourceResponse {
    pub fn redact_sensitive(mut self) -> Self {
        self.message = redact_sensitive_text(&self.message);
        self
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{MutateResourceRequest, MutateResourceResponse, MutationAction};
    use crate::domain::{ClientKind, ResourceKind};

    #[test]
    fn mutate_response_redacts_message() {
        let response = MutateResourceResponse {
            accepted: true,
            action: MutationAction::Add,
            target_id: "demo".to_string(),
            message: "token=abc123".to_string(),
            source_path: None,
            target_source_id: None,
        }
        .redact_sensitive();

        assert_eq!(response.message, "token=[REDACTED]");
    }

    #[test]
    fn mutate_request_defaults_source_targeting_fields() {
        let request: MutateResourceRequest = serde_json::from_value(json!({
            "client": "codex",
            "resource_kind": "mcp",
            "action": "add",
            "target_id": "filesystem",
            "payload": null
        }))
        .expect("request should deserialize");

        assert_eq!(request.project_root, None);
        assert_eq!(request.target_source_id, None);
        assert!(matches!(request.client, ClientKind::Codex));
        assert!(matches!(request.resource_kind, ResourceKind::Mcp));
    }
}
