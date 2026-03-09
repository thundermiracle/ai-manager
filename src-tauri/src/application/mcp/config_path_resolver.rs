use std::{env, path::PathBuf};

use crate::{
    infra::DetectorRegistry,
    interface::contracts::{command::CommandError, common::ClientKind, mutate::MutationAction},
};

pub fn resolve_mcp_config_path(
    client: ClientKind,
    action: MutationAction,
    source_path_override: Option<&str>,
    _detector_registry: &DetectorRegistry,
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

    if let Some(config_path) = existing_mcp_config_path(client) {
        return Ok(config_path);
    }

    if matches!(action, MutationAction::Add) {
        return Ok(default_mcp_config_path(client));
    }

    Err(CommandError::validation(format!(
        "Could not resolve MCP config path for '{}'.",
        client.as_str()
    )))
}

pub(super) fn preferred_mcp_config_path(client: ClientKind) -> PathBuf {
    existing_mcp_config_path(client).unwrap_or_else(|| default_mcp_config_path(client))
}

fn existing_mcp_config_path(client: ClientKind) -> Option<PathBuf> {
    if let Some(override_value) = read_first_env(override_env_names(client)) {
        let expanded = expand_user_path(&override_value);
        return expanded.is_file().then_some(expanded);
    }

    fallback_mcp_config_paths(client)
        .iter()
        .map(|value| expand_user_path(value))
        .find(|path| path.is_file())
}

pub(super) fn default_mcp_config_path(client: ClientKind) -> PathBuf {
    if let Some(override_value) = read_first_env(override_env_names(client)) {
        return expand_user_path(&override_value);
    }

    fallback_mcp_config_paths(client)
        .first()
        .map(|value| expand_user_path(value))
        .unwrap_or_default()
}

fn override_env_names(client: ClientKind) -> &'static [&'static str] {
    match client {
        ClientKind::ClaudeCode => &["AI_MANAGER_CLAUDE_CODE_MCP_CONFIG"],
        ClientKind::Codex => &["AI_MANAGER_CODEX_MCP_CONFIG"],
        ClientKind::Cursor => &["AI_MANAGER_CURSOR_MCP_CONFIG"],
    }
}

fn fallback_mcp_config_paths(client: ClientKind) -> &'static [&'static str] {
    match client {
        ClientKind::ClaudeCode => &["~/.claude.json", "~/.claude/claude_code_config.json"],
        ClientKind::Codex => &["~/.codex/config.toml"],
        ClientKind::Cursor => &[
            "~/.cursor/mcp.json",
            "~/Library/Application Support/Cursor/User/mcp.json",
        ],
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

#[cfg(test)]
mod tests {
    use std::{
        fs,
        sync::{Mutex, OnceLock},
    };

    use super::{ClientKind, default_mcp_config_path, preferred_mcp_config_path};

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn set_env_var(name: &str, value: impl AsRef<std::ffi::OsStr>) {
        // Tests serialize env access with env_lock(), so mutating process env is safe here.
        unsafe {
            std::env::set_var(name, value);
        }
    }

    #[test]
    fn claude_default_mcp_config_prefers_dot_claude_json() {
        let path = default_mcp_config_path(ClientKind::ClaudeCode);

        assert_eq!(
            path.file_name().and_then(|name| name.to_str()),
            Some(".claude.json")
        );
    }

    #[test]
    fn preferred_path_uses_existing_secondary_fallback_without_detection() {
        let _guard = env_lock().lock().expect("env lock should be available");
        let temp_home =
            std::env::temp_dir().join(format!("ai-manager-mcp-path-home-{}", std::process::id()));
        let secondary_path = temp_home.join(".claude").join("claude_code_config.json");
        fs::create_dir_all(
            secondary_path
                .parent()
                .expect("secondary path parent should exist"),
        )
        .expect("temp home should be writable");
        fs::write(&secondary_path, "{\n  \"mcpServers\": {}\n}\n")
            .expect("secondary fallback should be writable");

        let previous_home = std::env::var("HOME").ok();
        let previous_override = std::env::var("AI_MANAGER_CLAUDE_CODE_MCP_CONFIG").ok();
        set_env_var("HOME", temp_home.display().to_string());
        // Tests serialize env access with env_lock(), so mutating process env is safe here.
        unsafe {
            std::env::remove_var("AI_MANAGER_CLAUDE_CODE_MCP_CONFIG");
        }

        let resolved = preferred_mcp_config_path(ClientKind::ClaudeCode);

        restore_env("HOME", previous_home);
        restore_env("AI_MANAGER_CLAUDE_CODE_MCP_CONFIG", previous_override);
        let _ = fs::remove_dir_all(&temp_home);

        assert_eq!(resolved, secondary_path);
    }

    fn restore_env(name: &str, previous: Option<String>) {
        match previous {
            Some(value) => set_env_var(name, value),
            None => {
                // Tests serialize env access with env_lock(), so mutating process env is safe here.
                unsafe {
                    std::env::remove_var(name);
                }
            }
        }
    }
}
