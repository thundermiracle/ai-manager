use crate::{
    contracts::{common::ResourceKind, detect::ClientDetection, mutate::MutationAction},
    domain::{
        AdapterListResult, AdapterMutationResult, CURSOR_PROFILE, ClientAdapter, ClientProfile,
    },
};

use super::placeholder::{detect_placeholder, list_placeholder, mutate_placeholder};

pub struct CursorAdapter;

impl CursorAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl ClientAdapter for CursorAdapter {
    fn profile(&self) -> &'static ClientProfile {
        &CURSOR_PROFILE
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
