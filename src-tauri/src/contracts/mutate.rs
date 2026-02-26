use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::common::{ClientKind, ResourceKind};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MutationAction {
    Add,
    Remove,
}

impl MutationAction {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Add => "add",
            Self::Remove => "remove",
        }
    }
}

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
