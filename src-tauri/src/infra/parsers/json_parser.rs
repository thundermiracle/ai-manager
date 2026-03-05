use serde_json::Value;

use crate::domain::ClientKind;

use super::{
    ClientConfigParser, ParseError, ParseOutcome, ParseWarning, ParsedClientConfig, ParsedMcpServer,
};

pub struct JsonClientConfigParser {
    client_kind: ClientKind,
}

impl JsonClientConfigParser {
    pub fn new(client_kind: ClientKind) -> Self {
        Self { client_kind }
    }
}

impl ClientConfigParser for JsonClientConfigParser {
    fn client_kind(&self) -> ClientKind {
        self.client_kind
    }

    fn parse(&self, source: &str) -> ParseOutcome<ParsedClientConfig> {
        let parsed_value = match serde_json::from_str::<Value>(source) {
            Ok(value) => value,
            Err(error) => {
                return ParseOutcome::Failure {
                    warnings: Vec::new(),
                    errors: vec![ParseError {
                        code: "PARSER_JSON_SYNTAX",
                        message: format!("Invalid JSON payload: {error}"),
                    }],
                };
            }
        };

        let mut warnings: Vec<ParseWarning> = Vec::new();
        let mut servers: Vec<ParsedMcpServer> = Vec::new();

        let mcp_servers = resolve_mcp_servers_section(self.client_kind, &parsed_value);

        let Some(mcp_servers) = mcp_servers else {
            warnings.push(ParseWarning {
                code: "PARSER_MCP_SECTION_MISSING",
                message: "No MCP section (`mcpServers` or `mcp_servers`) was found.".to_string(),
            });

            return ParseOutcome::Success {
                data: ParsedClientConfig {
                    client: self.client_kind,
                    format: "json",
                    mcp_servers: servers,
                },
                warnings,
            };
        };

        let Some(mcp_server_map) = mcp_servers.as_object() else {
            warnings.push(ParseWarning {
                code: "PARSER_MCP_SECTION_INVALID",
                message: "MCP section exists but is not an object map.".to_string(),
            });

            return ParseOutcome::Success {
                data: ParsedClientConfig {
                    client: self.client_kind,
                    format: "json",
                    mcp_servers: servers,
                },
                warnings,
            };
        };

        for (server_name, server_payload) in mcp_server_map {
            let Some(server_object) = server_payload.as_object() else {
                warnings.push(ParseWarning {
                    code: "PARSER_SERVER_ENTRY_INVALID",
                    message: format!(
                        "Server `{server_name}` entry is not an object and was skipped."
                    ),
                });
                continue;
            };

            let command = server_object
                .get("command")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty());
            let url = server_object
                .get("url")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty());

            let Some(transport_kind) = command.map(|_| "stdio").or_else(|| url.map(|_| "sse"))
            else {
                warnings.push(ParseWarning {
                    code: "PARSER_SERVER_TRANSPORT_MISSING",
                    message: format!(
                        "Server `{server_name}` has no supported transport fields (`command` or `url`)."
                    ),
                });
                continue;
            };

            let enabled = server_object
                .get("enabled")
                .and_then(Value::as_bool)
                .unwrap_or(true);

            let transport_args = if transport_kind == "stdio" {
                server_object
                    .get("args")
                    .and_then(Value::as_array)
                    .map(|args| {
                        args.iter()
                            .filter_map(Value::as_str)
                            .map(str::to_string)
                            .collect()
                    })
                    .unwrap_or_default()
            } else {
                Vec::new()
            };

            servers.push(ParsedMcpServer {
                name: server_name.to_string(),
                transport_kind: transport_kind.to_string(),
                transport_command: command.map(str::to_string),
                transport_args,
                transport_url: url.map(str::to_string),
                enabled,
            });
        }

        ParseOutcome::Success {
            data: ParsedClientConfig {
                client: self.client_kind,
                format: "json",
                mcp_servers: servers,
            },
            warnings,
        }
    }
}

fn resolve_mcp_servers_section<'a>(
    _client_kind: ClientKind,
    parsed_value: &'a Value,
) -> Option<&'a Value> {
    resolve_root_mcp_servers(parsed_value)
}

fn resolve_root_mcp_servers(parsed_value: &Value) -> Option<&Value> {
    parsed_value
        .get("mcpServers")
        .or_else(|| parsed_value.get("mcp_servers"))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use crate::domain::ClientKind;

    use super::{JsonClientConfigParser, ParseOutcome};
    use crate::infra::parsers::ClientConfigParser;

    #[test]
    fn claude_parser_ignores_project_scoped_mcp_servers_without_root_section() {
        let cwd = std::env::current_dir()
            .expect("current directory should be available")
            .to_string_lossy()
            .to_string();
        let source = json!({
            "projects": {
                cwd: {
                    "mcpServers": {
                        "filesystem": {
                            "command": "npx",
                            "args": ["-y", "server"],
                            "enabled": true
                        }
                    }
                }
            }
        })
        .to_string();

        let parser = JsonClientConfigParser::new(ClientKind::ClaudeCode);
        let ParseOutcome::Success { data, warnings } = parser.parse(&source) else {
            panic!("Claude config without root section should parse as empty result");
        };

        assert!(data.mcp_servers.is_empty());
        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0].code, "PARSER_MCP_SECTION_MISSING");
    }
}
