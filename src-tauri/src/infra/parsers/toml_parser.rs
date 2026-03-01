use crate::domain::ClientKind;

use super::{
    ClientConfigParser, ParseError, ParseOutcome, ParseWarning, ParsedClientConfig, ParsedMcpServer,
};

pub struct TomlClientConfigParser {
    client_kind: ClientKind,
}

impl TomlClientConfigParser {
    pub fn new(client_kind: ClientKind) -> Self {
        Self { client_kind }
    }
}

impl ClientConfigParser for TomlClientConfigParser {
    fn client_kind(&self) -> ClientKind {
        self.client_kind
    }

    fn parse(&self, source: &str) -> ParseOutcome<ParsedClientConfig> {
        let parsed_table = match toml::from_str::<toml::Table>(source) {
            Ok(table) => table,
            Err(error) => {
                return ParseOutcome::Failure {
                    warnings: Vec::new(),
                    errors: vec![ParseError {
                        code: "PARSER_TOML_SYNTAX",
                        message: format!("Invalid TOML payload: {error}"),
                    }],
                };
            }
        };

        let mut warnings: Vec<ParseWarning> = Vec::new();
        let mut servers: Vec<ParsedMcpServer> = Vec::new();

        let mcp_servers = parsed_table
            .get("mcp_servers")
            .or_else(|| parsed_table.get("mcpServers"));

        let Some(mcp_servers) = mcp_servers else {
            warnings.push(ParseWarning {
                code: "PARSER_MCP_SECTION_MISSING",
                message: "No MCP section (`mcp_servers` or `mcpServers`) was found.".to_string(),
            });

            return ParseOutcome::Success {
                data: ParsedClientConfig {
                    client: self.client_kind,
                    format: "toml",
                    mcp_servers: servers,
                },
                warnings,
            };
        };

        let Some(mcp_server_map) = mcp_servers.as_table() else {
            warnings.push(ParseWarning {
                code: "PARSER_MCP_SECTION_INVALID",
                message: "MCP section exists but is not a table map.".to_string(),
            });

            return ParseOutcome::Success {
                data: ParsedClientConfig {
                    client: self.client_kind,
                    format: "toml",
                    mcp_servers: servers,
                },
                warnings,
            };
        };

        for (server_name, server_payload) in mcp_server_map {
            let Some(server_table) = server_payload.as_table() else {
                warnings.push(ParseWarning {
                    code: "PARSER_SERVER_ENTRY_INVALID",
                    message: format!(
                        "Server `{server_name}` entry is not a table and was skipped."
                    ),
                });
                continue;
            };

            let command = server_table
                .get("command")
                .and_then(toml::Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty());
            let url = server_table
                .get("url")
                .and_then(toml::Value::as_str)
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

            let enabled = server_table
                .get("enabled")
                .and_then(toml::Value::as_bool)
                .unwrap_or(true);

            let transport_args = if transport_kind == "stdio" {
                server_table
                    .get("args")
                    .and_then(toml::Value::as_array)
                    .map(|args| {
                        args.iter()
                            .filter_map(toml::Value::as_str)
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
                format: "toml",
                mcp_servers: servers,
            },
            warnings,
        }
    }
}
