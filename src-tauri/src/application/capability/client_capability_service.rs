use crate::domain::{
    ClientKind, ClientProfile, ResourceKind, ResourceSourceScope, profile_for_client,
};

pub struct ClientCapabilityService;

impl ClientCapabilityService {
    pub fn new() -> Self {
        Self
    }

    pub fn profile(&self, client: ClientKind) -> &'static ClientProfile {
        profile_for_client(client)
    }

    pub fn source_scopes_for(
        &self,
        client: ClientKind,
        resource_kind: ResourceKind,
    ) -> &'static [ResourceSourceScope] {
        self.profile(client)
            .capabilities
            .source_scopes_for(resource_kind)
    }

    pub fn destination_scopes_for(
        &self,
        client: ClientKind,
        resource_kind: ResourceKind,
    ) -> &'static [ResourceSourceScope] {
        self.profile(client)
            .capabilities
            .destination_scopes_for(resource_kind)
    }

    pub fn supports_source(
        &self,
        client: ClientKind,
        resource_kind: ResourceKind,
        scope: ResourceSourceScope,
    ) -> bool {
        self.profile(client)
            .capabilities
            .supports_source(resource_kind, scope)
    }

    pub fn supports_destination(
        &self,
        client: ClientKind,
        resource_kind: ResourceKind,
        scope: ResourceSourceScope,
    ) -> bool {
        self.profile(client)
            .capabilities
            .supports_destination(resource_kind, scope)
    }
}

impl Default for ClientCapabilityService {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::ClientCapabilityService;
    use crate::domain::{ClientKind, ResourceKind, ResourceSourceScope};

    #[test]
    fn service_exposes_distinct_mcp_scope_support_by_client() {
        let service = ClientCapabilityService::new();

        assert!(service.supports_source(
            ClientKind::ClaudeCode,
            ResourceKind::Mcp,
            ResourceSourceScope::ProjectPrivate
        ));
        assert!(service.supports_source(
            ClientKind::Cursor,
            ResourceKind::Mcp,
            ResourceSourceScope::ProjectShared
        ));
        assert!(!service.supports_source(
            ClientKind::Codex,
            ResourceKind::Mcp,
            ResourceSourceScope::ProjectShared
        ));
    }

    #[test]
    fn service_exposes_user_only_skill_support_for_now() {
        let service = ClientCapabilityService::new();

        for client in [
            ClientKind::ClaudeCode,
            ClientKind::Codex,
            ClientKind::Cursor,
        ] {
            assert!(service.supports_destination(
                client,
                ResourceKind::Skill,
                ResourceSourceScope::User
            ));
            assert!(!service.supports_destination(
                client,
                ResourceKind::Skill,
                ResourceSourceScope::ProjectShared
            ));
        }
    }
}
