use crate::domain::ClientKind;

use super::{
    ClientConfigParser, ParseError, ParseOutcome, ParsedClientConfig,
    json_parser::JsonClientConfigParser, toml_parser::TomlClientConfigParser,
};

pub struct ParserRegistry;

impl ParserRegistry {
    pub fn new() -> Self {
        Self
    }

    pub fn parse_client_config(
        &self,
        client_kind: ClientKind,
        source: &str,
    ) -> ParseOutcome<ParsedClientConfig> {
        let parser = self.parser_for_client(client_kind);

        if parser.client_kind() != client_kind {
            return ParseOutcome::Failure {
                warnings: Vec::new(),
                errors: vec![ParseError {
                    code: "PARSER_CLIENT_MISMATCH",
                    message: format!(
                        "Parser client mismatch: expected '{}', parser returned '{}'.",
                        client_kind.as_str(),
                        parser.client_kind().as_str()
                    ),
                }],
            };
        }

        parser.parse(source)
    }

    fn parser_for_client(&self, client_kind: ClientKind) -> Box<dyn ClientConfigParser> {
        match client_kind {
            ClientKind::CodexCli => Box::new(TomlClientConfigParser::new(client_kind)),
            ClientKind::ClaudeCode | ClientKind::Cursor | ClientKind::CodexApp => {
                Box::new(JsonClientConfigParser::new(client_kind))
            }
        }
    }
}

impl Default for ParserRegistry {
    fn default() -> Self {
        Self::new()
    }
}
