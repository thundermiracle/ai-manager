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
    pub payload: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MutateResourceResponse {
    pub accepted: bool,
    pub action: MutationAction,
    pub target_id: String,
    pub message: String,
    pub source_path: Option<String>,
}

impl MutateResourceResponse {
    pub fn redact_sensitive(mut self) -> Self {
        self.message = redact_sensitive_text(&self.message);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::{MutateResourceResponse, MutationAction};

    #[test]
    fn mutate_response_redacts_message() {
        let response = MutateResourceResponse {
            accepted: true,
            action: MutationAction::Add,
            target_id: "demo".to_string(),
            message: "token=abc123".to_string(),
            source_path: None,
        }
        .redact_sensitive();

        assert_eq!(response.message, "token=[REDACTED]");
    }
}
