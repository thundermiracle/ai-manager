use std::{collections::HashMap, fs, io};

use serde_json::{Value, json};

use crate::{
    domain::{ResourceSourceMetadata, ResourceSourceScope},
    infra::DetectorRegistry,
    infra::parsers::{ParseOutcome, ParserRegistry},
    interface::contracts::{
        common::ClientKind,
        list::{ListResourcesRequest, ResourceRecord},
    },
};

use super::source_catalog_service::{
    McpSourceCatalogService, McpSourceDescriptor, McpSourceStorageKind,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct McpListResult {
    pub items: Vec<ResourceRecord>,
    pub warning: Option<String>,
}

pub struct McpListingService<'a> {
    detector_registry: &'a DetectorRegistry,
    parser_registry: ParserRegistry,
}

impl<'a> McpListingService<'a> {
    pub fn new(detector_registry: &'a DetectorRegistry) -> Self {
        Self {
            detector_registry,
            parser_registry: ParserRegistry::new(),
        }
    }

    pub fn list(&self, request: &ListResourcesRequest) -> McpListResult {
        let source_catalog_service = McpSourceCatalogService::new(self.detector_registry);
        let descriptors = requested_clients(self.detector_registry, request.client)
            .into_iter()
            .flat_map(|client| {
                source_catalog_service.list_sources(client, request.project_root.as_deref())
            })
            .collect::<Vec<_>>();

        collect_from_descriptors(&self.parser_registry, descriptors, request, |path| {
            fs::read_to_string(path)
        })
    }
}

fn requested_clients(
    detector_registry: &DetectorRegistry,
    client_filter: Option<ClientKind>,
) -> Vec<ClientKind> {
    match client_filter {
        Some(client) => vec![client],
        None => detector_registry
            .all()
            .map(|detector| detector.client_kind())
            .collect(),
    }
}

fn collect_from_descriptors<I, F>(
    parser_registry: &ParserRegistry,
    descriptors: I,
    request: &ListResourcesRequest,
    read_source: F,
) -> McpListResult
where
    I: IntoIterator<Item = McpSourceDescriptor>,
    F: Fn(&str) -> io::Result<String>,
{
    let mut items: Vec<ResourceRecord> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();
    for descriptor in descriptors {
        if request
            .scope_filter
            .as_ref()
            .is_some_and(|scopes| !scopes.contains(&descriptor.source_scope))
        {
            continue;
        }

        let source = match read_source(&descriptor.container_path.display().to_string()) {
            Ok(source) => source,
            Err(error) => {
                if error.kind() == io::ErrorKind::NotFound {
                    continue;
                }
                warnings.push(format!(
                    "[{}:CONFIG_READ] failed to read '{}': {}",
                    descriptor.client.as_str(),
                    descriptor.container_path.display(),
                    error
                ));
                continue;
            }
        };

        let Some(parse_input) = (match build_parse_input(&descriptor, &source) {
            Ok(parse_input) => parse_input,
            Err(error) => {
                let warning_code = if error.starts_with("Invalid JSON payload:") {
                    "PARSER_JSON_SYNTAX"
                } else {
                    "CONFIG_SECTION_INVALID"
                };
                warnings.push(format!(
                    "[{}:{}] failed to resolve '{}' in '{}': {}",
                    descriptor.client.as_str(),
                    warning_code,
                    descriptor.selector,
                    descriptor.container_path.display(),
                    error
                ));
                continue;
            }
        }) else {
            continue;
        };

        let parse_outcome = parser_registry.parse_client_config(descriptor.client, &parse_input);
        for warning in parse_outcome.warnings() {
            warnings.push(format!(
                "[{}:{}] {}",
                descriptor.client.as_str(),
                warning.code,
                warning.message
            ));
        }

        match parse_outcome {
            ParseOutcome::Success { data, .. } => {
                for server in data.mcp_servers {
                    if let Some(enabled_filter) = request.enabled
                        && server.enabled != enabled_filter
                    {
                        continue;
                    }

                    let logical_id = server.name.clone();
                    items.push(
                        ResourceRecord {
                            id: format!(
                                "{}::mcp::{}::{}",
                                descriptor.client.as_str(),
                                descriptor.source_id,
                                logical_id
                            ),
                            logical_id,
                            client: descriptor.client,
                            display_name: server.name,
                            enabled: server.enabled,
                            transport_kind: Some(server.transport_kind),
                            transport_command: server.transport_command,
                            transport_args: Some(server.transport_args),
                            transport_url: server.transport_url,
                            source_path: Some(descriptor.container_path.display().to_string()),
                            source_id: String::new(),
                            source_scope: descriptor.source_scope,
                            source_label: String::new(),
                            is_effective: true,
                            shadowed_by: None,
                            description: None,
                            install_kind: None,
                            manifest_content: None,
                        }
                        .with_source_metadata(ResourceSourceMetadata {
                            source_id: descriptor.source_id.clone(),
                            source_scope: descriptor.source_scope,
                            source_label: descriptor.source_label.clone(),
                            is_effective: true,
                            shadowed_by: None,
                        }),
                    );
                }
            }
            ParseOutcome::Failure { errors, .. } => {
                for error in errors {
                    warnings.push(format!(
                        "[{}:{}] {}",
                        descriptor.client.as_str(),
                        error.code,
                        error.message
                    ));
                }
            }
        }
    }

    apply_effective_precedence(&mut items);
    if !matches!(
        request.view_mode,
        crate::interface::contracts::list::ResourceViewMode::AllSources
    ) {
        items.retain(|item| item.is_effective);
    }

    items.sort_by(|left, right| {
        (
            left.client.as_str(),
            left.display_name.as_str(),
            left.id.as_str(),
        )
            .cmp(&(
                right.client.as_str(),
                right.display_name.as_str(),
                right.id.as_str(),
            ))
    });

    McpListResult {
        items,
        warning: (!warnings.is_empty()).then(|| warnings.join(" | ")),
    }
}

fn build_parse_input(
    descriptor: &McpSourceDescriptor,
    source: &str,
) -> Result<Option<String>, String> {
    match descriptor.storage_kind {
        McpSourceStorageKind::JsonSection => select_json_mcp_section(source, &descriptor.selector),
        McpSourceStorageKind::TomlTable => Ok(Some(source.to_string())),
    }
}

fn select_json_mcp_section(source: &str, selector: &str) -> Result<Option<String>, String> {
    let parsed = serde_json::from_str::<Value>(source)
        .map_err(|error| format!("Invalid JSON payload: {error}"))?;
    let Some(section) = parsed.pointer(selector) else {
        return Ok(None);
    };
    let Some(section_object) = section.as_object() else {
        return Err("Selected MCP section must be an object map.".to_string());
    };

    let synthetic_root = json!({
        "mcpServers": Value::Object(section_object.clone())
    });

    Ok(Some(synthetic_root.to_string()))
}

fn apply_effective_precedence(items: &mut [ResourceRecord]) {
    let mut indices_by_resource: HashMap<(String, String), Vec<usize>> = HashMap::new();

    for (index, item) in items.iter().enumerate() {
        indices_by_resource
            .entry((item.client.as_str().to_string(), item.logical_id.clone()))
            .or_default()
            .push(index);
    }

    for indices in indices_by_resource.values() {
        let Some((&winner_index, rest)) = indices.split_first() else {
            continue;
        };

        let winner_index = rest
            .iter()
            .copied()
            .fold(winner_index, |current, candidate| {
                if precedence_key(&items[candidate]) < precedence_key(&items[current]) {
                    candidate
                } else {
                    current
                }
            });

        let winner_id = items[winner_index].id.clone();
        for index in indices {
            let item = &mut items[*index];
            item.is_effective = *index == winner_index;
            item.shadowed_by = (*index != winner_index).then(|| winner_id.clone());
        }
    }
}

fn precedence_key(item: &ResourceRecord) -> (u8, &str, &str) {
    (
        precedence_rank(item.client, item.source_scope),
        item.source_id.as_str(),
        item.id.as_str(),
    )
}

fn precedence_rank(client: ClientKind, scope: ResourceSourceScope) -> u8 {
    match client {
        ClientKind::ClaudeCode => match scope {
            ResourceSourceScope::ProjectPrivate => 0,
            ResourceSourceScope::ProjectShared => 1,
            ResourceSourceScope::User => 2,
        },
        ClientKind::Cursor => match scope {
            ResourceSourceScope::ProjectShared => 0,
            ResourceSourceScope::User => 1,
            ResourceSourceScope::ProjectPrivate => 2,
        },
        ClientKind::Codex => 0,
    }
}

#[cfg(test)]
mod tests {
    use std::{collections::HashMap, io};

    use crate::McpSourceDescriptor;
    use crate::McpSourceStorageKind;
    use crate::infra::detection::ClientDetector;
    use crate::interface::contracts::{
        common::{ClientKind, ResourceKind},
        detect::{ClientDetection, DetectClientsRequest},
        list::{ListResourcesRequest, ResourceViewMode},
    };
    use crate::{
        domain::ResourceSourceScope,
        infra::{DetectorRegistry, parsers::ParserRegistry},
    };

    use super::{collect_from_descriptors, requested_clients};

    #[test]
    fn unified_mcp_listing_normalizes_entries_from_multiple_clients() {
        let descriptors = vec![
            descriptor(
                ClientKind::ClaudeCode,
                ResourceSourceScope::User,
                "/fixtures/claude.json",
            ),
            descriptor(
                ClientKind::Codex,
                ResourceSourceScope::User,
                "/fixtures/codex.toml",
            ),
            descriptor(
                ClientKind::Cursor,
                ResourceSourceScope::User,
                "/fixtures/cursor.json",
            ),
        ];

        let fixtures: HashMap<&str, &str> = HashMap::from([
            (
                "/fixtures/claude.json",
                r#"{
  "mcpServers": {
    "filesystem": { "command": "npx", "enabled": true },
    "github": { "url": "https://mcp.example.com/sse", "enabled": false }
  }
}"#,
            ),
            (
                "/fixtures/codex.toml",
                r#"[mcp_servers.filesystem]
command = "npx"
enabled = true

[mcp_servers.github]
url = "https://mcp.example.com/sse"
enabled = false
"#,
            ),
            (
                "/fixtures/cursor.json",
                r#"{
  "mcpServers": {
    "context7": { "command": "context7", "enabled": true }
  }
}"#,
            ),
        ]);

        let request = ListResourcesRequest {
            client: None,
            resource_kind: ResourceKind::Mcp,
            enabled: None,
            project_root: None,
            view_mode: ResourceViewMode::Effective,
            scope_filter: None,
        };

        let result =
            collect_from_descriptors(&ParserRegistry::new(), descriptors, &request, |path| {
                match fixtures.get(path) {
                    Some(payload) => Ok((*payload).to_string()),
                    None => Err(io::Error::new(
                        io::ErrorKind::NotFound,
                        format!("missing fixture: {path}"),
                    )),
                }
            });

        assert_eq!(result.items.len(), 5);
        assert!(result.warning.is_none());
        assert!(result.items.iter().all(|entry| {
            entry.source_path.is_some()
                && entry.transport_kind.is_some()
                && !entry.source_id.is_empty()
                && entry.is_effective
        }));
        assert!(
            result
                .items
                .iter()
                .any(|entry| entry.logical_id == "filesystem"
                    && entry.source_scope == ResourceSourceScope::User)
        );
        assert!(
            result
                .items
                .iter()
                .any(|entry| entry.logical_id == "github")
        );
    }

    #[test]
    fn listing_filters_by_client_and_enabled_state() {
        let descriptors = vec![
            descriptor(
                ClientKind::Codex,
                ResourceSourceScope::User,
                "/fixtures/codex.toml",
            ),
            descriptor(
                ClientKind::Cursor,
                ResourceSourceScope::User,
                "/fixtures/cursor.json",
            ),
        ];

        let fixtures: HashMap<&str, &str> = HashMap::from([
            (
                "/fixtures/codex.toml",
                r#"[mcp_servers.filesystem]
command = "npx"
enabled = true

[mcp_servers.github]
url = "https://mcp.example.com/sse"
enabled = false
"#,
            ),
            (
                "/fixtures/cursor.json",
                r#"{
  "mcpServers": {
    "context7": { "command": "context7", "enabled": true }
  }
}"#,
            ),
        ]);

        let request = ListResourcesRequest {
            client: Some(ClientKind::Codex),
            resource_kind: ResourceKind::Mcp,
            enabled: Some(false),
            project_root: None,
            view_mode: ResourceViewMode::Effective,
            scope_filter: None,
        };

        let result =
            collect_from_descriptors(&ParserRegistry::new(), descriptors, &request, |path| {
                match fixtures.get(path) {
                    Some(payload) => Ok((*payload).to_string()),
                    None => Err(io::Error::new(
                        io::ErrorKind::NotFound,
                        format!("missing fixture: {path}"),
                    )),
                }
            });

        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].client, ClientKind::Codex);
        assert_eq!(result.items[0].display_name, "github");
        assert!(!result.items[0].enabled);
    }

    #[test]
    fn parse_errors_do_not_fail_whole_listing() {
        let descriptors = vec![
            descriptor(
                ClientKind::Cursor,
                ResourceSourceScope::User,
                "/fixtures/broken-cursor.json",
            ),
            descriptor(
                ClientKind::Codex,
                ResourceSourceScope::User,
                "/fixtures/codex.toml",
            ),
        ];

        let fixtures: HashMap<&str, &str> = HashMap::from([
            (
                "/fixtures/broken-cursor.json",
                r#"{
  "mcpServers": {
    "broken": {
      "command": "npx"
    }
"#,
            ),
            (
                "/fixtures/codex.toml",
                r#"[mcp_servers.github]
url = "https://mcp.example.com/sse"
enabled = true
"#,
            ),
        ]);

        let request = ListResourcesRequest {
            client: None,
            resource_kind: ResourceKind::Mcp,
            enabled: None,
            project_root: None,
            view_mode: ResourceViewMode::Effective,
            scope_filter: None,
        };

        let result =
            collect_from_descriptors(&ParserRegistry::new(), descriptors, &request, |path| {
                match fixtures.get(path) {
                    Some(payload) => Ok((*payload).to_string()),
                    None => Err(io::Error::new(
                        io::ErrorKind::NotFound,
                        format!("missing fixture: {path}"),
                    )),
                }
            });

        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].client, ClientKind::Codex);
        assert!(
            result
                .warning
                .as_deref()
                .is_some_and(|warning| warning.contains("PARSER_JSON_SYNTAX"))
        );
    }

    #[test]
    fn project_scoped_sources_affect_effective_listing_and_shadowing() {
        let project_root = "/fixtures/workspace";
        let descriptors = vec![
            descriptor(
                ClientKind::ClaudeCode,
                ResourceSourceScope::User,
                "/fixtures/claude.json",
            ),
            descriptor(
                ClientKind::ClaudeCode,
                ResourceSourceScope::ProjectShared,
                "/fixtures/workspace/.mcp.json",
            ),
            McpSourceDescriptor {
                client: ClientKind::ClaudeCode,
                source_id: format!(
                    "mcp::claude_code::project_private::/fixtures/claude.json::/projects/{}/mcpServers",
                    project_root.replace('/', "~1")
                ),
                source_scope: ResourceSourceScope::ProjectPrivate,
                source_label: "Project private config".to_string(),
                container_path: "/fixtures/claude.json".into(),
                selector: format!("/projects/{}/mcpServers", project_root.replace('/', "~1")),
                storage_kind: McpSourceStorageKind::JsonSection,
                project_root: Some(project_root.to_string()),
            },
        ];

        let fixtures: HashMap<&str, &str> = HashMap::from([
            (
                "/fixtures/claude.json",
                r#"{
  "mcpServers": {
    "filesystem": { "command": "npx", "enabled": true }
  },
  "projects": {
    "/fixtures/workspace": {
      "mcpServers": {
        "github": { "url": "https://mcp.example.com/sse", "enabled": true }
      }
    }
  }
}"#,
            ),
            (
                "/fixtures/workspace/.mcp.json",
                r#"{
  "mcpServers": {
    "filesystem": { "command": "uvx", "enabled": true }
  }
}"#,
            ),
        ]);

        let request = ListResourcesRequest {
            client: Some(ClientKind::ClaudeCode),
            resource_kind: ResourceKind::Mcp,
            enabled: None,
            project_root: Some(project_root.to_string()),
            view_mode: ResourceViewMode::AllSources,
            scope_filter: None,
        };

        let result =
            collect_from_descriptors(&ParserRegistry::new(), descriptors, &request, |path| {
                match fixtures.get(path) {
                    Some(payload) => Ok((*payload).to_string()),
                    None => Err(io::Error::new(
                        io::ErrorKind::NotFound,
                        format!("missing fixture: {path}"),
                    )),
                }
            });

        assert_eq!(result.items.len(), 3);
        let filesystem_entries = result
            .items
            .iter()
            .filter(|entry| entry.logical_id == "filesystem")
            .collect::<Vec<_>>();
        assert_eq!(filesystem_entries.len(), 2);
        assert!(filesystem_entries.iter().any(|entry| {
            entry.source_scope == ResourceSourceScope::ProjectShared && entry.is_effective
        }));
        assert!(filesystem_entries.iter().any(|entry| {
            entry.source_scope == ResourceSourceScope::User
                && !entry.is_effective
                && entry.shadowed_by.is_some()
        }));
        assert!(result.items.iter().any(|entry| {
            entry.logical_id == "github"
                && entry.source_scope == ResourceSourceScope::ProjectPrivate
                && entry.is_effective
        }));

        let effective_result = collect_from_descriptors(
            &ParserRegistry::new(),
            vec![
                descriptor(
                    ClientKind::ClaudeCode,
                    ResourceSourceScope::User,
                    "/fixtures/claude.json",
                ),
                descriptor(
                    ClientKind::ClaudeCode,
                    ResourceSourceScope::ProjectShared,
                    "/fixtures/workspace/.mcp.json",
                ),
                McpSourceDescriptor {
                    client: ClientKind::ClaudeCode,
                    source_id: format!(
                        "mcp::claude_code::project_private::/fixtures/claude.json::/projects/{}/mcpServers",
                        project_root.replace('/', "~1")
                    ),
                    source_scope: ResourceSourceScope::ProjectPrivate,
                    source_label: "Project private config".to_string(),
                    container_path: "/fixtures/claude.json".into(),
                    selector: format!("/projects/{}/mcpServers", project_root.replace('/', "~1")),
                    storage_kind: McpSourceStorageKind::JsonSection,
                    project_root: Some(project_root.to_string()),
                },
            ],
            &ListResourcesRequest {
                view_mode: ResourceViewMode::Effective,
                ..request.clone()
            },
            |path| match fixtures.get(path) {
                Some(payload) => Ok((*payload).to_string()),
                None => Err(io::Error::new(
                    io::ErrorKind::NotFound,
                    format!("missing fixture: {path}"),
                )),
            },
        );

        assert_eq!(effective_result.items.len(), 2);
        assert!(
            effective_result
                .items
                .iter()
                .all(|entry| entry.is_effective)
        );

        let scoped_result = collect_from_descriptors(
            &ParserRegistry::new(),
            vec![
                descriptor(
                    ClientKind::ClaudeCode,
                    ResourceSourceScope::User,
                    "/fixtures/claude.json",
                ),
                descriptor(
                    ClientKind::ClaudeCode,
                    ResourceSourceScope::ProjectShared,
                    "/fixtures/workspace/.mcp.json",
                ),
                McpSourceDescriptor {
                    client: ClientKind::ClaudeCode,
                    source_id: format!(
                        "mcp::claude_code::project_private::/fixtures/claude.json::/projects/{}/mcpServers",
                        project_root.replace('/', "~1")
                    ),
                    source_scope: ResourceSourceScope::ProjectPrivate,
                    source_label: "Project private config".to_string(),
                    container_path: "/fixtures/claude.json".into(),
                    selector: format!("/projects/{}/mcpServers", project_root.replace('/', "~1")),
                    storage_kind: McpSourceStorageKind::JsonSection,
                    project_root: Some(project_root.to_string()),
                },
            ],
            &ListResourcesRequest {
                scope_filter: Some(vec![ResourceSourceScope::ProjectShared]),
                ..request
            },
            |path| match fixtures.get(path) {
                Some(payload) => Ok((*payload).to_string()),
                None => Err(io::Error::new(
                    io::ErrorKind::NotFound,
                    format!("missing fixture: {path}"),
                )),
            },
        );

        assert_eq!(scoped_result.items.len(), 1);
        assert_eq!(
            scoped_result.items[0].source_scope,
            ResourceSourceScope::ProjectShared
        );
    }

    #[test]
    fn requested_clients_uses_registry_client_kinds_without_running_detection() {
        let registry = DetectorRegistry::from_detectors(vec![
            Box::new(PanickingDetector(ClientKind::ClaudeCode)),
            Box::new(PanickingDetector(ClientKind::Cursor)),
        ]);

        let clients = requested_clients(&registry, None);

        assert_eq!(clients, vec![ClientKind::ClaudeCode, ClientKind::Cursor]);
    }

    fn descriptor(
        client: ClientKind,
        source_scope: ResourceSourceScope,
        path: &str,
    ) -> McpSourceDescriptor {
        let selector = if matches!(client, ClientKind::Codex) {
            "mcp_servers".to_string()
        } else {
            "/mcpServers".to_string()
        };

        McpSourceDescriptor {
            client,
            source_id: format!(
                "mcp::{}::{}::{}::{}",
                client.as_str(),
                source_scope.as_str(),
                path,
                selector
            ),
            source_scope,
            source_label: match source_scope {
                ResourceSourceScope::User => "Personal config",
                ResourceSourceScope::ProjectShared => "Project config",
                ResourceSourceScope::ProjectPrivate => "Project private config",
            }
            .to_string(),
            container_path: path.into(),
            selector,
            storage_kind: if matches!(client, ClientKind::Codex) {
                McpSourceStorageKind::TomlTable
            } else {
                McpSourceStorageKind::JsonSection
            },
            project_root: None,
        }
    }

    struct PanickingDetector(ClientKind);

    impl ClientDetector for PanickingDetector {
        fn client_kind(&self) -> ClientKind {
            self.0
        }

        fn detect(&self, _request: &DetectClientsRequest) -> ClientDetection {
            panic!("requested_clients should not invoke detector.detect()");
        }
    }
}
