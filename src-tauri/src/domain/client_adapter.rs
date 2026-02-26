use crate::contracts::{common::ResourceKind, list::ResourceRecord, mutate::MutationAction};

use super::ClientProfile;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdapterListResult {
    pub items: Vec<ResourceRecord>,
    pub warning: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdapterMutationResult {
    pub accepted: bool,
    pub message: String,
}

pub trait ClientAdapter: Send + Sync {
    fn profile(&self) -> &'static ClientProfile;
    fn list_resources(&self, resource_kind: ResourceKind) -> AdapterListResult;
    fn mutate_resource(&self, action: MutationAction, target_id: &str) -> AdapterMutationResult;
}
