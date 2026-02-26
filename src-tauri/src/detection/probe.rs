use std::env;
use std::path::{Path, PathBuf};

pub enum ConfigProbe {
    Resolved(String),
    OverrideMissing(String),
    OverridePermissionDenied(String),
    PermissionDenied(String),
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
        return match file_access_outcome(&expanded) {
            FileAccessOutcome::ReadableFile => {
                ConfigProbe::Resolved(expanded.to_string_lossy().to_string())
            }
            FileAccessOutcome::PermissionDenied => {
                ConfigProbe::OverridePermissionDenied(expanded.to_string_lossy().to_string())
            }
            FileAccessOutcome::NotFoundOrNotFile => {
                ConfigProbe::OverrideMissing(expanded.to_string_lossy().to_string())
            }
        };
    }

    let mut first_permission_denied: Option<String> = None;

    for fallback in fallbacks {
        let expanded = expand_user_path(fallback);
        match file_access_outcome(&expanded) {
            FileAccessOutcome::ReadableFile => {
                return ConfigProbe::Resolved(expanded.to_string_lossy().to_string());
            }
            FileAccessOutcome::PermissionDenied => {
                if first_permission_denied.is_none() {
                    first_permission_denied = Some(expanded.to_string_lossy().to_string());
                }
            }
            FileAccessOutcome::NotFoundOrNotFile => {}
        }
    }

    if let Some(path) = first_permission_denied {
        return ConfigProbe::PermissionDenied(path);
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FileAccessOutcome {
    ReadableFile,
    PermissionDenied,
    NotFoundOrNotFile,
}

fn file_access_outcome(path: &Path) -> FileAccessOutcome {
    if !path.is_file() {
        return FileAccessOutcome::NotFoundOrNotFile;
    }

    match std::fs::File::open(path) {
        Ok(_) => FileAccessOutcome::ReadableFile,
        Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {
            FileAccessOutcome::PermissionDenied
        }
        Err(_) => FileAccessOutcome::NotFoundOrNotFile,
    }
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

        assert!(matches!(outcome, ConfigProbe::OverrideMissing(_)));
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

    #[test]
    fn override_path_reports_permission_denied_when_file_is_unreadable() {
        let temp_dir = std::env::temp_dir().join(format!(
            "ai-manager-detection-test-permission-{}",
            std::process::id()
        ));
        let _ = fs::create_dir_all(&temp_dir);

        let protected_file = temp_dir.join("protected-config.json");
        fs::write(&protected_file, "{}").expect("should create protected fixture");

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&protected_file)
                .expect("protected file metadata should exist")
                .permissions();
            perms.set_mode(0o000);
            fs::set_permissions(&protected_file, perms).expect("should change protected mode");
        }

        let protected_str = protected_file
            .to_str()
            .expect("protected path should be valid utf-8");

        let outcome = probe_config_path_with_override(Some(protected_str), &[]);

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&protected_file)
                .expect("protected file metadata should exist")
                .permissions();
            perms.set_mode(0o644);
            let _ = fs::set_permissions(&protected_file, perms);
        }

        let _ = fs::remove_file(&protected_file);
        let _ = fs::remove_dir(&temp_dir);

        #[cfg(unix)]
        assert!(matches!(outcome, ConfigProbe::OverridePermissionDenied(_)));
        #[cfg(not(unix))]
        assert!(matches!(
            outcome,
            ConfigProbe::OverridePermissionDenied(_) | ConfigProbe::Resolved(_)
        ));
    }
}
