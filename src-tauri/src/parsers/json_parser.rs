use serde_json::Value;

use crate::contracts::common::ClientKind;

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

        let mcp_servers = parsed_value
            .get("mcpServers")
            .or_else(|| parsed_value.get("mcp_servers"));

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

            let transport_kind = if server_object
                .get("command")
                .and_then(Value::as_str)
                .is_some()
            {
                Some("stdio")
            } else if server_object.get("url").and_then(Value::as_str).is_some() {
                Some("sse")
            } else {
                None
            };

            let Some(transport_kind) = transport_kind else {
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

            servers.push(ParsedMcpServer {
                name: server_name.to_string(),
                transport_kind: transport_kind.to_string(),
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
