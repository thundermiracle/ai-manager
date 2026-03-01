use crate::{
    interface::contracts::{common::ResourceKind, mutate::MutationAction},
    domain::{
        AdapterListResult, AdapterMutationResult, CURSOR_PROFILE, ClientAdapter, ClientProfile,
    },
};

use super::placeholder::{list_placeholder, mutate_placeholder};

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

    fn list_resources(&self, resource_kind: ResourceKind) -> AdapterListResult {
        list_placeholder(self.profile(), resource_kind)
    }

    fn mutate_resource(&self, action: MutationAction, target_id: &str) -> AdapterMutationResult {
        mutate_placeholder(self.profile(), action, target_id)
    }
}
