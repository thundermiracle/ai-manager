use crate::{
    domain::{AdapterListResult, AdapterMutationResult, ClientProfile},
    interface::contracts::{common::ResourceKind, mutate::MutationAction},
};

pub fn list_placeholder(
    profile: &'static ClientProfile,
    resource_kind: ResourceKind,
) -> AdapterListResult {
    AdapterListResult {
        items: Vec::new(),
        warning: Some(format!(
            "{} listing for '{}' is not implemented yet.",
            resource_kind.as_str(),
            profile.key
        )),
    }
}

pub fn mutate_placeholder(
    profile: &'static ClientProfile,
    action: MutationAction,
    target_id: &str,
) -> AdapterMutationResult {
    AdapterMutationResult {
        accepted: false,
        message: format!(
            "Mutation '{}' for '{}' on '{}' is not implemented yet.",
            action.as_str(),
            target_id,
            profile.key
        ),
    }
}
