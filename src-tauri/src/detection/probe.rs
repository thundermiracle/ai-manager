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
    if let Some(override_value) = read_env_value(env_var) {
        let expanded = expand_user_path(&override_value);
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
