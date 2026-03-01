use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiscoverSkillRepositoryRequest {
    pub github_repo_url: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiscoveredSkillCandidate {
    pub manifest_path: String,
    pub suggested_target_id: String,
    pub summary: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiscoverSkillRepositoryResponse {
    pub normalized_repo_url: String,
    pub warning: String,
    pub items: Vec<DiscoveredSkillCandidate>,
}
