use serde_json::json;

use crate::{
    domain::{ClientKind, ResourceKind, ResourceRecord},
    infra::DetectorRegistry,
    interface::contracts::{
        command::CommandError,
        list::{ListResourcesRequest, ResourceViewMode},
    },
};

use super::{
    listing_service::McpListingService,
    mutation_service::{McpMutationResult, McpMutationService},
    mutation_target_resolver::McpMutationTargetResolver,
    source_id::McpSourceId,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct McpReplicationResult {
    pub destination_target_id: String,
    pub destination_source_id: String,
    pub message: String,
}

pub struct McpReplicationService<'a> {
    detector_registry: &'a DetectorRegistry,
}

impl<'a> McpReplicationService<'a> {
    pub fn new(detector_registry: &'a DetectorRegistry) -> Self {
        Self { detector_registry }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn replicate(
        &self,
        source_client: ClientKind,
        source_target_id: &str,
        source_source_id: &str,
        source_project_root: Option<&str>,
        destination_client: ClientKind,
        destination_target_id: Option<&str>,
        destination_source_id: Option<&str>,
        destination_project_root: Option<&str>,
        overwrite: bool,
    ) -> Result<McpReplicationResult, CommandError> {
        let source_target_id = source_target_id.trim();
        if source_target_id.is_empty() {
            return Err(CommandError::validation(
                "source_target_id must not be empty for MCP replication.",
            ));
        }

        validate_source_context(source_client, source_source_id, source_project_root)?;

        let source_record = find_mcp_record(
            self.detector_registry,
            source_client,
            source_project_root,
            source_source_id,
            source_target_id,
        )?;
        let destination_target_id = destination_target_id
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(source_target_id)
            .to_string();

        let destination_descriptor = McpMutationTargetResolver::new(self.detector_registry)
            .resolve(
                destination_client,
                crate::interface::contracts::mutate::MutationAction::Add,
                destination_project_root,
                destination_source_id,
                None,
            )?;
        let resolved_destination_source_id = destination_descriptor.source_id.clone();

        let destination_records = list_mcp_records(
            self.detector_registry,
            destination_client,
            destination_project_root,
        );
        let destination_exists = destination_records.iter().any(|record| {
            record.source_id == resolved_destination_source_id
                && record.logical_id == destination_target_id
        });

        if destination_exists && !overwrite {
            return Err(CommandError::validation(format!(
                "MCP '{}' already exists in {} for '{}'. Set overwrite=true or choose a different destination_target_id.",
                destination_target_id,
                destination_descriptor.source_label,
                destination_client.as_str()
            )));
        }

        let payload = json!({
            "transport": build_transport_payload(&source_record)?,
            "enabled": source_record.enabled,
        });

        let outcome = McpMutationService::new(self.detector_registry).mutate(
            destination_client,
            if destination_exists {
                crate::interface::contracts::mutate::MutationAction::Update
            } else {
                crate::interface::contracts::mutate::MutationAction::Add
            },
            destination_target_id.as_str(),
            destination_project_root,
            Some(resolved_destination_source_id.as_str()),
            Some(&payload),
        )?;

        Ok(build_replication_result(
            &source_record,
            destination_client,
            destination_target_id,
            destination_descriptor.source_label,
            overwrite && destination_exists,
            outcome,
        ))
    }
}

fn find_mcp_record(
    detector_registry: &DetectorRegistry,
    client: ClientKind,
    project_root: Option<&str>,
    source_id: &str,
    target_id: &str,
) -> Result<ResourceRecord, CommandError> {
    list_mcp_records(detector_registry, client, project_root)
        .into_iter()
        .find(|record| record.source_id == source_id && record.logical_id == target_id)
        .ok_or_else(|| {
            CommandError::validation(format!(
                "Could not resolve source MCP '{}' from source '{}'.",
                target_id, source_id
            ))
        })
}

fn list_mcp_records(
    detector_registry: &DetectorRegistry,
    client: ClientKind,
    project_root: Option<&str>,
) -> Vec<ResourceRecord> {
    McpListingService::new(detector_registry)
        .list(&ListResourcesRequest {
            client: Some(client),
            resource_kind: ResourceKind::Mcp,
            enabled: None,
            project_root: project_root.map(str::to_string),
            view_mode: ResourceViewMode::AllSources,
            scope_filter: None,
        })
        .items
}

fn validate_source_context(
    source_client: ClientKind,
    source_source_id: &str,
    source_project_root: Option<&str>,
) -> Result<(), CommandError> {
    let parsed = McpSourceId::parse(source_source_id).ok_or_else(|| {
        CommandError::validation(format!(
            "source_source_id '{}' is not a valid MCP source identifier.",
            source_source_id
        ))
    })?;

    if parsed.client != source_client {
        return Err(CommandError::validation(format!(
            "source_source_id '{}' does not belong to '{}'.",
            source_source_id,
            source_client.as_str()
        )));
    }

    if parsed.scope != crate::domain::ResourceSourceScope::User && source_project_root.is_none() {
        return Err(CommandError::validation(format!(
            "source_project_root is required to resolve '{}' MCP sources.",
            parsed.scope.as_str()
        )));
    }

    Ok(())
}

fn build_transport_payload(
    source_record: &ResourceRecord,
) -> Result<serde_json::Value, CommandError> {
    match source_record.transport_kind.as_deref() {
        Some("stdio") => {
            let Some(command) = source_record.transport_command.as_ref() else {
                return Err(CommandError::validation(format!(
                    "MCP '{}' is missing a stdio command and cannot be replicated.",
                    source_record.display_name
                )));
            };

            Ok(json!({
                "command": command,
                "args": source_record.transport_args.clone().unwrap_or_default(),
            }))
        }
        Some("sse") => {
            let Some(url) = source_record.transport_url.as_ref() else {
                return Err(CommandError::validation(format!(
                    "MCP '{}' is missing an SSE URL and cannot be replicated.",
                    source_record.display_name
                )));
            };

            Ok(json!({ "url": url }))
        }
        Some(other) => Err(CommandError::validation(format!(
            "MCP '{}' uses unsupported transport '{}' for replication.",
            source_record.display_name, other
        ))),
        None => Err(CommandError::validation(format!(
            "MCP '{}' has no transport kind and cannot be replicated.",
            source_record.display_name
        ))),
    }
}

fn build_replication_result(
    source_record: &ResourceRecord,
    destination_client: ClientKind,
    destination_target_id: String,
    destination_label: String,
    overwrote_existing: bool,
    outcome: McpMutationResult,
) -> McpReplicationResult {
    let verb = if overwrote_existing {
        "Replicated and overwrote"
    } else {
        "Replicated"
    };

    McpReplicationResult {
        destination_target_id: destination_target_id.clone(),
        destination_source_id: outcome.target_source_id,
        message: format!(
            "{} MCP '{}' from {} on '{}' to '{}' in {} for '{}'.",
            verb,
            source_record.display_name,
            source_record.source_label,
            source_record.client.as_str(),
            destination_target_id,
            destination_label,
            destination_client.as_str()
        ),
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::PathBuf,
        sync::{Mutex, OnceLock},
    };

    use serde_json::Value;

    use crate::{
        application::mcp::source_catalog_service::McpSourceCatalogService,
        domain::{ClientKind, ResourceSourceScope},
        infra::DetectorRegistry,
    };

    use super::McpReplicationService;

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn set_env_var(name: &str, value: impl AsRef<std::ffi::OsStr>) {
        // Tests serialize env access with env_lock(), so mutating process env is safe here.
        unsafe {
            std::env::set_var(name, value);
        }
    }

    #[test]
    fn replicate_copies_user_mcp_between_clients() {
        let _guard = env_lock().lock().expect("env lock should be available");
        let temp_root = temp_dir("copy-between-clients");
        let claude_path = temp_root.join(".claude.json");
        let cursor_path = temp_root.join(".cursor").join("mcp.json");
        fs::create_dir_all(cursor_path.parent().expect("cursor parent should exist"))
            .expect("cursor directory should be writable");
        fs::write(
            &claude_path,
            r#"{
  "mcpServers": {
    "filesystem": { "command": "npx", "args": ["-y", "@mcp/server-filesystem"], "enabled": true }
  }
}"#,
        )
        .expect("claude source should be writable");
        fs::write(&cursor_path, "{\n  \"mcpServers\": {}\n}\n")
            .expect("cursor destination should be writable");

        let previous_claude = std::env::var("AI_MANAGER_CLAUDE_CODE_MCP_CONFIG").ok();
        let previous_cursor = std::env::var("AI_MANAGER_CURSOR_MCP_CONFIG").ok();
        set_env_var(
            "AI_MANAGER_CLAUDE_CODE_MCP_CONFIG",
            claude_path.display().to_string(),
        );
        set_env_var(
            "AI_MANAGER_CURSOR_MCP_CONFIG",
            cursor_path.display().to_string(),
        );

        let detector_registry = DetectorRegistry::with_default_detectors();
        let source_catalog = McpSourceCatalogService::new(&detector_registry);
        let source_source_id = source_catalog
            .list_sources(ClientKind::ClaudeCode, None)
            .into_iter()
            .find(|descriptor| descriptor.source_scope == ResourceSourceScope::User)
            .expect("claude user source should exist")
            .source_id;
        let destination_source_id = source_catalog
            .list_sources(ClientKind::Cursor, None)
            .into_iter()
            .find(|descriptor| descriptor.source_scope == ResourceSourceScope::User)
            .expect("cursor user source should exist")
            .source_id;

        let result = McpReplicationService::new(&detector_registry)
            .replicate(
                ClientKind::ClaudeCode,
                "filesystem",
                source_source_id.as_str(),
                None,
                ClientKind::Cursor,
                None,
                None,
                None,
                false,
            )
            .expect("replication should succeed");

        let destination: Value = serde_json::from_str(
            &fs::read_to_string(&cursor_path).expect("cursor config should exist"),
        )
        .expect("destination config should remain valid json");

        assert_eq!(result.destination_target_id, "filesystem");
        assert_eq!(result.destination_source_id, destination_source_id);
        assert!(
            destination["mcpServers"]["filesystem"]["command"]
                .as_str()
                .is_some_and(|value| value == "npx")
        );

        restore_env("AI_MANAGER_CLAUDE_CODE_MCP_CONFIG", previous_claude);
        restore_env("AI_MANAGER_CURSOR_MCP_CONFIG", previous_cursor);
        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn replicate_rejects_existing_destination_without_overwrite() {
        let _guard = env_lock().lock().expect("env lock should be available");
        let temp_root = temp_dir("copy-conflict");
        let cursor_path = temp_root.join(".cursor").join("mcp.json");
        fs::create_dir_all(cursor_path.parent().expect("cursor parent should exist"))
            .expect("cursor directory should be writable");
        fs::write(
            &cursor_path,
            r#"{
  "mcpServers": {
    "filesystem": { "command": "cursor-filesystem", "enabled": true }
  }
}"#,
        )
        .expect("cursor config should be writable");

        let previous_cursor = std::env::var("AI_MANAGER_CURSOR_MCP_CONFIG").ok();
        set_env_var(
            "AI_MANAGER_CURSOR_MCP_CONFIG",
            cursor_path.display().to_string(),
        );

        let detector_registry = DetectorRegistry::with_default_detectors();
        let source_catalog = McpSourceCatalogService::new(&detector_registry);
        let source_source_id = source_catalog
            .list_sources(ClientKind::Cursor, None)
            .into_iter()
            .find(|descriptor| descriptor.source_scope == ResourceSourceScope::User)
            .expect("cursor user source should exist")
            .source_id;

        let error = McpReplicationService::new(&detector_registry)
            .replicate(
                ClientKind::Cursor,
                "filesystem",
                source_source_id.as_str(),
                None,
                ClientKind::Cursor,
                None,
                Some(source_source_id.as_str()),
                None,
                false,
            )
            .expect_err("conflict should require overwrite");

        assert!(error.message.contains("already exists"));
        assert!(error.message.contains("overwrite=true"));

        restore_env("AI_MANAGER_CURSOR_MCP_CONFIG", previous_cursor);
        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn replicate_overwrites_existing_destination_when_requested() {
        let _guard = env_lock().lock().expect("env lock should be available");
        let temp_root = temp_dir("copy-overwrite");
        let claude_path = temp_root.join(".claude.json");
        let cursor_path = temp_root.join(".cursor").join("mcp.json");
        fs::create_dir_all(cursor_path.parent().expect("cursor parent should exist"))
            .expect("cursor directory should be writable");
        fs::write(
            &claude_path,
            r#"{
  "mcpServers": {
    "filesystem": { "command": "npx", "args": ["-y", "@mcp/server-filesystem"], "enabled": true }
  }
}"#,
        )
        .expect("claude source should be writable");
        fs::write(
            &cursor_path,
            r#"{
  "mcpServers": {
    "filesystem": { "command": "cursor-filesystem", "enabled": true }
  }
}"#,
        )
        .expect("cursor config should be writable");

        let previous_claude = std::env::var("AI_MANAGER_CLAUDE_CODE_MCP_CONFIG").ok();
        let previous_cursor = std::env::var("AI_MANAGER_CURSOR_MCP_CONFIG").ok();
        set_env_var(
            "AI_MANAGER_CLAUDE_CODE_MCP_CONFIG",
            claude_path.display().to_string(),
        );
        set_env_var(
            "AI_MANAGER_CURSOR_MCP_CONFIG",
            cursor_path.display().to_string(),
        );

        let detector_registry = DetectorRegistry::with_default_detectors();
        let source_catalog = McpSourceCatalogService::new(&detector_registry);
        let source_source_id = source_catalog
            .list_sources(ClientKind::ClaudeCode, None)
            .into_iter()
            .find(|descriptor| descriptor.source_scope == ResourceSourceScope::User)
            .expect("claude user source should exist")
            .source_id;

        let result = McpReplicationService::new(&detector_registry)
            .replicate(
                ClientKind::ClaudeCode,
                "filesystem",
                source_source_id.as_str(),
                None,
                ClientKind::Cursor,
                None,
                None,
                None,
                true,
            )
            .expect("replication should overwrite destination");

        let destination: Value = serde_json::from_str(
            &fs::read_to_string(&cursor_path).expect("cursor config should exist"),
        )
        .expect("destination config should remain valid json");

        assert!(result.message.contains("overwrote"));
        assert!(
            destination["mcpServers"]["filesystem"]["command"]
                .as_str()
                .is_some_and(|value| value == "npx")
        );

        restore_env("AI_MANAGER_CLAUDE_CODE_MCP_CONFIG", previous_claude);
        restore_env("AI_MANAGER_CURSOR_MCP_CONFIG", previous_cursor);
        let _ = fs::remove_dir_all(&temp_root);
    }

    #[test]
    fn replicate_rejects_unsupported_destination_scope() {
        let _guard = env_lock().lock().expect("env lock should be available");
        let temp_root = temp_dir("unsupported-scope");
        let codex_path = temp_root.join("config.toml");
        fs::write(
            &codex_path,
            r#"[mcp_servers.filesystem]
command = "npx"
enabled = true
"#,
        )
        .expect("codex config should be writable");

        let previous_codex = std::env::var("AI_MANAGER_CODEX_MCP_CONFIG").ok();
        set_env_var(
            "AI_MANAGER_CODEX_MCP_CONFIG",
            codex_path.display().to_string(),
        );

        let detector_registry = DetectorRegistry::with_default_detectors();
        let source_catalog = McpSourceCatalogService::new(&detector_registry);
        let source_source_id = source_catalog
            .list_sources(ClientKind::Codex, None)
            .into_iter()
            .find(|descriptor| descriptor.source_scope == ResourceSourceScope::User)
            .expect("codex user source should exist")
            .source_id;

        let error = McpReplicationService::new(&detector_registry)
            .replicate(
                ClientKind::Codex,
                "filesystem",
                source_source_id.as_str(),
                None,
                ClientKind::Codex,
                Some("filesystem-copy"),
                Some("mcp::codex::project_shared::/tmp/workspace/.codex/config.toml::mcp_servers"),
                Some("/tmp/workspace"),
                false,
            )
            .expect_err("unsupported destination should fail");

        assert!(error.message.contains("unsupported scope 'project_shared'"));

        restore_env("AI_MANAGER_CODEX_MCP_CONFIG", previous_codex);
        let _ = fs::remove_dir_all(&temp_root);
    }

    fn temp_dir(suffix: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "ai-manager-mcp-replication-{}-{}",
            std::process::id(),
            suffix
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("temp root should be writable");
        root
    }

    fn restore_env(name: &str, previous: Option<String>) {
        match previous {
            Some(value) => set_env_var(name, value),
            None => {
                // Tests serialize env access with env_lock(), so mutating process env is safe here.
                unsafe {
                    std::env::remove_var(name);
                }
            }
        }
    }
}
