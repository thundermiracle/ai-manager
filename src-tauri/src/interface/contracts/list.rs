use serde::{Deserialize, Serialize};

use super::common::{ClientKind, ResourceKind};
pub use crate::domain::ResourceRecord;
use crate::infra::security::redaction::redact_sensitive_text;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListResourcesRequest {
    #[serde(default)]
    pub client: Option<ClientKind>,
    pub resource_kind: ResourceKind,
    #[serde(default)]
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListResourcesResponse {
    pub client: Option<ClientKind>,
    pub resource_kind: ResourceKind,
    pub items: Vec<ResourceRecord>,
    pub warning: Option<String>,
}

impl ListResourcesResponse {
    pub fn redact_sensitive(mut self) -> Self {
        self.warning = self.warning.map(|warning| redact_sensitive_text(&warning));
        self
    }
}

#[cfg(test)]
mod tests {
    use super::ListResourcesResponse;
    use crate::domain::ResourceKind;

    #[test]
    fn list_response_redacts_warning() {
        let response = ListResourcesResponse {
            client: None,
            resource_kind: ResourceKind::Mcp,
            items: Vec::new(),
            warning: Some("api_key=abc123".to_string()),
        }
        .redact_sensitive();

        assert_eq!(response.warning, Some("api_key=[REDACTED]".to_string()));
    }
}
