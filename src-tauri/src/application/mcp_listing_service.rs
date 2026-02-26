use std::fs;

use crate::{
    contracts::{
        detect::{ClientDetection, DetectClientsRequest},
        list::{ListResourcesRequest, ResourceRecord},
    },
    detection::DetectorRegistry,
    parsers::{ParseOutcome, ParserRegistry},
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
        let detect_request = DetectClientsRequest {
            include_versions: false,
        };
        let detections = self
            .detector_registry
            .all()
            .map(|detector| detector.detect(&detect_request));

        collect_from_detections(&self.parser_registry, detections, request, |path| {
            fs::read_to_string(path).map_err(|error| error.to_string())
        })
    }
}

fn collect_from_detections<I, F>(
    parser_registry: &ParserRegistry,
    detections: I,
    request: &ListResourcesRequest,
    read_source: F,
) -> McpListResult
where
    I: IntoIterator<Item = ClientDetection>,
    F: Fn(&str) -> Result<String, String>,
{
    let mut items: Vec<ResourceRecord> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();

    for detection in detections {
        let client = detection.client;

        if let Some(client_filter) = request.client
            && client != client_filter
        {
            continue;
        }

        let Some(config_path) = detection.evidence.config_path.as_deref() else {
            continue;
        };

        let source = match read_source(config_path) {
            Ok(source) => source,
            Err(error) => {
                warnings.push(format!(
                    "[{}:CONFIG_READ] failed to read '{}': {}",
                    client.as_str(),
                    config_path,
                    error
                ));
                continue;
            }
        };

        match parser_registry.parse_client_config(client, &source) {
            ParseOutcome::Success {
                data,
                warnings: parse_warnings,
            } => {
                for warning in parse_warnings {
                    warnings.push(format!(
                        "[{}:{}] {}",
                        client.as_str(),
                        warning.code,
                        warning.message
                    ));
                }

                for server in data.mcp_servers {
                    if let Some(enabled_filter) = request.enabled
                        && server.enabled != enabled_filter
                    {
                        continue;
                    }

                    items.push(ResourceRecord {
                        id: format!("{}::{}", client.as_str(), server.name),
                        client,
                        display_name: server.name,
                        enabled: server.enabled,
                        transport_kind: Some(server.transport_kind),
                        source_path: Some(config_path.to_string()),
                        description: None,
                        install_kind: None,
                    });
                }
            }
            ParseOutcome::Failure {
                warnings: parse_warnings,
                errors,
            } => {
                for warning in parse_warnings {
                    warnings.push(format!(
                        "[{}:{}] {}",
                        client.as_str(),
                        warning.code,
                        warning.message
                    ));
                }

                for error in errors {
                    warnings.push(format!(
                        "[{}:{}] {}",
                        client.as_str(),
                        error.code,
                        error.message
                    ));
                }
            }
        }
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

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::contracts::{
        common::{ClientKind, ResourceKind},
        detect::{ClientDetection, DetectionEvidence, DetectionStatus},
        list::ListResourcesRequest,
    };
    use crate::parsers::ParserRegistry;

    use super::collect_from_detections;

    #[test]
    fn unified_mcp_listing_normalizes_entries_from_multiple_clients() {
        let detections = vec![
            detection(ClientKind::ClaudeCode, Some("/fixtures/claude.json")),
            detection(ClientKind::CodexCli, Some("/fixtures/codex.toml")),
            detection(ClientKind::Cursor, Some("/fixtures/cursor.json")),
            detection(ClientKind::CodexApp, Some("/fixtures/codex-app.json")),
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
            (
                "/fixtures/codex-app.json",
                r#"{
  "mcpServers": {
    "notion": { "url": "https://codex-app.example.com/sse", "enabled": true }
  }
}"#,
            ),
        ]);

        let request = ListResourcesRequest {
            client: None,
            resource_kind: ResourceKind::Mcp,
            enabled: None,
        };

        let result =
            collect_from_detections(&ParserRegistry::new(), detections, &request, |path| {
                match fixtures.get(path) {
                    Some(payload) => Ok((*payload).to_string()),
                    None => Err(format!("missing fixture: {path}")),
                }
            });

        assert_eq!(result.items.len(), 6);
        assert!(result.warning.is_none());
        assert!(
            result
                .items
                .iter()
                .all(|entry| entry.source_path.is_some() && entry.transport_kind.is_some())
        );
        assert!(
            result
                .items
                .iter()
                .any(|entry| entry.id == "claude_code::filesystem")
        );
        assert!(
            result
                .items
                .iter()
                .any(|entry| entry.id == "codex_cli::github")
        );
    }

    #[test]
    fn listing_filters_by_client_and_enabled_state() {
        let detections = vec![
            detection(ClientKind::CodexCli, Some("/fixtures/codex.toml")),
            detection(ClientKind::Cursor, Some("/fixtures/cursor.json")),
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
            client: Some(ClientKind::CodexCli),
            resource_kind: ResourceKind::Mcp,
            enabled: Some(false),
        };

        let result =
            collect_from_detections(&ParserRegistry::new(), detections, &request, |path| {
                match fixtures.get(path) {
                    Some(payload) => Ok((*payload).to_string()),
                    None => Err(format!("missing fixture: {path}")),
                }
            });

        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].client, ClientKind::CodexCli);
        assert_eq!(result.items[0].display_name, "github");
        assert!(!result.items[0].enabled);
    }

    #[test]
    fn parse_errors_do_not_fail_whole_listing() {
        let detections = vec![
            detection(ClientKind::Cursor, Some("/fixtures/broken-cursor.json")),
            detection(ClientKind::CodexApp, Some("/fixtures/codex-app.json")),
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
                "/fixtures/codex-app.json",
                r#"{
  "mcpServers": {
    "notion": { "url": "https://codex-app.example.com/sse", "enabled": true }
  }
}"#,
            ),
        ]);

        let request = ListResourcesRequest {
            client: None,
            resource_kind: ResourceKind::Mcp,
            enabled: None,
        };

        let result =
            collect_from_detections(&ParserRegistry::new(), detections, &request, |path| {
                match fixtures.get(path) {
                    Some(payload) => Ok((*payload).to_string()),
                    None => Err(format!("missing fixture: {path}")),
                }
            });

        assert_eq!(result.items.len(), 1);
        assert_eq!(result.items[0].client, ClientKind::CodexApp);
        assert!(
            result
                .warning
                .as_deref()
                .is_some_and(|warning| warning.contains("PARSER_JSON_SYNTAX"))
        );
    }

    fn detection(client: ClientKind, config_path: Option<&str>) -> ClientDetection {
        ClientDetection {
            client,
            status: DetectionStatus::Detected,
            confidence: 100,
            evidence: DetectionEvidence {
                binary_path: None,
                config_path: config_path.map(str::to_string),
                version: None,
            },
            note: String::new(),
        }
    }
}
