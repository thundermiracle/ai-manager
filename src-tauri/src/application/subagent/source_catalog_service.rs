use std::{env, path::PathBuf};

use crate::domain::{ClientKind, ResourceSourceScope};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubagentSourceDescriptor {
    pub client: ClientKind,
    pub source_id: String,
    pub source_scope: ResourceSourceScope,
    pub source_label: String,
    pub directory_path: PathBuf,
    pub project_root: Option<String>,
}

pub struct SubagentSourceCatalogService;

impl SubagentSourceCatalogService {
    pub fn new() -> Self {
        Self
    }

    pub fn list_sources(
        &self,
        client: ClientKind,
        project_root: Option<&str>,
    ) -> Vec<SubagentSourceDescriptor> {
        if client != ClientKind::ClaudeCode {
            return Vec::new();
        }

        let mut descriptors = vec![descriptor_for_scope(
            client,
            ResourceSourceScope::User,
            expand_user_path("~/.claude/agents"),
            None,
        )];

        if let Some(project_root) = project_root {
            descriptors.push(descriptor_for_scope(
                client,
                ResourceSourceScope::ProjectShared,
                PathBuf::from(project_root).join(".claude").join("agents"),
                Some(project_root.to_string()),
            ));
        }

        descriptors
    }
}

impl Default for SubagentSourceCatalogService {
    fn default() -> Self {
        Self::new()
    }
}

fn descriptor_for_scope(
    client: ClientKind,
    source_scope: ResourceSourceScope,
    directory_path: PathBuf,
    project_root: Option<String>,
) -> SubagentSourceDescriptor {
    let source_label = match source_scope {
        ResourceSourceScope::User => "Personal subagents directory",
        ResourceSourceScope::ProjectShared => "Project subagents directory",
        ResourceSourceScope::ProjectPrivate => "Project private subagents directory",
    };

    let source_id = format!(
        "subagent::{}::{}::{}",
        client.as_str(),
        source_scope.as_str(),
        directory_path.display()
    );

    SubagentSourceDescriptor {
        client,
        source_id,
        source_scope,
        source_label: source_label.to_string(),
        directory_path,
        project_root,
    }
}

fn expand_user_path(value: &str) -> PathBuf {
    if let Some(stripped) = value.strip_prefix("~/")
        && let Some(home) = env::var_os("HOME")
    {
        return PathBuf::from(home).join(stripped);
    }

    PathBuf::from(value)
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::SubagentSourceCatalogService;
    use crate::domain::{ClientKind, ResourceSourceScope};

    #[test]
    fn claude_catalog_lists_personal_and_project_sources() {
        let descriptors = SubagentSourceCatalogService::new()
            .list_sources(ClientKind::ClaudeCode, Some("/Users/test/workspace/demo"));

        assert_eq!(descriptors.len(), 2);
        assert_eq!(
            descriptors
                .iter()
                .map(|descriptor| descriptor.source_scope)
                .collect::<Vec<_>>(),
            vec![
                ResourceSourceScope::User,
                ResourceSourceScope::ProjectShared
            ]
        );
        assert_eq!(
            descriptors[1].directory_path,
            PathBuf::from("/Users/test/workspace/demo")
                .join(".claude")
                .join("agents")
        );
    }

    #[test]
    fn non_claude_clients_have_no_native_subagent_sources() {
        let descriptors =
            SubagentSourceCatalogService::new().list_sources(ClientKind::Cursor, Some("/tmp/demo"));

        assert!(descriptors.is_empty());
    }
}
