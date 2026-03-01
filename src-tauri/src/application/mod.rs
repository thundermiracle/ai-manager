mod adapter_service;
#[cfg(test)]
mod critical_paths_suite;
mod detection;
mod mcp;
mod skill;

pub use adapter_service::AdapterService;
pub use skill::repository_discovery_service::SkillRepositoryDiscoveryService;
