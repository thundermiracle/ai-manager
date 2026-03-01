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

pub const CODEX_PROFILE: ClientProfile = ClientProfile {
    kind: ClientKind::Codex,
    key: "codex",
    display_name: "Codex",
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
