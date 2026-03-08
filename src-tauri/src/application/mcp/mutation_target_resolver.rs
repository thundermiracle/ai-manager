use std::path::{Path, PathBuf};

use crate::{
    domain::{ClientKind, ResourceSourceScope},
    infra::DetectorRegistry,
    interface::contracts::{command::CommandError, mutate::MutationAction},
};

use super::{
    config_path_resolver::resolve_mcp_config_path,
    source_catalog_service::{
        McpSourceCatalogService, McpSourceDescriptor, descriptor_for_scope, selector_for_scope,
        storage_kind_for_client,
    },
    source_id::McpSourceId,
};

pub struct McpMutationTargetResolver<'a> {
    detector_registry: &'a DetectorRegistry,
}

impl<'a> McpMutationTargetResolver<'a> {
    pub fn new(detector_registry: &'a DetectorRegistry) -> Self {
        Self { detector_registry }
    }

    pub fn resolve(
        &self,
        client: ClientKind,
        action: MutationAction,
        project_root: Option<&str>,
        target_source_id: Option<&str>,
        source_path_override: Option<&str>,
    ) -> Result<McpSourceDescriptor, CommandError> {
        let source_catalog_service = McpSourceCatalogService::new(self.detector_registry);
        let descriptors = source_catalog_service.list_sources(client, project_root);

        if let Some(target_source_id) = target_source_id {
            if let Some(descriptor) = descriptors
                .iter()
                .find(|descriptor| descriptor.source_id == target_source_id)
            {
                return Ok(descriptor.clone());
            }

            if let Some(source_path_override) = source_path_override {
                let override_path = resolve_mcp_config_path(
                    client,
                    action,
                    Some(source_path_override),
                    self.detector_registry,
                )?;
                return build_override_descriptor(
                    client,
                    project_root,
                    target_source_id,
                    override_path,
                    &descriptors,
                );
            }

            return Err(unresolved_target_source_error(
                client,
                target_source_id,
                &descriptors,
                project_root.is_some(),
            ));
        }

        let source_path =
            resolve_mcp_config_path(client, action, source_path_override, self.detector_registry)?;

        if let Some(descriptor) = descriptor_for_path(&descriptors, &source_path) {
            return Ok(descriptor);
        }

        Ok(descriptor_for_scope(
            client,
            ResourceSourceScope::User,
            source_path,
            selector_for_scope(client, ResourceSourceScope::User, None),
            storage_kind_for_client(client),
            None,
        ))
    }
}

fn build_override_descriptor(
    client: ClientKind,
    project_root: Option<&str>,
    target_source_id: &str,
    override_path: PathBuf,
    descriptors: &[McpSourceDescriptor],
) -> Result<McpSourceDescriptor, CommandError> {
    let parsed = McpSourceId::parse(target_source_id).ok_or_else(|| {
        CommandError::validation(format!(
            "target_source_id '{}' is not a valid MCP source identifier.",
            target_source_id
        ))
    })?;

    if parsed.client != client {
        return Err(CommandError::validation(format!(
            "target_source_id '{}' does not belong to '{}'.",
            target_source_id,
            client.as_str()
        )));
    }

    if parsed.scope != ResourceSourceScope::User && project_root.is_none() {
        return Err(CommandError::validation(format!(
            "project_root is required to target '{}' MCP sources.",
            parsed.scope.as_str()
        )));
    }

    if !descriptors
        .iter()
        .any(|descriptor| descriptor.source_scope == parsed.scope)
    {
        return Err(unsupported_scope_error(
            client,
            target_source_id,
            parsed.scope,
            descriptors,
        ));
    }

    let selector = parsed
        .selector
        .unwrap_or_else(|| selector_for_scope(client, parsed.scope, project_root));

    Ok(descriptor_for_scope(
        client,
        parsed.scope,
        override_path,
        selector,
        storage_kind_for_client(client),
        project_root.map(str::to_string),
    ))
}

fn descriptor_for_path(
    descriptors: &[McpSourceDescriptor],
    source_path: &Path,
) -> Option<McpSourceDescriptor> {
    descriptors
        .iter()
        .filter(|descriptor| descriptor.container_path == source_path)
        .min_by_key(|descriptor| legacy_resolution_rank(descriptor.source_scope))
        .cloned()
}

fn legacy_resolution_rank(scope: ResourceSourceScope) -> u8 {
    match scope {
        ResourceSourceScope::User => 0,
        ResourceSourceScope::ProjectShared => 1,
        ResourceSourceScope::ProjectPrivate => 2,
    }
}

fn unresolved_target_source_error(
    client: ClientKind,
    target_source_id: &str,
    descriptors: &[McpSourceDescriptor],
    has_project_root: bool,
) -> CommandError {
    if let Some(parsed) = McpSourceId::parse(target_source_id) {
        if parsed.client != client {
            return CommandError::validation(format!(
                "target_source_id '{}' does not belong to '{}'.",
                target_source_id,
                client.as_str()
            ));
        }

        if parsed.scope != ResourceSourceScope::User && !has_project_root {
            return CommandError::validation(format!(
                "project_root is required to target '{}' MCP sources.",
                parsed.scope.as_str()
            ));
        }

        if !descriptors
            .iter()
            .any(|descriptor| descriptor.source_scope == parsed.scope)
        {
            return unsupported_scope_error(client, target_source_id, parsed.scope, descriptors);
        }
    }

    CommandError::validation(format!(
        "Could not resolve target_source_id '{}' for '{}'.",
        target_source_id,
        client.as_str()
    ))
}

fn unsupported_scope_error(
    client: ClientKind,
    target_source_id: &str,
    unsupported_scope: ResourceSourceScope,
    descriptors: &[McpSourceDescriptor],
) -> CommandError {
    let supported_scopes = descriptors
        .iter()
        .map(|descriptor| descriptor.source_scope.as_str())
        .collect::<Vec<_>>()
        .join(", ");

    CommandError::validation(format!(
        "target_source_id '{}' requests unsupported scope '{}' for '{}'. Supported scopes: {}.",
        target_source_id,
        unsupported_scope.as_str(),
        client.as_str(),
        supported_scopes
    ))
}

#[cfg(test)]
mod tests {
    use std::{fs, path::PathBuf};

    use crate::{
        domain::{ClientKind, ResourceSourceScope},
        infra::DetectorRegistry,
        interface::contracts::mutate::MutationAction,
    };

    use super::McpMutationTargetResolver;

    #[test]
    fn resolve_prefers_project_shared_descriptor_for_matching_project_file() {
        let detector_registry = DetectorRegistry::with_default_detectors();
        let resolver = McpMutationTargetResolver::new(&detector_registry);
        let project_root = temp_project_root("target-project-shared");
        let project_config = project_root.join(".cursor").join("mcp.json");
        fs::create_dir_all(
            project_config
                .parent()
                .expect("project config parent should exist"),
        )
        .expect("project config directory should be created");
        fs::write(&project_config, "{}").expect("project config should be writable");

        let descriptor = resolver
            .resolve(
                ClientKind::Cursor,
                MutationAction::Add,
                Some(project_root.to_string_lossy().as_ref()),
                None,
                Some(project_config.to_string_lossy().as_ref()),
            )
            .expect("project-shared descriptor should resolve");

        let _ = fs::remove_dir_all(&project_root);

        assert_eq!(descriptor.source_scope, ResourceSourceScope::ProjectShared);
        assert_eq!(descriptor.container_path, project_config);
    }

    #[test]
    fn resolve_rejects_unsupported_target_scope_for_codex() {
        let detector_registry = DetectorRegistry::with_default_detectors();
        let resolver = McpMutationTargetResolver::new(&detector_registry);
        let project_root = temp_project_root("target-unsupported-scope");
        let project_source = project_root.join("config.toml");
        fs::write(&project_source, "").expect("project source should be writable");

        let error = resolver
            .resolve(
                ClientKind::Codex,
                MutationAction::Add,
                Some(project_root.to_string_lossy().as_ref()),
                Some("mcp::codex::project_shared::/tmp/workspace/.codex/config.toml::mcp_servers"),
                Some(project_source.to_string_lossy().as_ref()),
            )
            .expect_err("unsupported scope should fail");

        let _ = fs::remove_dir_all(&project_root);

        assert!(error.message.contains("unsupported scope 'project_shared'"));
        assert!(error.message.contains("Supported scopes: user"));
    }

    #[test]
    fn resolve_builds_project_private_descriptor_from_explicit_target() {
        let detector_registry = DetectorRegistry::with_default_detectors();
        let resolver = McpMutationTargetResolver::new(&detector_registry);
        let project_root = temp_project_root("target-project-private");
        let claude_config = project_root.join("claude.json");
        fs::write(&claude_config, "{}").expect("claude config should be writable");
        let project_root_string = project_root.to_string_lossy().to_string();
        let target_source_id = format!(
            "mcp::claude_code::project_private::{}::/projects/{}/mcpServers",
            claude_config.display(),
            project_root_string.replace('~', "~0").replace('/', "~1"),
        );

        let descriptor = resolver
            .resolve(
                ClientKind::ClaudeCode,
                MutationAction::Add,
                Some(project_root_string.as_str()),
                Some(target_source_id.as_str()),
                Some(claude_config.to_string_lossy().as_ref()),
            )
            .expect("project-private descriptor should resolve from explicit target");

        let _ = fs::remove_dir_all(&project_root);

        assert_eq!(descriptor.source_scope, ResourceSourceScope::ProjectPrivate);
        assert_eq!(descriptor.container_path, claude_config);
        assert_eq!(
            descriptor.selector,
            format!(
                "/projects/{}/mcpServers",
                project_root_string.replace('~', "~0").replace('/', "~1")
            )
        );
    }

    fn temp_project_root(suffix: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "ai-manager-mcp-mutation-target-{}-{}",
            std::process::id(),
            suffix
        ));
        let _ = fs::create_dir_all(&root);
        root
    }
}
