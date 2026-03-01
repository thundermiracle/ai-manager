use crate::domain::ClientKind;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParseWarning {
    pub code: &'static str,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParseError {
    pub code: &'static str,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedMcpServer {
    pub name: String,
    pub transport_kind: String,
    pub transport_command: Option<String>,
    pub transport_args: Vec<String>,
    pub transport_url: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedClientConfig {
    pub client: ClientKind,
    pub format: &'static str,
    pub mcp_servers: Vec<ParsedMcpServer>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ParseOutcome<T> {
    Success {
        data: T,
        warnings: Vec<ParseWarning>,
    },
    Failure {
        warnings: Vec<ParseWarning>,
        errors: Vec<ParseError>,
    },
}

impl<T> ParseOutcome<T> {
    pub fn warnings(&self) -> &[ParseWarning] {
        match self {
            Self::Success { warnings, .. } => warnings,
            Self::Failure { warnings, .. } => warnings,
        }
    }
}
