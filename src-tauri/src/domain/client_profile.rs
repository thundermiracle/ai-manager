use super::ClientKind;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ClientCapabilities {
    pub supports_mcp: bool,
    pub supports_skills: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ClientProfile {
    pub kind: ClientKind,
    pub key: &'static str,
    pub display_name: &'static str,
    pub capabilities: ClientCapabilities,
}

pub const CLAUDE_CODE_PROFILE: ClientProfile = ClientProfile {
    kind: ClientKind::ClaudeCode,
    key: "claude_code",
    display_name: "Claude Code",
    capabilities: ClientCapabilities {
        supports_mcp: true,
        supports_skills: true,
    },
};

pub const CODEX_CLI_PROFILE: ClientProfile = ClientProfile {
    kind: ClientKind::CodexCli,
    key: "codex_cli",
    display_name: "Codex CLI",
    capabilities: ClientCapabilities {
        supports_mcp: true,
        supports_skills: true,
    },
};

pub const CURSOR_PROFILE: ClientProfile = ClientProfile {
    kind: ClientKind::Cursor,
    key: "cursor",
    display_name: "Cursor",
    capabilities: ClientCapabilities {
        supports_mcp: true,
        supports_skills: true,
    },
};

pub const CODEX_APP_PROFILE: ClientProfile = ClientProfile {
    kind: ClientKind::CodexApp,
    key: "codex_app",
    display_name: "Codex App",
    capabilities: ClientCapabilities {
        supports_mcp: true,
        supports_skills: true,
    },
};
