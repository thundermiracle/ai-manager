use std::fs;

use crate::{
    infra::DetectorRegistry,
    infra::SafeFileMutator,
    interface::contracts::{command::CommandError, common::ClientKind, mutate::MutationAction},
};

use super::{
    config_path_resolver::resolve_mcp_config_path,
    mutation_payload::{McpMutationPayload, McpTransportPayload, parse_mcp_mutation_payload},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct McpMutationResult {
    pub source_path: String,
    pub message: String,
}

pub struct McpMutationService<'a> {
    detector_registry: &'a DetectorRegistry,
}

impl<'a> McpMutationService<'a> {
    pub fn new(detector_registry: &'a DetectorRegistry) -> Self {
        Self { detector_registry }
    }

    pub fn mutate(
        &self,
        client: ClientKind,
        action: MutationAction,
        target_id: &str,
        payload: Option<&serde_json::Value>,
    ) -> Result<McpMutationResult, CommandError> {
        let payload = parse_mcp_mutation_payload(action, payload)?;
        let source_path = resolve_mcp_config_path(
            client,
            action,
            payload.source_path.as_deref(),
            self.detector_registry,
        )?;

        let current_content = match fs::read_to_string(&source_path) {
            Ok(content) => content,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
            Err(error) => {
                return Err(CommandError::internal(format!(
                    "Failed to read MCP config '{}': {}",
                    source_path.display(),
                    error
                )));
            }
        };

        let next_content = if matches!(client, ClientKind::CodexCli) {
            mutate_toml_content(&current_content, target_id, action, &payload)?
        } else {
            mutate_json_content(&current_content, target_id, action, &payload)?
        };

        let write_result = SafeFileMutator::new()
            .replace_file(&source_path, next_content.as_bytes())
            .map_err(|failure| {
                CommandError::internal(format!(
                    "[stage={:?}] {} (rollback_succeeded={})",
                    failure.stage, failure.message, failure.rollback_succeeded
                ))
            })?;

        let mut message = match action {
            MutationAction::Add => format!("Added MCP '{}' for '{}'.", target_id, client.as_str()),
            MutationAction::Remove => {
                format!("Removed MCP '{}' for '{}'.", target_id, client.as_str())
            }
            MutationAction::Update => {
                format!("Updated MCP '{}' for '{}'.", target_id, client.as_str())
            }
        };
        if let Some(backup_path) = write_result.backup_path {
            message.push_str(&format!(" Backup: {}.", backup_path));
        }

        Ok(McpMutationResult {
            source_path: source_path.display().to_string(),
            message,
        })
    }
}

fn mutate_json_content(
    current_content: &str,
    target_id: &str,
    action: MutationAction,
    payload: &McpMutationPayload,
) -> Result<String, CommandError> {
    let mut root = if current_content.trim().is_empty() {
        serde_json::json!({})
    } else {
        serde_json::from_str::<serde_json::Value>(current_content).map_err(|error| {
            CommandError::validation(format!("Invalid JSON MCP config: {}", error))
        })?
    };

    let Some(root_object) = root.as_object_mut() else {
        return Err(CommandError::validation(
            "JSON MCP config root must be an object.",
        ));
    };

    let section_key = if root_object.contains_key("mcpServers") {
        "mcpServers"
    } else if root_object.contains_key("mcp_servers") {
        "mcp_servers"
    } else {
        "mcpServers"
    };

    if !root_object.contains_key(section_key) {
        root_object.insert(section_key.to_string(), serde_json::json!({}));
    }

    let Some(section) = root_object.get_mut(section_key) else {
        return Err(CommandError::validation(
            "JSON MCP section could not be resolved.",
        ));
    };
    let Some(section_object) = section.as_object_mut() else {
        return Err(CommandError::validation(
            "JSON MCP section must be an object map.",
        ));
    };

    match action {
        MutationAction::Add => {
            if section_object.contains_key(target_id) {
                return Err(CommandError::validation(format!(
                    "MCP '{}' already exists.",
                    target_id
                )));
            }

            let Some(transport) = payload.transport.as_ref() else {
                return Err(CommandError::validation(
                    "payload.transport is required for MCP add mutation.",
                ));
            };

            section_object.insert(
                target_id.to_string(),
                build_json_transport_payload(transport, payload.enabled.unwrap_or(true)),
            );
        }
        MutationAction::Remove => {
            if section_object.remove(target_id).is_none() {
                return Err(CommandError::validation(format!(
                    "MCP '{}' does not exist.",
                    target_id
                )));
            }
        }
        MutationAction::Update => {
            let Some(current_entry) = section_object.get(target_id) else {
                return Err(CommandError::validation(format!(
                    "MCP '{}' does not exist.",
                    target_id
                )));
            };
            let current_enabled = current_entry
                .as_object()
                .and_then(|entry| entry.get("enabled"))
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(true);

            let Some(transport) = payload.transport.as_ref() else {
                return Err(CommandError::validation(
                    "payload.transport is required for MCP add/update mutation.",
                ));
            };

            section_object.insert(
                target_id.to_string(),
                build_json_transport_payload(transport, payload.enabled.unwrap_or(current_enabled)),
            );
        }
    }

    let mut serialized = serde_json::to_string_pretty(&root).map_err(|error| {
        CommandError::internal(format!("Failed to serialize JSON MCP config: {}", error))
    })?;
    serialized.push('\n');
    Ok(serialized)
}

fn mutate_toml_content(
    current_content: &str,
    target_id: &str,
    action: MutationAction,
    payload: &McpMutationPayload,
) -> Result<String, CommandError> {
    let mut root = if current_content.trim().is_empty() {
        toml::Table::new()
    } else {
        toml::from_str::<toml::Table>(current_content).map_err(|error| {
            CommandError::validation(format!("Invalid TOML MCP config: {}", error))
        })?
    };

    let section_key = if root.contains_key("mcp_servers") {
        "mcp_servers"
    } else if root.contains_key("mcpServers") {
        "mcpServers"
    } else {
        "mcp_servers"
    };

    if !root.contains_key(section_key) {
        root.insert(
            section_key.to_string(),
            toml::Value::Table(toml::Table::new()),
        );
    }

    let Some(section) = root.get_mut(section_key) else {
        return Err(CommandError::validation(
            "TOML MCP section could not be resolved.",
        ));
    };
    let Some(section_table) = section.as_table_mut() else {
        return Err(CommandError::validation(
            "TOML MCP section must be a table map.",
        ));
    };

    match action {
        MutationAction::Add => {
            if section_table.contains_key(target_id) {
                return Err(CommandError::validation(format!(
                    "MCP '{}' already exists.",
                    target_id
                )));
            }

            let Some(transport) = payload.transport.as_ref() else {
                return Err(CommandError::validation(
                    "payload.transport is required for MCP add mutation.",
                ));
            };

            section_table.insert(
                target_id.to_string(),
                build_toml_transport_payload(transport, payload.enabled.unwrap_or(true)),
            );
        }
        MutationAction::Remove => {
            if section_table.remove(target_id).is_none() {
                return Err(CommandError::validation(format!(
                    "MCP '{}' does not exist.",
                    target_id
                )));
            }
        }
        MutationAction::Update => {
            let Some(current_entry) = section_table.get(target_id) else {
                return Err(CommandError::validation(format!(
                    "MCP '{}' does not exist.",
                    target_id
                )));
            };
            let current_enabled = current_entry
                .as_table()
                .and_then(|entry| entry.get("enabled"))
                .and_then(toml::Value::as_bool)
                .unwrap_or(true);

            let Some(transport) = payload.transport.as_ref() else {
                return Err(CommandError::validation(
                    "payload.transport is required for MCP add/update mutation.",
                ));
            };

            section_table.insert(
                target_id.to_string(),
                build_toml_transport_payload(transport, payload.enabled.unwrap_or(current_enabled)),
            );
        }
    }

    let mut serialized = toml::to_string_pretty(&root).map_err(|error| {
        CommandError::internal(format!("Failed to serialize TOML MCP config: {}", error))
    })?;
    serialized.push('\n');
    Ok(serialized)
}

fn build_json_transport_payload(
    transport: &McpTransportPayload,
    enabled: bool,
) -> serde_json::Value {
    match transport {
        McpTransportPayload::Stdio { command, args } => {
            let mut object = serde_json::Map::new();
            object.insert(
                "command".to_string(),
                serde_json::Value::String(command.to_string()),
            );
            if !args.is_empty() {
                object.insert(
                    "args".to_string(),
                    serde_json::Value::Array(
                        args.iter()
                            .cloned()
                            .map(serde_json::Value::String)
                            .collect(),
                    ),
                );
            }
            object.insert("enabled".to_string(), serde_json::Value::Bool(enabled));
            serde_json::Value::Object(object)
        }
        McpTransportPayload::Sse { url } => serde_json::json!({
            "url": url,
            "enabled": enabled
        }),
    }
}

fn build_toml_transport_payload(transport: &McpTransportPayload, enabled: bool) -> toml::Value {
    let mut table = toml::Table::new();

    match transport {
        McpTransportPayload::Stdio { command, args } => {
            table.insert(
                "command".to_string(),
                toml::Value::String(command.to_string()),
            );
            if !args.is_empty() {
                table.insert(
                    "args".to_string(),
                    toml::Value::Array(args.iter().cloned().map(toml::Value::String).collect()),
                );
            }
        }
        McpTransportPayload::Sse { url } => {
            table.insert("url".to_string(), toml::Value::String(url.to_string()));
        }
    }

    table.insert("enabled".to_string(), toml::Value::Boolean(enabled));
    toml::Value::Table(table)
}

#[cfg(test)]
mod tests {
    use std::fs;

    use serde_json::json;

    use crate::{
        infra::DetectorRegistry,
        interface::contracts::{common::ClientKind, mutate::MutationAction},
    };

    use super::McpMutationService;

    #[test]
    fn add_mcp_to_json_config_succeeds() {
        let temp_dir =
            std::env::temp_dir().join(format!("ai-manager-mcp-add-json-{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);
        let source = temp_dir.join("claude.json");
        fs::write(&source, "{}").expect("should create json config");

        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = McpMutationService::new(&detector_registry);
        let result = service
            .mutate(
                ClientKind::ClaudeCode,
                MutationAction::Add,
                "filesystem",
                Some(&json!({
                    "source_path": source.display().to_string(),
                    "transport": { "command": "npx", "args": ["-y", "server"] },
                    "enabled": true
                })),
            )
            .expect("json add should succeed");

        let content = fs::read_to_string(&source).expect("should read updated json config");
        let _ = fs::remove_dir_all(&temp_dir);

        assert!(content.contains("filesystem"));
        assert!(content.contains("\"command\": \"npx\""));
        assert_eq!(result.source_path, source.display().to_string());
    }

    #[test]
    fn duplicate_mcp_add_is_validation_error_and_non_destructive() {
        let temp_dir = std::env::temp_dir().join(format!(
            "ai-manager-mcp-add-duplicate-{}",
            std::process::id()
        ));
        let _ = fs::create_dir_all(&temp_dir);
        let source = temp_dir.join("cursor.json");
        let original = r#"{
  "mcpServers": {
    "context7": { "command": "context7", "enabled": true }
  }
}"#;
        fs::write(&source, original).expect("should create json config");

        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = McpMutationService::new(&detector_registry);
        let error = service
            .mutate(
                ClientKind::Cursor,
                MutationAction::Add,
                "context7",
                Some(&json!({
                    "source_path": source.display().to_string(),
                    "transport": { "command": "context7" }
                })),
            )
            .expect_err("duplicate add should fail");

        let content = fs::read_to_string(&source).expect("should read unmodified config");
        let _ = fs::remove_dir_all(&temp_dir);

        assert!(error.message.contains("already exists"));
        assert_eq!(content, original);
    }

    #[test]
    fn update_mcp_in_json_config_succeeds() {
        let temp_dir =
            std::env::temp_dir().join(format!("ai-manager-mcp-update-json-{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);
        let source = temp_dir.join("cursor.json");
        fs::write(
            &source,
            r#"{
  "mcpServers": {
    "filesystem": { "command": "npx", "args": ["-y", "old-server"], "enabled": true }
  }
}"#,
        )
        .expect("should create json config");

        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = McpMutationService::new(&detector_registry);
        let result = service
            .mutate(
                ClientKind::Cursor,
                MutationAction::Update,
                "filesystem",
                Some(&json!({
                    "source_path": source.display().to_string(),
                    "transport": { "url": "https://mcp.example.com/sse" },
                    "enabled": false
                })),
            )
            .expect("update should succeed");

        let content = fs::read_to_string(&source).expect("should read updated json config");
        let _ = fs::remove_dir_all(&temp_dir);

        assert!(content.contains("\"url\": \"https://mcp.example.com/sse\""));
        assert!(content.contains("\"enabled\": false"));
        assert!(result.message.contains("Updated MCP"));
    }

    #[test]
    fn update_missing_mcp_is_validation_error() {
        let temp_dir = std::env::temp_dir().join(format!(
            "ai-manager-mcp-update-missing-{}",
            std::process::id()
        ));
        let _ = fs::create_dir_all(&temp_dir);
        let source = temp_dir.join("cursor.json");
        fs::write(&source, r#"{ "mcpServers": {} }"#).expect("should create json config");

        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = McpMutationService::new(&detector_registry);
        let error = service
            .mutate(
                ClientKind::Cursor,
                MutationAction::Update,
                "filesystem",
                Some(&json!({
                    "source_path": source.display().to_string(),
                    "transport": { "command": "npx" }
                })),
            )
            .expect_err("update should fail when entry is missing");

        let _ = fs::remove_dir_all(&temp_dir);
        assert!(error.message.contains("does not exist"));
    }

    #[test]
    fn remove_mcp_from_toml_config_succeeds() {
        let temp_dir =
            std::env::temp_dir().join(format!("ai-manager-mcp-remove-toml-{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);
        let source = temp_dir.join("codex.toml");
        fs::write(
            &source,
            r#"[mcp_servers.filesystem]
command = "npx"
enabled = true
"#,
        )
        .expect("should create toml config");

        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = McpMutationService::new(&detector_registry);
        service
            .mutate(
                ClientKind::CodexCli,
                MutationAction::Remove,
                "filesystem",
                Some(&json!({
                    "source_path": source.display().to_string()
                })),
            )
            .expect("remove should succeed");

        let content = fs::read_to_string(&source).expect("should read updated toml config");
        let _ = fs::remove_dir_all(&temp_dir);

        assert!(!content.contains("filesystem"));
    }

    #[test]
    fn malformed_transport_is_actionable_validation_error() {
        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = McpMutationService::new(&detector_registry);
        let error = service
            .mutate(
                ClientKind::CodexApp,
                MutationAction::Add,
                "remote",
                Some(&json!({
                    "transport": { "url": "ftp://invalid" }
                })),
            )
            .expect_err("invalid transport should fail");

        assert!(error.message.contains("http:// or https://"));
    }
}
