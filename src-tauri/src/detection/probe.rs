use std::env;
use std::path::{Path, PathBuf};

pub enum ConfigProbe {
    Resolved(String),
    OverrideInvalid(String),
    Missing,
}

pub fn probe_binary_path(candidates: &[&str]) -> Option<String> {
    for command in candidates {
        if let Some(path) = find_command_in_path(command) {
            return Some(path.to_string_lossy().to_string());
        }
    }

    None
}

pub fn probe_config_path(env_var: &str, fallbacks: &[&str]) -> ConfigProbe {
    let override_value = read_env_value(env_var);
    probe_config_path_with_override(override_value.as_deref(), fallbacks)
}

pub fn probe_config_path_with_override(
    override_value: Option<&str>,
    fallbacks: &[&str],
) -> ConfigProbe {
    if let Some(override_value) = override_value {
        let expanded = expand_user_path(override_value);
        if is_readable_file(&expanded) {
            return ConfigProbe::Resolved(expanded.to_string_lossy().to_string());
        }

        return ConfigProbe::OverrideInvalid(expanded.to_string_lossy().to_string());
    }

    for fallback in fallbacks {
        let expanded = expand_user_path(fallback);
        if is_readable_file(&expanded) {
            return ConfigProbe::Resolved(expanded.to_string_lossy().to_string());
        }
    }

    ConfigProbe::Missing
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

fn is_readable_file(path: &Path) -> bool {
    path.is_file() && std::fs::File::open(path).is_ok()
}

fn find_command_in_path(command: &str) -> Option<PathBuf> {
    if command.contains(std::path::MAIN_SEPARATOR) {
        let candidate = expand_user_path(command);
        return candidate.is_file().then_some(candidate);
    }

    let path_var = env::var_os("PATH")?;

    for directory in env::split_paths(&path_var) {
        let candidate = directory.join(command);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::{ConfigProbe, probe_config_path_with_override};

    #[test]
    fn override_path_precedence_blocks_fallback_resolution_when_invalid() {
        let temp_dir =
            std::env::temp_dir().join(format!("ai-manager-detection-test-{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);

        let fallback_path = temp_dir.join("fallback-config.json");
        fs::write(&fallback_path, "{}").expect("should create fallback fixture");

        let fallback_str = fallback_path
            .to_str()
            .expect("fallback path should be valid utf-8");

        let outcome = probe_config_path_with_override(
            Some("/definitely/missing/config.json"),
            &[fallback_str],
        );

        let _ = fs::remove_file(&fallback_path);
        let _ = fs::remove_dir(&temp_dir);

        assert!(matches!(outcome, ConfigProbe::OverrideInvalid(_)));
    }

    #[test]
    fn fallback_path_resolves_when_override_is_not_set() {
        let temp_dir = std::env::temp_dir().join(format!(
            "ai-manager-detection-test-fallback-{}",
            std::process::id()
        ));
        let _ = fs::create_dir_all(&temp_dir);

        let fallback_path = temp_dir.join("config.toml");
        fs::write(&fallback_path, "version = 1").expect("should create fallback fixture");

        let fallback_str = fallback_path
            .to_str()
            .expect("fallback path should be valid utf-8");

        let outcome = probe_config_path_with_override(None, &[fallback_str]);

        let _ = fs::remove_file(&fallback_path);
        let _ = fs::remove_dir(&temp_dir);

        assert!(matches!(outcome, ConfigProbe::Resolved(_)));
    }
}
