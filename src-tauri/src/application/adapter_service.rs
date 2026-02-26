use crate::{
    application::mcp_listing_service::McpListingService,
    contracts::{
        command::CommandError,
        common::ResourceKind,
        detect::{DetectClientsRequest, DetectClientsResponse},
        list::{ListResourcesRequest, ListResourcesResponse},
        mutate::{MutateResourceRequest, MutateResourceResponse},
    },
    detection::DetectorRegistry,
    infra::AdapterRegistry,
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
        let clients = self
            .detector_registry
            .all()
            .map(|detector| detector.detect(&request))
            .collect();

        DetectClientsResponse { clients }
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

        let mut result = adapter.list_resources(request.resource_kind);

        if let Some(enabled_filter) = request.enabled {
            result.items.retain(|item| item.enabled == enabled_filter);
        }

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
        })
    }
}

#[cfg(test)]
mod tests {
    use super::AdapterService;
    use crate::{
        contracts::{
            common::{ClientKind, ResourceKind},
            detect::{DetectClientsRequest, DetectionStatus},
            list::ListResourcesRequest,
            mutate::{MutateResourceRequest, MutationAction},
        },
        detection::DetectorRegistry,
        infra::AdapterRegistry,
    };

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
            .expect("list should return placeholder response");

        assert_eq!(response.client, Some(ClientKind::Cursor));
        assert!(response.items.is_empty());
        assert!(
            response
                .warning
                .as_deref()
                .is_some_and(|warning| warning.contains("cursor"))
        );
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
}
