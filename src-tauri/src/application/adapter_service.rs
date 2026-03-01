use std::path::Path;

use crate::{
    application::{
        detection::detection_service::DetectionService,
        mcp::{listing_service::McpListingService, mutation_service::McpMutationService},
        skill::{listing_service::SkillListingService, mutation_service::SkillMutationService},
    },
    infra::{AdapterRegistry, DetectorRegistry, MutationTestHooks, SafeFileMutator},
    interface::contracts::{
        command::CommandError,
        common::ResourceKind,
        detect::{DetectClientsRequest, DetectClientsResponse},
        list::{ListResourcesRequest, ListResourcesResponse},
        mutate::{MutateResourceRequest, MutateResourceResponse},
    },
};

pub struct AdapterService<'a> {
    adapter_registry: &'a AdapterRegistry,
    detector_registry: &'a DetectorRegistry,
}

impl<'a> AdapterService<'a> {
    pub fn new(
        adapter_registry: &'a AdapterRegistry,
        detector_registry: &'a DetectorRegistry,
    ) -> Self {
        Self {
            adapter_registry,
            detector_registry,
        }
    }

    pub fn detect_clients(&self, request: DetectClientsRequest) -> DetectClientsResponse {
        let detection_service = DetectionService::new(self.detector_registry);
        detection_service.detect_clients(&request)
    }

    pub fn list_resources(
        &self,
        request: ListResourcesRequest,
    ) -> Result<ListResourcesResponse, CommandError> {
        if matches!(request.resource_kind, ResourceKind::Mcp) {
            let mcp_listing_service = McpListingService::new(self.detector_registry);
            let result = mcp_listing_service.list(&request);

            return Ok(ListResourcesResponse {
                client: request.client,
                resource_kind: request.resource_kind,
                items: result.items,
                warning: result.warning,
            });
        }

        let Some(client) = request.client else {
            return Err(CommandError::validation(
                "client is required when listing non-MCP resources.",
            ));
        };

        let Some(adapter) = self.adapter_registry.find(client) else {
            return Err(CommandError::internal(format!(
                "No adapter registered for '{}'.",
                client.as_str()
            )));
        };
        let _adapter_probe = adapter.list_resources(request.resource_kind);

        let skill_listing_service = SkillListingService::new();
        let result = skill_listing_service.list(client, request.enabled);

        Ok(ListResourcesResponse {
            client: Some(client),
            resource_kind: request.resource_kind,
            items: result.items,
            warning: result.warning,
        })
    }

    pub fn mutate_resource(
        &self,
        request: &MutateResourceRequest,
    ) -> Result<MutateResourceResponse, CommandError> {
        let target_id = request.target_id.trim();

        if target_id.is_empty() {
            return Err(CommandError::validation(
                "target_id must not be empty for mutation commands.",
            ));
        }

        let file_mutation_payload = parse_file_mutation_payload(request.payload.as_ref())?;
        if let Some(file_mutation_payload) = file_mutation_payload {
            let target_path = Path::new(&file_mutation_payload.target_path);
            let new_content = file_mutation_payload.content.as_bytes();
            let mutator = SafeFileMutator::new();

            let outcome = if file_mutation_payload.fail_after_write {
                let hooks = MutationTestHooks {
                    fail_after_backup: false,
                    fail_after_write: true,
                };

                mutator.replace_file_with_hooks(target_path, new_content, hooks)
            } else {
                mutator.replace_file(target_path, new_content)
            }
            .map_err(|failure| {
                CommandError::internal(format!(
                    "[stage={:?}] {} (rollback_succeeded={})",
                    failure.stage, failure.message, failure.rollback_succeeded
                ))
            })?;

            let mut message = format!(
                "Applied safe mutation to '{}'.",
                file_mutation_payload.target_path
            );
            if let Some(backup_path) = outcome.backup_path {
                message.push_str(&format!(" Backup: {}.", backup_path));
            }

            return Ok(MutateResourceResponse {
                accepted: true,
                action: request.action,
                target_id: target_id.to_string(),
                message,
                source_path: Some(file_mutation_payload.target_path),
            });
        }

        if matches!(request.resource_kind, ResourceKind::Mcp) {
            let mutation_service = McpMutationService::new(self.detector_registry);
            let outcome = mutation_service.mutate(
                request.client,
                request.action,
                target_id,
                request.payload.as_ref(),
            )?;

            return Ok(MutateResourceResponse {
                accepted: true,
                action: request.action,
                target_id: target_id.to_string(),
                message: outcome.message,
                source_path: Some(outcome.source_path),
            });
        }

        if matches!(request.resource_kind, ResourceKind::Skill) {
            let mutation_service = SkillMutationService::new();
            let outcome = mutation_service.mutate(
                request.client,
                request.action,
                target_id,
                request.payload.as_ref(),
            )?;

            return Ok(MutateResourceResponse {
                accepted: true,
                action: request.action,
                target_id: target_id.to_string(),
                message: outcome.message,
                source_path: Some(outcome.source_path),
            });
        }

        let Some(adapter) = self.adapter_registry.find(request.client) else {
            return Err(CommandError::internal(format!(
                "No adapter registered for '{}'.",
                request.client.as_str()
            )));
        };

        let result = adapter.mutate_resource(request.action, target_id);

        Ok(MutateResourceResponse {
            accepted: result.accepted,
            action: request.action,
            target_id: target_id.to_string(),
            message: result.message,
            source_path: None,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct FileMutationPayload {
    target_path: String,
    content: String,
    fail_after_write: bool,
}

fn parse_file_mutation_payload(
    payload: Option<&serde_json::Value>,
) -> Result<Option<FileMutationPayload>, CommandError> {
    let Some(payload) = payload else {
        return Ok(None);
    };

    let maybe_target_path = payload
        .get("target_path")
        .and_then(serde_json::Value::as_str);
    let maybe_content = payload.get("content").and_then(serde_json::Value::as_str);
    let fail_after_write = payload
        .get("fail_after_write")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);

    if maybe_target_path.is_none() && maybe_content.is_none() {
        return Ok(None);
    }

    let Some(target_path) = maybe_target_path else {
        return Err(CommandError::validation(
            "payload.target_path must be a non-empty string when file mutation payload is provided.",
        ));
    };
    let Some(content) = maybe_content else {
        return Err(CommandError::validation(
            "payload.content must be a string when file mutation payload is provided.",
        ));
    };

    let target_path = target_path.trim();
    if target_path.is_empty() {
        return Err(CommandError::validation(
            "payload.target_path must not be empty when file mutation payload is provided.",
        ));
    }

    Ok(Some(FileMutationPayload {
        target_path: target_path.to_string(),
        content: content.to_string(),
        fail_after_write,
    }))
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::AdapterService;
    use crate::{
        infra::AdapterRegistry,
        infra::DetectorRegistry,
        interface::contracts::{
            common::{ClientKind, ResourceKind},
            detect::{DetectClientsRequest, DetectionStatus},
            list::ListResourcesRequest,
            mutate::{MutateResourceRequest, MutationAction},
        },
    };
    use serde_json::json;

    #[test]
    fn detect_clients_uses_every_registered_detector() {
        let adapter_registry = AdapterRegistry::with_default_adapters();
        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = AdapterService::new(&adapter_registry, &detector_registry);

        let response = service.detect_clients(DetectClientsRequest {
            include_versions: true,
        });

        assert_eq!(response.clients.len(), 4);
        assert!(response.clients.iter().all(|entry| entry.confidence <= 100));
        assert!(response.clients.iter().all(|entry| {
            matches!(
                entry.status,
                DetectionStatus::Detected
                    | DetectionStatus::Partial
                    | DetectionStatus::Absent
                    | DetectionStatus::Error
            )
        }));
    }

    #[test]
    fn list_resources_routes_by_requested_client() {
        let adapter_registry = AdapterRegistry::with_default_adapters();
        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = AdapterService::new(&adapter_registry, &detector_registry);

        let response = service
            .list_resources(ListResourcesRequest {
                client: Some(ClientKind::Cursor),
                resource_kind: ResourceKind::Skill,
                enabled: None,
            })
            .expect("skill list should resolve through skill listing service");

        assert_eq!(response.client, Some(ClientKind::Cursor));
        assert!(matches!(response.resource_kind, ResourceKind::Skill));
    }

    #[test]
    fn list_resources_for_skill_requires_client_filter() {
        let adapter_registry = AdapterRegistry::with_default_adapters();
        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = AdapterService::new(&adapter_registry, &detector_registry);

        let error = service
            .list_resources(ListResourcesRequest {
                client: None,
                resource_kind: ResourceKind::Skill,
                enabled: None,
            })
            .expect_err("skill listing should require a client");

        assert!(error.message.contains("client is required"));
    }

    #[test]
    fn mutate_resource_validates_target_id_before_adapter_call() {
        let adapter_registry = AdapterRegistry::with_default_adapters();
        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = AdapterService::new(&adapter_registry, &detector_registry);

        let error = service
            .mutate_resource(&MutateResourceRequest {
                client: ClientKind::ClaudeCode,
                resource_kind: ResourceKind::Mcp,
                action: MutationAction::Add,
                target_id: "  ".to_string(),
                payload: None,
            })
            .expect_err("blank target_id should fail validation");

        assert!(error.message.contains("target_id"));
    }

    #[test]
    fn mutate_resource_applies_safe_file_mutation_when_payload_matches_contract() {
        let adapter_registry = AdapterRegistry::with_default_adapters();
        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = AdapterService::new(&adapter_registry, &detector_registry);

        let temp_dir = std::env::temp_dir().join(format!(
            "ai-manager-mutate-safe-payload-{}",
            std::process::id()
        ));
        let _ = fs::create_dir_all(&temp_dir);
        let target = temp_dir.join("mcp.json");
        fs::write(&target, "{\"before\":true}").expect("should create mutation target");

        let response = service
            .mutate_resource(&MutateResourceRequest {
                client: ClientKind::Cursor,
                resource_kind: ResourceKind::Mcp,
                action: MutationAction::Add,
                target_id: "cursor-mcp".to_string(),
                payload: Some(json!({
                    "target_path": target.display().to_string(),
                    "content": "{\"before\":false}"
                })),
            })
            .expect("safe file mutation payload should succeed");

        let content = fs::read_to_string(&target).expect("should read mutated target");
        let _ = fs::remove_dir_all(&temp_dir);

        assert!(response.accepted);
        assert_eq!(content, "{\"before\":false}");
        assert!(response.message.contains("Applied safe mutation"));
    }

    #[test]
    fn mutate_resource_rolls_back_file_when_post_write_failure_is_requested() {
        let adapter_registry = AdapterRegistry::with_default_adapters();
        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = AdapterService::new(&adapter_registry, &detector_registry);

        let temp_dir = std::env::temp_dir().join(format!(
            "ai-manager-mutate-safe-rollback-{}",
            std::process::id()
        ));
        let _ = fs::create_dir_all(&temp_dir);
        let target = temp_dir.join("mcp.json");
        fs::write(&target, "{\"before\":true}").expect("should create mutation target");

        let error = service
            .mutate_resource(&MutateResourceRequest {
                client: ClientKind::Cursor,
                resource_kind: ResourceKind::Mcp,
                action: MutationAction::Add,
                target_id: "cursor-mcp".to_string(),
                payload: Some(json!({
                    "target_path": target.display().to_string(),
                    "content": "{\"before\":false}",
                    "fail_after_write": true
                })),
            })
            .expect_err("post-write failure should surface command error");

        let content = fs::read_to_string(&target).expect("should read rolled back target");
        let _ = fs::remove_dir_all(&temp_dir);

        assert!(error.message.contains("rollback_succeeded=true"));
        assert_eq!(content, "{\"before\":true}");
    }

    #[test]
    fn mutate_resource_adds_mcp_entry_with_actionable_metadata() {
        let adapter_registry = AdapterRegistry::with_default_adapters();
        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = AdapterService::new(&adapter_registry, &detector_registry);

        let temp_dir =
            std::env::temp_dir().join(format!("ai-manager-mutate-mcp-add-{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);
        let source = temp_dir.join("claude.json");
        fs::write(&source, "{}").expect("should create target config");

        let response = service
            .mutate_resource(&MutateResourceRequest {
                client: ClientKind::ClaudeCode,
                resource_kind: ResourceKind::Mcp,
                action: MutationAction::Add,
                target_id: "filesystem".to_string(),
                payload: Some(json!({
                    "source_path": source.display().to_string(),
                    "transport": { "command": "npx", "args": ["-y", "server"] },
                    "enabled": true
                })),
            })
            .expect("MCP add should succeed");

        let content = fs::read_to_string(&source).expect("should read updated target");
        let expected_source_path = source.display().to_string();
        let _ = fs::remove_dir_all(&temp_dir);

        assert!(response.accepted);
        assert!(response.message.contains("Added MCP"));
        assert_eq!(
            response.source_path.as_deref(),
            Some(expected_source_path.as_str())
        );
        assert!(content.contains("filesystem"));
    }

    #[test]
    fn mutate_resource_adds_skill_entry_with_actionable_metadata() {
        let adapter_registry = AdapterRegistry::with_default_adapters();
        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = AdapterService::new(&adapter_registry, &detector_registry);

        let temp_dir = std::env::temp_dir().join(format!(
            "ai-manager-mutate-skill-add-{}",
            std::process::id()
        ));
        let _ = fs::create_dir_all(&temp_dir);

        let response = service
            .mutate_resource(&MutateResourceRequest {
                client: ClientKind::Cursor,
                resource_kind: ResourceKind::Skill,
                action: MutationAction::Add,
                target_id: "python-refactor".to_string(),
                payload: Some(json!({
                    "skills_dir": temp_dir.display().to_string(),
                    "manifest": "# Python Refactor\n\nRefactor Python code safely.\n"
                })),
            })
            .expect("Skill add should succeed");

        let manifest_path = temp_dir.join("python-refactor").join("SKILL.md");
        let content = fs::read_to_string(&manifest_path).expect("should read skill manifest");
        let expected_source_path = manifest_path.display().to_string();
        let _ = fs::remove_dir_all(&temp_dir);

        assert!(response.accepted);
        assert!(response.message.contains("Added skill"));
        assert_eq!(
            response.source_path.as_deref(),
            Some(expected_source_path.as_str())
        );
        assert!(content.contains("Python Refactor"));
    }
}
