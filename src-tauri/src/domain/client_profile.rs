use super::{ClientKind, ResourceKind, ResourceSourceScope};

const EMPTY_SCOPES: &[ResourceSourceScope] = &[];
const USER_ONLY_SCOPES: &[ResourceSourceScope] = &[ResourceSourceScope::User];
const CLAUDE_MCP_SCOPES: &[ResourceSourceScope] = &[
    ResourceSourceScope::User,
    ResourceSourceScope::ProjectShared,
    ResourceSourceScope::ProjectPrivate,
];
const CLAUDE_SUBAGENT_SCOPES: &[ResourceSourceScope] = &[
    ResourceSourceScope::User,
    ResourceSourceScope::ProjectShared,
];
const CURSOR_MCP_SCOPES: &[ResourceSourceScope] = &[
    ResourceSourceScope::User,
    ResourceSourceScope::ProjectShared,
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ResourceScopeCapabilities {
    pub source_scopes: &'static [ResourceSourceScope],
    pub destination_scopes: &'static [ResourceSourceScope],
}

impl ResourceScopeCapabilities {
    pub fn supports_source(self, scope: ResourceSourceScope) -> bool {
        self.source_scopes.contains(&scope)
    }

    pub fn supports_destination(self, scope: ResourceSourceScope) -> bool {
        self.destination_scopes.contains(&scope)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ClientCapabilities {
    pub supports_mcp: bool,
    pub supports_skills: bool,
    pub supports_subagents: bool,
    pub mcp: Option<ResourceScopeCapabilities>,
    pub skills: Option<ResourceScopeCapabilities>,
    pub subagents: Option<ResourceScopeCapabilities>,
}

impl ClientCapabilities {
    pub fn support_for(self, resource_kind: ResourceKind) -> Option<ResourceScopeCapabilities> {
        match resource_kind {
            ResourceKind::Mcp => self.mcp,
            ResourceKind::Skill => self.skills,
            ResourceKind::Subagent => self.subagents,
        }
    }

    pub fn source_scopes_for(self, resource_kind: ResourceKind) -> &'static [ResourceSourceScope] {
        self.support_for(resource_kind)
            .map(|support| support.source_scopes)
            .unwrap_or(EMPTY_SCOPES)
    }

    pub fn destination_scopes_for(
        self,
        resource_kind: ResourceKind,
    ) -> &'static [ResourceSourceScope] {
        self.support_for(resource_kind)
            .map(|support| support.destination_scopes)
            .unwrap_or(EMPTY_SCOPES)
    }

    pub fn supports_source(self, resource_kind: ResourceKind, scope: ResourceSourceScope) -> bool {
        self.support_for(resource_kind)
            .is_some_and(|support| support.supports_source(scope))
    }

    pub fn supports_destination(
        self,
        resource_kind: ResourceKind,
        scope: ResourceSourceScope,
    ) -> bool {
        self.support_for(resource_kind)
            .is_some_and(|support| support.supports_destination(scope))
    }
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
        supports_subagents: true,
        mcp: Some(ResourceScopeCapabilities {
            source_scopes: CLAUDE_MCP_SCOPES,
            destination_scopes: CLAUDE_MCP_SCOPES,
        }),
        skills: Some(ResourceScopeCapabilities {
            source_scopes: USER_ONLY_SCOPES,
            destination_scopes: USER_ONLY_SCOPES,
        }),
        subagents: Some(ResourceScopeCapabilities {
            source_scopes: CLAUDE_SUBAGENT_SCOPES,
            destination_scopes: CLAUDE_SUBAGENT_SCOPES,
        }),
    },
};

pub const CODEX_PROFILE: ClientProfile = ClientProfile {
    kind: ClientKind::Codex,
    key: "codex",
    display_name: "Codex",
    capabilities: ClientCapabilities {
        supports_mcp: true,
        supports_skills: true,
        supports_subagents: false,
        mcp: Some(ResourceScopeCapabilities {
            source_scopes: USER_ONLY_SCOPES,
            destination_scopes: USER_ONLY_SCOPES,
        }),
        skills: Some(ResourceScopeCapabilities {
            source_scopes: USER_ONLY_SCOPES,
            destination_scopes: USER_ONLY_SCOPES,
        }),
        subagents: None,
    },
};

pub const CURSOR_PROFILE: ClientProfile = ClientProfile {
    kind: ClientKind::Cursor,
    key: "cursor",
    display_name: "Cursor",
    capabilities: ClientCapabilities {
        supports_mcp: true,
        supports_skills: true,
        supports_subagents: false,
        mcp: Some(ResourceScopeCapabilities {
            source_scopes: CURSOR_MCP_SCOPES,
            destination_scopes: CURSOR_MCP_SCOPES,
        }),
        skills: Some(ResourceScopeCapabilities {
            source_scopes: USER_ONLY_SCOPES,
            destination_scopes: USER_ONLY_SCOPES,
        }),
        subagents: None,
    },
};

pub fn profile_for_client(client: ClientKind) -> &'static ClientProfile {
    match client {
        ClientKind::ClaudeCode => &CLAUDE_CODE_PROFILE,
        ClientKind::Codex => &CODEX_PROFILE,
        ClientKind::Cursor => &CURSOR_PROFILE,
    }
}

#[cfg(test)]
mod tests {
    use super::{ClientKind, profile_for_client};
    use crate::domain::{ResourceKind, ResourceSourceScope};

    #[test]
    fn claude_mcp_supports_user_and_project_scopes() {
        let capabilities = profile_for_client(ClientKind::ClaudeCode).capabilities;

        assert!(capabilities.supports_source(ResourceKind::Mcp, ResourceSourceScope::User));
        assert!(
            capabilities.supports_source(ResourceKind::Mcp, ResourceSourceScope::ProjectShared)
        );
        assert!(
            capabilities.supports_source(ResourceKind::Mcp, ResourceSourceScope::ProjectPrivate)
        );
        assert!(
            capabilities
                .supports_destination(ResourceKind::Mcp, ResourceSourceScope::ProjectPrivate)
        );
    }

    #[test]
    fn cursor_mcp_is_project_aware_but_not_project_private() {
        let capabilities = profile_for_client(ClientKind::Cursor).capabilities;

        assert!(
            capabilities.supports_source(ResourceKind::Mcp, ResourceSourceScope::ProjectShared)
        );
        assert!(
            !capabilities.supports_source(ResourceKind::Mcp, ResourceSourceScope::ProjectPrivate)
        );
        assert!(
            !capabilities
                .supports_destination(ResourceKind::Mcp, ResourceSourceScope::ProjectPrivate)
        );
    }

    #[test]
    fn codex_mcp_remains_user_only() {
        let capabilities = profile_for_client(ClientKind::Codex).capabilities;

        assert_eq!(
            capabilities.source_scopes_for(ResourceKind::Mcp),
            &[ResourceSourceScope::User]
        );
        assert_eq!(
            capabilities.destination_scopes_for(ResourceKind::Mcp),
            &[ResourceSourceScope::User]
        );
    }

    #[test]
    fn skill_support_remains_user_only_for_all_clients() {
        for client in [
            ClientKind::ClaudeCode,
            ClientKind::Codex,
            ClientKind::Cursor,
        ] {
            let capabilities = profile_for_client(client).capabilities;
            assert_eq!(
                capabilities.source_scopes_for(ResourceKind::Skill),
                &[ResourceSourceScope::User]
            );
            assert_eq!(
                capabilities.destination_scopes_for(ResourceKind::Skill),
                &[ResourceSourceScope::User]
            );
        }
    }

    #[test]
    fn subagent_support_is_claude_only_with_project_and_user_scopes() {
        let claude_capabilities = profile_for_client(ClientKind::ClaudeCode).capabilities;
        assert!(claude_capabilities.supports_subagents);
        assert_eq!(
            claude_capabilities.source_scopes_for(ResourceKind::Subagent),
            &[
                ResourceSourceScope::User,
                ResourceSourceScope::ProjectShared
            ]
        );
        assert_eq!(
            claude_capabilities.destination_scopes_for(ResourceKind::Subagent),
            &[
                ResourceSourceScope::User,
                ResourceSourceScope::ProjectShared
            ]
        );

        for client in [ClientKind::Codex, ClientKind::Cursor] {
            let capabilities = profile_for_client(client).capabilities;
            assert!(!capabilities.supports_subagents);
            assert!(
                capabilities
                    .source_scopes_for(ResourceKind::Subagent)
                    .is_empty()
            );
        }
    }
}
