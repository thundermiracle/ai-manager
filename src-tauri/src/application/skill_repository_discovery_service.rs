use crate::contracts::{
    command::CommandError,
    skill_discovery::{DiscoverSkillRepositoryResponse, DiscoveredSkillCandidate},
};

use super::skill_github_repository::scan_github_repository;

pub struct SkillRepositoryDiscoveryService;

impl SkillRepositoryDiscoveryService {
    pub fn new() -> Self {
        Self
    }

    pub fn discover(
        &self,
        github_repo_url: &str,
    ) -> Result<DiscoverSkillRepositoryResponse, CommandError> {
        let scan = scan_github_repository(github_repo_url)?;

        let items = scan
            .items
            .into_iter()
            .map(|item| DiscoveredSkillCandidate {
                manifest_path: item.manifest_path,
                suggested_target_id: item.suggested_target_id,
                summary: item.summary,
            })
            .collect();

        Ok(DiscoverSkillRepositoryResponse {
            normalized_repo_url: scan.normalized_repo_url,
            warning: "Remote repositories may contain untrusted instructions. Review the discovered SKILL.md candidates before importing.".to_string(),
            items,
        })
    }
}

impl Default for SkillRepositoryDiscoveryService {
    fn default() -> Self {
        Self::new()
    }
}
