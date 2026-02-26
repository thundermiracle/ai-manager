use crate::{
    contracts::{common::ResourceKind, detect::ClientDetection, mutate::MutationAction},
    domain::{
        AdapterListResult, AdapterMutationResult, CODEX_CLI_PROFILE, ClientAdapter, ClientProfile,
    },
};

use super::placeholder::{detect_placeholder, list_placeholder, mutate_placeholder};

pub struct CodexCliAdapter;

impl CodexCliAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl ClientAdapter for CodexCliAdapter {
    fn profile(&self) -> &'static ClientProfile {
        &CODEX_CLI_PROFILE
    }

    fn detect(&self, include_versions: bool) -> ClientDetection {
        detect_placeholder(self.profile(), include_versions)
    }

    fn list_resources(&self, resource_kind: ResourceKind) -> AdapterListResult {
        list_placeholder(self.profile(), resource_kind)
    }

    fn mutate_resource(&self, action: MutationAction, target_id: &str) -> AdapterMutationResult {
        mutate_placeholder(self.profile(), action, target_id)
    }
}
