use serde::{Deserialize, Serialize};

use super::common::{ClientKind, ResourceKind, ResourceSourceScope};
pub use crate::domain::ResourceRecord;
use crate::infra::security::redaction::redact_sensitive_text;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ResourceViewMode {
    #[default]
    Effective,
    AllSources,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListResourcesRequest {
    #[serde(default)]
    pub client: Option<ClientKind>,
    pub resource_kind: ResourceKind,
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub project_root: Option<String>,
    #[serde(default)]
    pub view_mode: ResourceViewMode,
    #[serde(default)]
    pub scope_filter: Option<Vec<ResourceSourceScope>>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListResourcesResponse {
    pub client: Option<ClientKind>,
    pub resource_kind: ResourceKind,
    pub project_root: Option<String>,
    pub view_mode: ResourceViewMode,
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
    use serde_json::json;

    use super::{ListResourcesRequest, ListResourcesResponse, ResourceViewMode};
    use crate::domain::ResourceKind;

    #[test]
    fn list_response_redacts_warning() {
        let response = ListResourcesResponse {
            client: None,
            resource_kind: ResourceKind::Mcp,
            project_root: None,
            view_mode: ResourceViewMode::Effective,
            items: Vec::new(),
            warning: Some("api_key=abc123".to_string()),
        }
        .redact_sensitive();

        assert_eq!(response.warning, Some("api_key=[REDACTED]".to_string()));
    }

    #[test]
    fn list_request_defaults_source_aware_fields() {
        let request: ListResourcesRequest =
            serde_json::from_value(json!({ "resource_kind": "mcp" }))
                .expect("request should deserialize");

        assert_eq!(request.project_root, None);
        assert!(matches!(request.view_mode, ResourceViewMode::Effective));
        assert_eq!(request.scope_filter, None);
    }
}
