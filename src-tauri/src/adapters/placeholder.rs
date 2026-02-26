use crate::{
    contracts::{
        common::ResourceKind,
        detect::{ClientDetection, DetectionEvidence, DetectionStatus},
        mutate::MutationAction,
    },
    domain::{AdapterListResult, AdapterMutationResult, ClientProfile},
};

pub fn detect_placeholder(
    profile: &'static ClientProfile,
    include_versions: bool,
) -> ClientDetection {
    ClientDetection {
        client: profile.kind,
        status: DetectionStatus::Absent,
        evidence: DetectionEvidence {
            binary_path: None,
            config_path: None,
            version: include_versions.then_some("not_collected".to_string()),
        },
        note: format!(
            "{} adapter scaffold is ready. Detection implementation will be added in issue #19/#20.",
            profile.display_name
        ),
    }
}

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
