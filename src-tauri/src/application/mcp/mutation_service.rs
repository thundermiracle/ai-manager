use std::fs;

use crate::{
    infra::DetectorRegistry,
    infra::SafeFileMutator,
    interface::contracts::{command::CommandError, common::ClientKind, mutate::MutationAction},
};

use super::{
    mutation_payload::{McpMutationPayload, McpTransportPayload, parse_mcp_mutation_payload},
    mutation_target_resolver::McpMutationTargetResolver,
    source_catalog_service::{McpSourceDescriptor, McpSourceStorageKind},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct McpMutationResult {
    pub source_path: String,
    pub target_source_id: String,
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
        project_root: Option<&str>,
        target_source_id: Option<&str>,
        payload: Option<&serde_json::Value>,
    ) -> Result<McpMutationResult, CommandError> {
        let payload = parse_mcp_mutation_payload(action, payload)?;
        let target_descriptor = McpMutationTargetResolver::new(self.detector_registry).resolve(
            client,
            action,
            project_root,
            target_source_id,
            payload.source_path.as_deref(),
        )?;

        let current_content = match fs::read_to_string(&target_descriptor.container_path) {
            Ok(content) => content,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => String::new(),
            Err(error) => {
                return Err(CommandError::internal(format!(
                    "Failed to read MCP config '{}': {}",
                    target_descriptor.container_path.display(),
                    error
                )));
            }
        };

        let next_content = match target_descriptor.storage_kind {
            McpSourceStorageKind::JsonSection => mutate_json_content(
                &target_descriptor,
                &current_content,
                target_id,
                action,
                &payload,
            )?,
            McpSourceStorageKind::TomlTable => {
                mutate_toml_content(&current_content, target_id, action, &payload)?
            }
        };

        let write_result = SafeFileMutator::new()
            .replace_file(&target_descriptor.container_path, next_content.as_bytes())
            .map_err(|failure| {
                CommandError::internal(format!(
                    "[stage={:?}] {} (rollback_succeeded={})",
                    failure.stage, failure.message, failure.rollback_succeeded
                ))
            })?;

        let mut message = match action {
            MutationAction::Add => format!(
                "Added MCP '{}' for '{}' in {}.",
                target_id,
                client.as_str(),
                target_descriptor.source_label
            ),
            MutationAction::Remove => format!(
                "Removed MCP '{}' for '{}' from {}.",
                target_id,
                client.as_str(),
                target_descriptor.source_label
            ),
            MutationAction::Update => format!(
                "Updated MCP '{}' for '{}' in {}.",
                target_id,
                client.as_str(),
                target_descriptor.source_label
            ),
        };
        if let Some(backup_path) = write_result.backup_path {
            message.push_str(&format!(" Backup: {}.", backup_path));
        }

        Ok(McpMutationResult {
            source_path: target_descriptor.container_path.display().to_string(),
            target_source_id: target_descriptor.source_id,
            message,
        })
    }
}

fn mutate_json_content(
    descriptor: &McpSourceDescriptor,
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

    if !root.is_object() {
        return Err(CommandError::validation(
            "JSON MCP config root must be an object.",
        ));
    }

    let section_object = resolve_json_section_map(&mut root, &descriptor.selector)?;
    apply_json_mcp_mutation(
        descriptor.client,
        section_object,
        target_id,
        action,
        payload,
    )?;

    let mut serialized = serde_json::to_string_pretty(&root).map_err(|error| {
        CommandError::internal(format!("Failed to serialize JSON MCP config: {}", error))
    })?;
    serialized.push('\n');
    Ok(serialized)
}

fn resolve_json_section_map<'a>(
    root: &'a mut serde_json::Value,
    selector: &str,
) -> Result<&'a mut serde_json::Map<String, serde_json::Value>, CommandError> {
    let tokens = parse_json_pointer_tokens(selector)?;
    let section = resolve_json_section_value(root, &tokens)?;
    let Some(section_object) = section.as_object_mut() else {
        return Err(CommandError::validation(
            "JSON MCP section must be an object map.",
        ));
    };

    Ok(section_object)
}

fn parse_json_pointer_tokens(selector: &str) -> Result<Vec<String>, CommandError> {
    if !selector.starts_with('/') {
        return Err(CommandError::validation(format!(
            "JSON MCP selector '{}' must start with '/'.",
            selector
        )));
    }

    Ok(selector
        .split('/')
        .skip(1)
        .map(|token| token.replace("~1", "/").replace("~0", "~"))
        .collect())
}

fn resolve_json_section_value<'a>(
    current: &'a mut serde_json::Value,
    tokens: &[String],
) -> Result<&'a mut serde_json::Value, CommandError> {
    if tokens.is_empty() {
        return Ok(current);
    }

    let Some(object) = current.as_object_mut() else {
        return Err(CommandError::validation(
            "JSON MCP path contains a non-object segment.",
        ));
    };

    let key = resolve_json_child_key(object, &tokens[0]);
    let next = object.entry(key).or_insert_with(|| serde_json::json!({}));

    resolve_json_section_value(next, &tokens[1..])
}

fn resolve_json_child_key(
    object: &serde_json::Map<String, serde_json::Value>,
    requested_key: &str,
) -> String {
    if requested_key == "mcpServers" {
        if object.contains_key("mcpServers") {
            return "mcpServers".to_string();
        }
        if object.contains_key("mcp_servers") {
            return "mcp_servers".to_string();
        }
    }

    if requested_key == "mcp_servers" && object.contains_key("mcpServers") {
        return "mcpServers".to_string();
    }

    requested_key.to_string()
}

fn apply_json_mcp_mutation(
    client: ClientKind,
    section_object: &mut serde_json::Map<String, serde_json::Value>,
    target_id: &str,
    action: MutationAction,
    payload: &McpMutationPayload,
) -> Result<(), CommandError> {
    if matches!(client, ClientKind::ClaudeCode) && payload.enabled == Some(false) {
        return Err(CommandError::validation(
            "Claude Code user MCP schema does not support `enabled=false`; remove the server entry to disable it.",
        ));
    }

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
                build_json_transport_payload(client, transport, payload.enabled.unwrap_or(true)),
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
                build_json_transport_payload(
                    client,
                    transport,
                    payload.enabled.unwrap_or(current_enabled),
                ),
            );
        }
    }

    Ok(())
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
    client: ClientKind,
    transport: &McpTransportPayload,
    enabled: bool,
) -> serde_json::Value {
    if matches!(client, ClientKind::ClaudeCode) {
        return match transport {
            McpTransportPayload::Stdio { command, args } => serde_json::json!({
                "type": "stdio",
                "command": command,
                "args": args,
                "env": {}
            }),
            McpTransportPayload::Sse { url } => serde_json::json!({
                "type": "sse",
                "url": url
            }),
        };
    }

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
    use std::{fs, path::PathBuf};

    use serde_json::{Value, json};

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
                None,
                None,
                Some(&json!({
                    "source_path": source.display().to_string(),
                    "transport": { "command": "npx", "args": ["-y", "server"] },
                    "enabled": true
                })),
            )
            .expect("json add should succeed");

        let content = fs::read_to_string(&source).expect("should read updated json config");
        let value: Value =
            serde_json::from_str(&content).expect("updated Claude config should be valid JSON");
        let _ = fs::remove_dir_all(&temp_dir);

        assert!(content.contains("filesystem"));
        assert!(content.contains("\"command\": \"npx\""));
        let entry = value
            .get("mcpServers")
            .and_then(Value::as_object)
            .and_then(|servers| servers.get("filesystem"))
            .and_then(Value::as_object)
            .expect("filesystem entry should be created");
        assert_eq!(entry.get("type").and_then(Value::as_str), Some("stdio"));
        assert!(entry.get("enabled").is_none());
        assert_eq!(result.source_path, source.display().to_string());
    }

    #[test]
    fn claude_add_prefers_root_mcp_section_for_global_scope() {
        let temp_dir = std::env::temp_dir().join(format!(
            "ai-manager-mcp-claude-root-priority-{}",
            std::process::id()
        ));
        let _ = fs::create_dir_all(&temp_dir);
        let source = temp_dir.join("claude.json");
        let cwd = std::env::current_dir()
            .expect("current directory should resolve for test")
            .to_string_lossy()
            .to_string();
        let fixture = json!({
            "mcpServers": {},
            "projects": {
                cwd.clone(): {
                    "mcpServers": {
                        "existing": { "command": "npx", "enabled": true }
                    }
                }
            }
        });
        fs::write(
            &source,
            serde_json::to_string_pretty(&fixture).expect("fixture should serialize"),
        )
        .expect("should create claude json config");

        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = McpMutationService::new(&detector_registry);
        service
            .mutate(
                ClientKind::ClaudeCode,
                MutationAction::Add,
                "filesystem",
                None,
                None,
                Some(&json!({
                    "source_path": source.display().to_string(),
                    "transport": { "command": "npx", "args": ["-y", "server"] },
                    "enabled": true
                })),
            )
            .expect("claude add should succeed");

        let content = fs::read_to_string(&source).expect("should read updated config");
        let value: Value = serde_json::from_str(&content).expect("output should remain valid json");
        let _ = fs::remove_dir_all(&temp_dir);

        let root_servers = value
            .get("mcpServers")
            .and_then(Value::as_object)
            .expect("root mcpServers should remain object");
        assert!(root_servers.contains_key("filesystem"));

        let project_servers = value
            .get("projects")
            .and_then(Value::as_object)
            .and_then(|projects| projects.get(cwd.as_str()))
            .and_then(Value::as_object)
            .and_then(|project| project.get("mcpServers"))
            .and_then(Value::as_object)
            .expect("project mcpServers should remain object");
        assert!(project_servers.contains_key("existing"));
        assert!(!project_servers.contains_key("filesystem"));
    }

    #[test]
    fn claude_add_creates_root_section_when_only_project_section_exists() {
        let temp_dir = std::env::temp_dir().join(format!(
            "ai-manager-mcp-claude-root-create-{}",
            std::process::id()
        ));
        let _ = fs::create_dir_all(&temp_dir);
        let source = temp_dir.join("claude.json");
        let cwd = std::env::current_dir()
            .expect("current directory should resolve for test")
            .to_string_lossy()
            .to_string();
        let fixture = json!({
            "projects": {
                cwd.clone(): {
                    "mcpServers": {}
                }
            }
        });
        fs::write(
            &source,
            serde_json::to_string_pretty(&fixture).expect("fixture should serialize"),
        )
        .expect("should create claude json config");

        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = McpMutationService::new(&detector_registry);
        service
            .mutate(
                ClientKind::ClaudeCode,
                MutationAction::Add,
                "filesystem",
                None,
                None,
                Some(&json!({
                    "source_path": source.display().to_string(),
                    "transport": { "command": "npx", "args": ["-y", "server"] },
                    "enabled": true
                })),
            )
            .expect("claude add should succeed");

        let content = fs::read_to_string(&source).expect("should read updated config");
        let value: Value = serde_json::from_str(&content).expect("output should remain valid json");
        let _ = fs::remove_dir_all(&temp_dir);

        let root_servers = value
            .get("mcpServers")
            .and_then(Value::as_object)
            .expect("root mcpServers should be created");
        assert!(root_servers.contains_key("filesystem"));

        let project_servers = value
            .get("projects")
            .and_then(Value::as_object)
            .and_then(|projects| projects.get(cwd.as_str()))
            .and_then(Value::as_object)
            .and_then(|project| project.get("mcpServers"))
            .and_then(Value::as_object)
            .expect("current project mcpServers should exist");
        assert!(!project_servers.contains_key("filesystem"));
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
                None,
                None,
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
                None,
                None,
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
                None,
                None,
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
                ClientKind::Codex,
                MutationAction::Remove,
                "filesystem",
                None,
                None,
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
    fn claude_project_private_target_mutates_project_section() {
        let temp_dir = temp_root("claude-project-private");
        let project_root = temp_dir.join("workspace");
        let _ = fs::create_dir_all(&project_root);
        let project_root_string = project_root.display().to_string();
        let source = temp_dir.join("claude.json");
        fs::write(
            &source,
            r#"{
  "mcpServers": {
    "root": { "command": "npx", "enabled": true }
  }
}"#,
        )
        .expect("should create claude config");

        let target_source_id = format!(
            "mcp::claude_code::project_private::{}::/projects/{}/mcpServers",
            source.display(),
            escape_json_pointer_token(&project_root_string)
        );

        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = McpMutationService::new(&detector_registry);
        let result = service
            .mutate(
                ClientKind::ClaudeCode,
                MutationAction::Add,
                "github",
                Some(project_root_string.as_str()),
                Some(target_source_id.as_str()),
                Some(&json!({
                    "source_path": source.display().to_string(),
                    "transport": { "url": "https://mcp.example.com/sse" },
                    "enabled": true
                })),
            )
            .expect("project-private add should succeed");

        let content = fs::read_to_string(&source).expect("should read updated config");
        let value: Value = serde_json::from_str(&content).expect("output should remain valid json");
        let _ = fs::remove_dir_all(&temp_dir);

        assert!(result.target_source_id.contains("project_private"));
        assert_eq!(result.source_path, source.display().to_string());
        assert!(
            value
                .get("mcpServers")
                .and_then(Value::as_object)
                .is_some_and(|servers| !servers.contains_key("github"))
        );
        assert!(
            value
                .get("projects")
                .and_then(Value::as_object)
                .and_then(|projects| projects.get(project_root_string.as_str()))
                .and_then(Value::as_object)
                .and_then(|project| project.get("mcpServers"))
                .and_then(Value::as_object)
                .is_some_and(|servers| servers.contains_key("github"))
        );
    }

    #[test]
    fn cursor_project_shared_target_mutates_project_file() {
        let temp_dir = temp_root("cursor-project-shared");
        let project_root = temp_dir.join("workspace");
        let project_config = project_root.join(".cursor").join("mcp.json");
        let _ = fs::create_dir_all(project_config.parent().expect("project config parent"));
        fs::write(&project_config, "{}").expect("should create cursor project config");
        let project_root_string = project_root.display().to_string();

        let target_source_id = format!(
            "mcp::cursor::project_shared::{}::/mcpServers",
            project_config.display()
        );

        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = McpMutationService::new(&detector_registry);
        let result = service
            .mutate(
                ClientKind::Cursor,
                MutationAction::Add,
                "context7",
                Some(project_root_string.as_str()),
                Some(target_source_id.as_str()),
                Some(&json!({
                    "source_path": project_config.display().to_string(),
                    "transport": { "command": "context7" },
                    "enabled": true
                })),
            )
            .expect("project-shared add should succeed");

        let content =
            fs::read_to_string(&project_config).expect("should read updated project config");
        let _ = fs::remove_dir_all(&temp_dir);

        assert!(result.target_source_id.contains("project_shared"));
        assert!(content.contains("\"context7\""));
        assert!(content.contains("\"enabled\": true"));
    }

    #[test]
    fn codex_rejects_project_scoped_target_source() {
        let temp_dir = temp_root("codex-unsupported-target");
        let project_root = temp_dir.join("workspace");
        let _ = fs::create_dir_all(&project_root);
        let source = temp_dir.join("codex.toml");
        fs::write(&source, "").expect("should create codex config");
        let project_root_string = project_root.display().to_string();

        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = McpMutationService::new(&detector_registry);
        let error = service
            .mutate(
                ClientKind::Codex,
                MutationAction::Add,
                "filesystem",
                Some(project_root_string.as_str()),
                Some("mcp::codex::project_shared::/tmp/workspace/.codex/config.toml::mcp_servers"),
                Some(&json!({
                    "source_path": source.display().to_string(),
                    "transport": { "command": "npx" },
                    "enabled": true
                })),
            )
            .expect_err("unsupported codex target should fail");

        let _ = fs::remove_dir_all(&temp_dir);

        assert!(error.message.contains("unsupported scope 'project_shared'"));
    }

    #[test]
    fn malformed_transport_is_actionable_validation_error() {
        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = McpMutationService::new(&detector_registry);
        let error = service
            .mutate(
                ClientKind::Codex,
                MutationAction::Add,
                "remote",
                None,
                None,
                Some(&json!({
                    "transport": { "url": "ftp://invalid" }
                })),
            )
            .expect_err("invalid transport should fail");

        assert!(error.message.contains("http:// or https://"));
    }

    #[test]
    fn claude_rejects_enabled_false_for_schema_compatibility() {
        let temp_dir = std::env::temp_dir().join(format!(
            "ai-manager-mcp-claude-enabled-false-{}",
            std::process::id()
        ));
        let _ = fs::create_dir_all(&temp_dir);
        let source = temp_dir.join("claude.json");
        fs::write(&source, "{}").expect("should create json config");

        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = McpMutationService::new(&detector_registry);
        let error = service
            .mutate(
                ClientKind::ClaudeCode,
                MutationAction::Add,
                "filesystem",
                None,
                None,
                Some(&json!({
                    "source_path": source.display().to_string(),
                    "transport": { "command": "npx", "args": ["-y", "server"] },
                    "enabled": false
                })),
            )
            .expect_err("enabled=false should be rejected for Claude");
        let _ = fs::remove_dir_all(&temp_dir);

        assert!(error.message.contains("does not support `enabled=false`"));
    }

    fn escape_json_pointer_token(value: &str) -> String {
        value.replace('~', "~0").replace('/', "~1")
    }

    fn temp_root(suffix: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "ai-manager-mcp-mutation-{}-{}",
            std::process::id(),
            suffix
        ));
        let _ = fs::create_dir_all(&root);
        root
    }
}
