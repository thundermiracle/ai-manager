use std::path::PathBuf;

use crate::{
    domain::{ClientKind, ResourceSourceScope},
    infra::DetectorRegistry,
    interface::contracts::detect::DetectClientsRequest,
};

use super::config_path_resolver::default_mcp_config_path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum McpSourceStorageKind {
    JsonSection,
    TomlTable,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct McpSourceDescriptor {
    pub client: ClientKind,
    pub source_id: String,
    pub source_scope: ResourceSourceScope,
    pub source_label: String,
    pub container_path: PathBuf,
    pub selector: String,
    pub storage_kind: McpSourceStorageKind,
    pub project_root: Option<String>,
}

pub struct McpSourceCatalogService<'a> {
    detector_registry: &'a DetectorRegistry,
}

impl<'a> McpSourceCatalogService<'a> {
    pub fn new(detector_registry: &'a DetectorRegistry) -> Self {
        Self { detector_registry }
    }

    pub fn list_sources(
        &self,
        client: ClientKind,
        project_root: Option<&str>,
    ) -> Vec<McpSourceDescriptor> {
        let user_container_path = detected_user_container_path(self.detector_registry, client)
            .unwrap_or_else(|| default_mcp_config_path(client));

        build_source_descriptors(client, user_container_path, project_root)
    }
}

fn detected_user_container_path(
    detector_registry: &DetectorRegistry,
    client: ClientKind,
) -> Option<PathBuf> {
    let detect_request = DetectClientsRequest {
        include_versions: false,
    };

    detector_registry
        .find(client)
        .map(|detector| detector.detect(&detect_request))
        .and_then(|detection| detection.evidence.config_path.map(PathBuf::from))
}

fn build_source_descriptors(
    client: ClientKind,
    user_container_path: PathBuf,
    project_root: Option<&str>,
) -> Vec<McpSourceDescriptor> {
    let mut descriptors = vec![descriptor_for_scope(
        client,
        ResourceSourceScope::User,
        user_container_path.clone(),
        selector_for_scope(client, ResourceSourceScope::User, None),
        storage_kind_for_client(client),
        None,
    )];

    let Some(project_root) = project_root else {
        return descriptors;
    };

    match client {
        ClientKind::ClaudeCode => {
            descriptors.push(descriptor_for_scope(
                client,
                ResourceSourceScope::ProjectShared,
                PathBuf::from(project_root).join(".mcp.json"),
                selector_for_scope(
                    client,
                    ResourceSourceScope::ProjectShared,
                    Some(project_root),
                ),
                McpSourceStorageKind::JsonSection,
                Some(project_root.to_string()),
            ));
            descriptors.push(descriptor_for_scope(
                client,
                ResourceSourceScope::ProjectPrivate,
                user_container_path,
                selector_for_scope(
                    client,
                    ResourceSourceScope::ProjectPrivate,
                    Some(project_root),
                ),
                McpSourceStorageKind::JsonSection,
                Some(project_root.to_string()),
            ));
        }
        ClientKind::Cursor => {
            descriptors.push(descriptor_for_scope(
                client,
                ResourceSourceScope::ProjectShared,
                PathBuf::from(project_root).join(".cursor").join("mcp.json"),
                selector_for_scope(
                    client,
                    ResourceSourceScope::ProjectShared,
                    Some(project_root),
                ),
                McpSourceStorageKind::JsonSection,
                Some(project_root.to_string()),
            ));
        }
        ClientKind::Codex => {}
    }

    descriptors
}

pub(super) fn descriptor_for_scope(
    client: ClientKind,
    source_scope: ResourceSourceScope,
    container_path: PathBuf,
    selector: String,
    storage_kind: McpSourceStorageKind,
    project_root: Option<String>,
) -> McpSourceDescriptor {
    let source_label = match source_scope {
        ResourceSourceScope::User => "Personal config",
        ResourceSourceScope::ProjectShared => "Project config",
        ResourceSourceScope::ProjectPrivate => "Project private config",
    };

    let source_id = format!(
        "mcp::{}::{}::{}::{}",
        client.as_str(),
        source_scope.as_str(),
        container_path.display(),
        selector
    );

    McpSourceDescriptor {
        client,
        source_id,
        source_scope,
        source_label: source_label.to_string(),
        container_path,
        selector,
        storage_kind,
        project_root,
    }
}

pub(super) fn selector_for_scope(
    client: ClientKind,
    source_scope: ResourceSourceScope,
    project_root: Option<&str>,
) -> String {
    match (client, source_scope) {
        (ClientKind::Codex, ResourceSourceScope::User) => "mcp_servers".to_string(),
        (ClientKind::Codex, _) => "mcp_servers".to_string(),
        (_, ResourceSourceScope::User | ResourceSourceScope::ProjectShared) => {
            "/mcpServers".to_string()
        }
        (ClientKind::ClaudeCode, ResourceSourceScope::ProjectPrivate) => {
            let project_root = project_root.expect("Claude project private source requires root");
            format!(
                "/projects/{}/mcpServers",
                escape_json_pointer_token(project_root)
            )
        }
        (_, ResourceSourceScope::ProjectPrivate) => "/mcpServers".to_string(),
    }
}

pub(super) fn storage_kind_for_client(client: ClientKind) -> McpSourceStorageKind {
    match client {
        ClientKind::Codex => McpSourceStorageKind::TomlTable,
        ClientKind::ClaudeCode | ClientKind::Cursor => McpSourceStorageKind::JsonSection,
    }
}

fn escape_json_pointer_token(value: &str) -> String {
    value.replace('~', "~0").replace('/', "~1")
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{McpSourceStorageKind, build_source_descriptors};
    use crate::domain::{ClientKind, ResourceSourceScope};

    #[test]
    fn claude_catalog_includes_project_shared_and_private_descriptors() {
        let user_path = PathBuf::from("/Users/test/.claude.json");
        let project_root = "/Users/test/workspace/demo";

        let descriptors = build_source_descriptors(
            ClientKind::ClaudeCode,
            user_path.clone(),
            Some(project_root),
        );

        assert_eq!(descriptors.len(), 3);
        assert_eq!(
            descriptors
                .iter()
                .map(|descriptor| descriptor.source_scope)
                .collect::<Vec<_>>(),
            vec![
                ResourceSourceScope::User,
                ResourceSourceScope::ProjectShared,
                ResourceSourceScope::ProjectPrivate,
            ]
        );
        assert_eq!(descriptors[0].container_path, user_path);
        assert_eq!(
            descriptors[1].container_path,
            PathBuf::from(project_root).join(".mcp.json")
        );
        assert_eq!(
            descriptors[2].container_path,
            PathBuf::from("/Users/test/.claude.json")
        );
        assert_eq!(
            descriptors[2].selector,
            "/projects/~1Users~1test~1workspace~1demo/mcpServers"
        );
        assert!(descriptors.iter().all(|descriptor| matches!(
            descriptor.storage_kind,
            McpSourceStorageKind::JsonSection
        )));
    }

    #[test]
    fn cursor_catalog_includes_project_shared_but_not_private_descriptor() {
        let descriptors = build_source_descriptors(
            ClientKind::Cursor,
            PathBuf::from("/Users/test/.cursor/mcp.json"),
            Some("/Users/test/workspace/demo"),
        );

        assert_eq!(descriptors.len(), 2);
        assert_eq!(
            descriptors
                .iter()
                .map(|descriptor| descriptor.source_scope)
                .collect::<Vec<_>>(),
            vec![
                ResourceSourceScope::User,
                ResourceSourceScope::ProjectShared,
            ]
        );
        assert_eq!(
            descriptors[1].container_path,
            PathBuf::from("/Users/test/workspace/demo")
                .join(".cursor")
                .join("mcp.json")
        );
    }

    #[test]
    fn codex_catalog_remains_user_only_even_with_project_root() {
        let descriptors = build_source_descriptors(
            ClientKind::Codex,
            PathBuf::from("/Users/test/.codex/config.toml"),
            Some("/Users/test/workspace/demo"),
        );

        assert_eq!(descriptors.len(), 1);
        assert_eq!(descriptors[0].source_scope, ResourceSourceScope::User);
        assert_eq!(descriptors[0].selector, "mcp_servers");
        assert!(matches!(
            descriptors[0].storage_kind,
            McpSourceStorageKind::TomlTable
        ));
    }
}
