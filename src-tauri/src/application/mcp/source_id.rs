use crate::domain::{ClientKind, ResourceSourceScope};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct McpSourceId {
    pub(super) client: ClientKind,
    pub(super) scope: ResourceSourceScope,
    pub(super) selector: Option<String>,
}

impl McpSourceId {
    pub(super) fn parse(value: &str) -> Option<Self> {
        let mut parts = value.splitn(5, "::");
        let prefix = parts.next()?;
        let client = parts.next().and_then(parse_client_kind)?;
        let scope = parts.next().and_then(parse_scope)?;
        let _path = parts.next()?;
        let selector = parts.next().map(str::to_string);

        if prefix != "mcp" {
            return None;
        }

        Some(Self {
            client,
            scope,
            selector,
        })
    }
}

fn parse_client_kind(value: &str) -> Option<ClientKind> {
    match value {
        "claude_code" => Some(ClientKind::ClaudeCode),
        "codex" => Some(ClientKind::Codex),
        "cursor" => Some(ClientKind::Cursor),
        _ => None,
    }
}

fn parse_scope(value: &str) -> Option<ResourceSourceScope> {
    match value {
        "user" => Some(ResourceSourceScope::User),
        "project_shared" => Some(ResourceSourceScope::ProjectShared),
        "project_private" => Some(ResourceSourceScope::ProjectPrivate),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::McpSourceId;
    use crate::domain::{ClientKind, ResourceSourceScope};

    #[test]
    fn parse_extracts_client_scope_and_selector() {
        let parsed = McpSourceId::parse(
            "mcp::claude_code::project_private::/Users/test/.claude.json::/projects/~1repo/mcpServers",
        )
        .expect("source id should parse");

        assert_eq!(parsed.client, ClientKind::ClaudeCode);
        assert_eq!(parsed.scope, ResourceSourceScope::ProjectPrivate);
        assert_eq!(
            parsed.selector.as_deref(),
            Some("/projects/~1repo/mcpServers")
        );
    }

    #[test]
    fn parse_rejects_non_mcp_prefix() {
        assert!(McpSourceId::parse("skill::cursor::user::/tmp::/skills").is_none());
    }
}
