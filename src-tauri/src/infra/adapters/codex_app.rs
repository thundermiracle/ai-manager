use crate::{
    interface::contracts::{common::ResourceKind, mutate::MutationAction},
    domain::{
        AdapterListResult, AdapterMutationResult, CODEX_APP_PROFILE, ClientAdapter, ClientProfile,
    },
};

use super::placeholder::{list_placeholder, mutate_placeholder};

pub struct CodexAppAdapter;

impl CodexAppAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl ClientAdapter for CodexAppAdapter {
    fn profile(&self) -> &'static ClientProfile {
        &CODEX_APP_PROFILE
    }

    fn list_resources(&self, resource_kind: ResourceKind) -> AdapterListResult {
        list_placeholder(self.profile(), resource_kind)
    }

    fn mutate_resource(&self, action: MutationAction, target_id: &str) -> AdapterMutationResult {
        mutate_placeholder(self.profile(), action, target_id)
    }
}
