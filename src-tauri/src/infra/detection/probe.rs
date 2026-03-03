use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;

pub enum ConfigProbe {
    Resolved(String),
    OverrideMissing(String),
    OverridePermissionDenied(String),
    PermissionDenied(String),
    Missing,
}

pub struct CliBinaryProbe {
    pub found: bool,
    pub binary_path: Option<String>,
    pub version: Option<String>,
}

pub fn probe_cli_binary(candidates: &[&str], include_version: bool) -> CliBinaryProbe {
    for command in candidates {
        let Some(version_output) = run_version_probe(command) else {
            continue;
        };

        let binary_path = resolve_command_path(command);
        return CliBinaryProbe {
            found: true,
            binary_path,
            version: include_version.then_some(version_output),
        };
    }

    CliBinaryProbe {
        found: false,
        binary_path: None,
        version: None,
    }
}

pub fn probe_binary_path(candidates: &[&str]) -> Option<String> {
    for command in candidates {
        if let Some(path) = resolve_command_path(command) {
            return Some(path);
        }
    }

    None
}

pub fn probe_config_path(env_vars: &[&str], fallbacks: &[&str]) -> ConfigProbe {
    let override_value = read_env_value(env_vars);
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

fn read_env_value(names: &[&str]) -> Option<String> {
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

fn is_executable_file(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::metadata(path)
            .map(|metadata| metadata.permissions().mode() & 0o111 != 0)
            .unwrap_or(false)
    }

    #[cfg(not(unix))]
    {
        true
    }
}

fn run_version_probe(command: &str) -> Option<String> {
    let output = if command.contains(std::path::MAIN_SEPARATOR) {
        let candidate = expand_user_path(command);
        if !is_executable_file(&candidate) {
            return None;
        }
        Command::new(candidate).arg("--version").output().ok()?
    } else {
        let script = format!("{} --version", shell_quote(command));
        run_with_login_shell(&script)?
    };

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    stdout
        .lines()
        .find(|line| !line.trim().is_empty())
        .or_else(|| stderr.lines().find(|line| !line.trim().is_empty()))
        .map(|line| line.trim().to_string())
        .or_else(|| Some("ok".to_string()))
}

fn resolve_command_path(command: &str) -> Option<String> {
    if command.contains(std::path::MAIN_SEPARATOR) {
        let candidate = expand_user_path(command);
        return is_executable_file(&candidate).then(|| candidate.to_string_lossy().to_string());
    }

    resolve_command_path_in_login_shell(command)
}

fn resolve_command_path_in_login_shell(command: &str) -> Option<String> {
    let script = format!("command -v {}", shell_quote(command));
    let output = run_with_login_shell(&script)?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .lines()
        .find(|line| !line.trim().is_empty())
        .map(|line| line.trim().to_string())
}

fn run_with_login_shell(script: &str) -> Option<std::process::Output> {
    let shell = resolve_shell();
    let shell_name = Path::new(&shell)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();

    let mut command = Command::new(&shell);
    sanitize_runtime_manager_env(&mut command);
    if matches!(shell_name, "bash" | "zsh" | "fish" | "ksh" | "tcsh") {
        command.arg("-l");
    }
    command.arg("-c").arg(script);
    command.output().ok()
}

fn sanitize_runtime_manager_env(command: &mut Command) {
    command.env("PATH", "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin");

    for (key, _) in env::vars_os() {
        let Some(name) = key.to_str() else {
            continue;
        };

        if name.starts_with("FNM_")
            || name.starts_with("NVM_")
            || name.starts_with("VOLTA_")
            || matches!(name, "NODE_PATH")
        {
            command.env_remove(name);
        }
    }
}

fn resolve_shell() -> String {
    env::var("SHELL")
        .ok()
        .map(|shell| shell.trim().to_string())
        .filter(|shell| !shell.is_empty())
        .unwrap_or_else(|| "/bin/sh".to_string())
}

fn shell_quote(word: &str) -> String {
    let escaped = word.replace('\'', r#"'\''"#);
    format!("'{escaped}'")
}

#[cfg(test)]
mod tests {
    use std::fs;
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;

    use super::{ConfigProbe, probe_binary_path, probe_cli_binary, probe_config_path_with_override};

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

    #[cfg(unix)]
    #[test]
    fn cli_binary_probe_executes_version_command_for_absolute_path_candidates() {
        let temp_dir =
            std::env::temp_dir().join(format!("ai-manager-cli-probe-{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);

        let script_path = temp_dir.join("test-cli-version");
        fs::write(&script_path, "#!/bin/sh\necho \"test-cli 1.2.3\"\n")
            .expect("should create version script");

        let mut executable_mode = fs::metadata(&script_path)
            .expect("version script should exist")
            .permissions();
        executable_mode.set_mode(0o755);
        fs::set_permissions(&script_path, executable_mode).expect("should make script executable");

        let script_value = script_path
            .to_str()
            .expect("script path should be valid utf-8")
            .to_string();
        let outcome = probe_cli_binary(&[script_value.as_str()], true);

        let _ = fs::remove_file(&script_path);
        let _ = fs::remove_dir(&temp_dir);

        assert!(outcome.found);
        assert_eq!(outcome.version.as_deref(), Some("test-cli 1.2.3"));
    }

    #[cfg(unix)]
    #[test]
    fn binary_path_probe_ignores_non_executable_files() {
        let temp_dir = std::env::temp_dir().join(format!(
            "ai-manager-binary-path-probe-{}",
            std::process::id()
        ));
        let _ = fs::create_dir_all(&temp_dir);

        let file_path = temp_dir.join("non-executable-cli");
        fs::write(&file_path, "echo should-not-run\n").expect("should create non-executable file");

        let mut file_mode = fs::metadata(&file_path)
            .expect("non-executable file should exist")
            .permissions();
        file_mode.set_mode(0o644);
        fs::set_permissions(&file_path, file_mode).expect("should remove executable mode");

        let file_value = file_path
            .to_str()
            .expect("file path should be valid utf-8")
            .to_string();
        let outcome = probe_binary_path(&[file_value.as_str()]);

        let _ = fs::remove_file(&file_path);
        let _ = fs::remove_dir(&temp_dir);

        assert!(outcome.is_none());
    }
}
