use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClientKind {
    ClaudeCode,
    CodexCli,
    Cursor,
    CodexApp,
}

impl ClientKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::ClaudeCode => "claude_code",
            Self::CodexCli => "codex_cli",
            Self::Cursor => "cursor",
            Self::CodexApp => "codex_app",
        }
    }
}
