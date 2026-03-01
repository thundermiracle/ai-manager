use crate::{
    domain::{ClientAdapter, ClientKind},
    infra::adapters::{ClaudeCodeAdapter, CodexAdapter, CursorAdapter},
};

pub struct AdapterRegistry {
    adapters: Vec<Box<dyn ClientAdapter>>,
}

impl AdapterRegistry {
    pub fn with_default_adapters() -> Self {
        Self {
            adapters: vec![
                Box::new(ClaudeCodeAdapter::new()),
                Box::new(CodexAdapter::new()),
                Box::new(CursorAdapter::new()),
            ],
        }
    }

    #[cfg(test)]
    pub fn all(&self) -> impl Iterator<Item = &dyn ClientAdapter> {
        self.adapters.iter().map(std::boxed::Box::as_ref)
    }

    pub fn find(&self, client: ClientKind) -> Option<&dyn ClientAdapter> {
        self.adapters
            .iter()
            .find(|adapter| adapter.profile().kind == client)
            .map(std::boxed::Box::as_ref)
    }
}

#[cfg(test)]
mod tests {
    use super::AdapterRegistry;
    use crate::domain::ClientKind;

    #[test]
    fn default_registry_exposes_all_supported_clients_in_stable_order() {
        let registry = AdapterRegistry::with_default_adapters();

        let ordered_client_kinds: Vec<ClientKind> = registry
            .all()
            .map(|adapter| adapter.profile().kind)
            .collect();

        assert_eq!(
            ordered_client_kinds,
            vec![
                ClientKind::ClaudeCode,
                ClientKind::Codex,
                ClientKind::Cursor,
            ]
        );
    }

    #[test]
    fn registry_find_returns_adapter_for_supported_clients() {
        let registry = AdapterRegistry::with_default_adapters();

        assert!(registry.find(ClientKind::ClaudeCode).is_some());
        assert!(registry.find(ClientKind::Codex).is_some());
        assert!(registry.find(ClientKind::Cursor).is_some());
    }
}
