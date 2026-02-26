use serde::{Deserialize, Serialize};

use super::common::{ClientKind, ResourceKind};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListResourcesRequest {
    #[serde(default)]
    pub client: Option<ClientKind>,
    pub resource_kind: ResourceKind,
    #[serde(default)]
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResourceRecord {
    pub id: String,
    pub client: ClientKind,
    pub display_name: String,
    pub enabled: bool,
    pub transport_kind: Option<String>,
    pub source_path: Option<String>,
    pub description: Option<String>,
    pub install_kind: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListResourcesResponse {
    pub client: Option<ClientKind>,
    pub resource_kind: ResourceKind,
    pub items: Vec<ResourceRecord>,
    pub warning: Option<String>,
}
