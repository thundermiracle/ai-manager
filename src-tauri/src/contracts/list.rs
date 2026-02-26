use serde::{Deserialize, Serialize};

use super::common::{ClientKind, ResourceKind};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListResourcesRequest {
    pub client: ClientKind,
    pub resource_kind: ResourceKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResourceRecord {
    pub id: String,
    pub display_name: String,
    pub enabled: bool,
    pub source_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ListResourcesResponse {
    pub client: ClientKind,
    pub resource_kind: ResourceKind,
    pub items: Vec<ResourceRecord>,
    pub warning: Option<String>,
}
