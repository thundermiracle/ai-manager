use std::{
    env,
    path::{Path, PathBuf},
};

use crate::contracts::common::ClientKind;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkillDirResolution {
    pub path: Option<PathBuf>,
    pub warnings: Vec<String>,
}

pub fn resolve_skill_dir(client: ClientKind) -> SkillDirResolution {
    let profile = profile_for_client(client);
    let override_value = read_env_value(profile.override_env_var);

    resolve_skill_dir_with_override(client, override_value.as_deref())
}

pub fn preferred_skill_dir(client: ClientKind) -> PathBuf {
    let profile = profile_for_client(client);

    if let Some(override_value) = read_env_value(profile.override_env_var) {
        return expand_user_path(&override_value);
    }

    profile
        .fallback_paths
        .first()
        .map(|path| expand_user_path(path))
        .unwrap_or_default()
}

pub fn resolve_skill_dir_with_override(
    client: ClientKind,
    override_value: Option<&str>,
) -> SkillDirResolution {
    let profile = profile_for_client(client);
    let mut warnings: Vec<String> = Vec::new();

    if let Some(override_value) = override_value {
        let expanded = expand_user_path(override_value);
        return if is_readable_dir(&expanded) {
            SkillDirResolution {
                path: Some(expanded),
                warnings,
            }
        } else {
            warnings.push(format!(
                "[{}:SKILLS_DIR_OVERRIDE_INVALID] override '{}' is not a readable directory: {}",
                client.as_str(),
                profile.override_env_var,
                expanded.display()
            ));
            SkillDirResolution {
                path: None,
                warnings,
            }
        };
    }

    for fallback in profile.fallback_paths {
        let expanded = expand_user_path(fallback);
        if is_readable_dir(&expanded) {
            return SkillDirResolution {
                path: Some(expanded),
                warnings,
            };
        }
    }

    warnings.push(format!(
        "[{}:SKILLS_DIR_NOT_FOUND] no readable skills directory was found.",
        client.as_str()
    ));

    SkillDirResolution {
        path: None,
        warnings,
    }
}

#[derive(Debug, Clone, Copy)]
struct SkillPathProfile {
    override_env_var: &'static str,
    fallback_paths: &'static [&'static str],
}

fn profile_for_client(client: ClientKind) -> SkillPathProfile {
    match client {
        ClientKind::ClaudeCode => SkillPathProfile {
            override_env_var: "AI_MANAGER_CLAUDE_CODE_SKILLS_DIR",
            fallback_paths: &["~/.claude/skills"],
        },
        ClientKind::CodexCli => SkillPathProfile {
            override_env_var: "AI_MANAGER_CODEX_CLI_SKILLS_DIR",
            fallback_paths: &["~/.codex/skills"],
        },
        ClientKind::Cursor => SkillPathProfile {
            override_env_var: "AI_MANAGER_CURSOR_SKILLS_DIR",
            fallback_paths: &[
                "~/.cursor/skills",
                "~/Library/Application Support/Cursor/User/skills",
            ],
        },
        ClientKind::CodexApp => SkillPathProfile {
            override_env_var: "AI_MANAGER_CODEX_APP_SKILLS_DIR",
            fallback_paths: &[
                "~/Library/Application Support/Codex/skills",
                "~/.config/Codex/skills",
            ],
        },
    }
}

fn read_env_value(name: &str) -> Option<String> {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
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

fn is_readable_dir(path: &Path) -> bool {
    path.is_dir() && std::fs::read_dir(path).is_ok()
}

#[cfg(test)]
mod tests {
    use std::fs;

    use crate::contracts::common::ClientKind;

    use super::resolve_skill_dir_with_override;

    #[test]
    fn override_directory_is_prioritized_when_present() {
        let temp_dir =
            std::env::temp_dir().join(format!("ai-manager-skills-override-{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);

        let override_value = temp_dir
            .to_str()
            .expect("temp path should be valid utf-8")
            .to_string();

        let resolution =
            resolve_skill_dir_with_override(ClientKind::ClaudeCode, Some(&override_value));

        let _ = fs::remove_dir_all(&temp_dir);

        assert_eq!(resolution.path.as_deref(), Some(temp_dir.as_path()));
        assert!(resolution.warnings.is_empty());
    }

    #[test]
    fn invalid_override_returns_actionable_warning() {
        let resolution = resolve_skill_dir_with_override(
            ClientKind::CodexCli,
            Some("/definitely/missing/skills"),
        );

        assert!(resolution.path.is_none());
        assert!(resolution.warnings.iter().any(|warning| {
            warning.contains("SKILLS_DIR_OVERRIDE_INVALID")
                && warning.contains("AI_MANAGER_CODEX_CLI_SKILLS_DIR")
        }));
    }
}
