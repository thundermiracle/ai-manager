use crate::{
    contracts::{
        command::CommandError,
        detect::{DetectClientsRequest, DetectClientsResponse},
        list::{ListResourcesRequest, ListResourcesResponse},
        mutate::{MutateResourceRequest, MutateResourceResponse},
    },
    infra::AdapterRegistry,
};

pub struct AdapterService<'a> {
    registry: &'a AdapterRegistry,
}

impl<'a> AdapterService<'a> {
    pub fn new(registry: &'a AdapterRegistry) -> Self {
        Self { registry }
    }

    pub fn detect_clients(&self, request: DetectClientsRequest) -> DetectClientsResponse {
        let clients = self
            .registry
            .all()
            .map(|adapter| adapter.detect(request.include_versions))
            .collect();

        DetectClientsResponse { clients }
    }

    pub fn list_resources(
        &self,
        request: ListResourcesRequest,
    ) -> Result<ListResourcesResponse, CommandError> {
        let Some(adapter) = self.registry.find(request.client) else {
            return Err(CommandError::internal(format!(
                "No adapter registered for '{}'.",
                request.client.as_str()
            )));
        };

        let result = adapter.list_resources(request.resource_kind);

        Ok(ListResourcesResponse {
            client: request.client,
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

        let Some(adapter) = self.registry.find(request.client) else {
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
            detect::DetectClientsRequest,
            list::ListResourcesRequest,
            mutate::{MutateResourceRequest, MutationAction},
        },
        infra::AdapterRegistry,
    };

    #[test]
    fn detect_clients_uses_every_registered_adapter() {
        let registry = AdapterRegistry::with_default_adapters();
        let service = AdapterService::new(&registry);

        let response = service.detect_clients(DetectClientsRequest {
            include_versions: true,
        });

        assert_eq!(response.clients.len(), 4);
        assert!(
            response
                .clients
                .iter()
                .all(|entry| entry.evidence.version.is_some())
        );
    }

    #[test]
    fn list_resources_routes_by_requested_client() {
        let registry = AdapterRegistry::with_default_adapters();
        let service = AdapterService::new(&registry);

        let response = service
            .list_resources(ListResourcesRequest {
                client: ClientKind::Cursor,
                resource_kind: ResourceKind::Skill,
            })
            .expect("list should return placeholder response");

        assert_eq!(response.client, ClientKind::Cursor);
        assert!(response.items.is_empty());
        assert!(
            response
                .warning
                .as_deref()
                .is_some_and(|warning| warning.contains("cursor"))
        );
    }

    #[test]
    fn mutate_resource_validates_target_id_before_adapter_call() {
        let registry = AdapterRegistry::with_default_adapters();
        let service = AdapterService::new(&registry);

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
