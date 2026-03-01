use std::{env, path::PathBuf};

use crate::{
    infra::DetectorRegistry,
    interface::contracts::{command::CommandError, common::ClientKind, mutate::MutationAction},
};

pub fn resolve_mcp_config_path(
    client: ClientKind,
    action: MutationAction,
    source_path_override: Option<&str>,
    detector_registry: &DetectorRegistry,
) -> Result<PathBuf, CommandError> {
    if let Some(source_path_override) = source_path_override {
        let expanded = expand_user_path(source_path_override);
        if matches!(action, MutationAction::Remove | MutationAction::Update) && !expanded.exists() {
            return Err(CommandError::validation(format!(
                "source_path '{}' does not exist for MCP remove/update mutation.",
                expanded.display()
            )));
        }

        return Ok(expanded);
    }

    let detect_request = crate::interface::contracts::detect::DetectClientsRequest {
        include_versions: false,
    };

    if let Some(config_path) = detector_registry
        .all()
        .map(|detector| detector.detect(&detect_request))
        .find(|detection| detection.client == client)
        .and_then(|detection| detection.evidence.config_path)
    {
        return Ok(PathBuf::from(config_path));
    }

    if matches!(action, MutationAction::Add) {
        return Ok(default_mcp_config_path(client));
    }

    Err(CommandError::validation(format!(
        "Could not resolve MCP config path for '{}'.",
        client.as_str()
    )))
}

fn default_mcp_config_path(client: ClientKind) -> PathBuf {
    match client {
        ClientKind::ClaudeCode => expand_user_path(
            &env::var("AI_MANAGER_CLAUDE_CODE_MCP_CONFIG")
                .unwrap_or_else(|_| "~/.claude/claude_code_config.json".to_string()),
        ),
        ClientKind::Codex => expand_user_path(
            &read_first_env(&["AI_MANAGER_CODEX_MCP_CONFIG"])
                .unwrap_or_else(|| "~/.codex/config.toml".to_string()),
        ),
        ClientKind::Cursor => expand_user_path(
            &env::var("AI_MANAGER_CURSOR_MCP_CONFIG")
                .unwrap_or_else(|_| "~/.cursor/mcp.json".to_string()),
        ),
    }
}

fn read_first_env(names: &[&str]) -> Option<String> {
    names
        .iter()
        .find_map(|name| env::var(name).ok().map(|value| value.trim().to_string()))
        .filter(|value| !value.is_empty())
}

fn expand_user_path(value: &str) -> PathBuf {
    if let Some(stripped) = value.strip_prefix("~/")
        && let Some(home) = env::var_os("HOME")
    {
        return PathBuf::from(home).join(stripped);
    }

    PathBuf::from(value)
}
