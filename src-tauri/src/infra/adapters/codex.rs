use crate::{
    domain::{
        AdapterListResult, AdapterMutationResult, CODEX_PROFILE, ClientAdapter, ClientProfile,
    },
    interface::contracts::{common::ResourceKind, mutate::MutationAction},
};

use super::placeholder::{list_placeholder, mutate_placeholder};

pub struct CodexAdapter;

impl CodexAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl ClientAdapter for CodexAdapter {
    fn profile(&self) -> &'static ClientProfile {
        &CODEX_PROFILE
    }

    fn list_resources(&self, resource_kind: ResourceKind) -> AdapterListResult {
        list_placeholder(self.profile(), resource_kind)
    }

    fn mutate_resource(&self, action: MutationAction, target_id: &str) -> AdapterMutationResult {
        mutate_placeholder(self.profile(), action, target_id)
    }
}
