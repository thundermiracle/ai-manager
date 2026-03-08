mod adapter_service;
mod capability;
#[cfg(test)]
mod critical_paths_suite;
mod detection;
mod mcp;
mod project_context_resolver;
mod skill;

pub use adapter_service::AdapterService;
pub use capability::client_capability_service::ClientCapabilityService;
pub use mcp::source_catalog_service::{
    McpSourceCatalogService, McpSourceDescriptor, McpSourceStorageKind,
};
pub use skill::repository_discovery_service::SkillRepositoryDiscoveryService;
