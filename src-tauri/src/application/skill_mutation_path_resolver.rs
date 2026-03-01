use std::{env, path::PathBuf};

use crate::contracts::{command::CommandError, common::ClientKind, mutate::MutationAction};

use super::skill_path_resolver::{preferred_skill_dir, resolve_skill_dir};

pub fn resolve_skill_root_path(
    client: ClientKind,
    action: MutationAction,
    skills_dir_override: Option<&str>,
) -> Result<PathBuf, CommandError> {
    if let Some(skills_dir_override) = skills_dir_override {
        let expanded = expand_user_path(skills_dir_override);
        if matches!(action, MutationAction::Remove | MutationAction::Update) && !expanded.is_dir() {
            return Err(CommandError::validation(format!(
                "skills_dir '{}' does not exist for skill remove/update mutation.",
                expanded.display()
            )));
        }

        return Ok(expanded);
    }

    let resolution = resolve_skill_dir(client);
    if let Some(path) = resolution.path {
        return Ok(path);
    }

    if matches!(action, MutationAction::Add) {
        return Ok(preferred_skill_dir(client));
    }

    let warning = (!resolution.warnings.is_empty()).then(|| resolution.warnings.join(" | "));
    match warning {
        Some(warning) => Err(CommandError::validation(format!(
            "Could not resolve skills directory for '{}'. {}",
            client.as_str(),
            warning
        ))),
        None => Err(CommandError::validation(format!(
            "Could not resolve skills directory for '{}'.",
            client.as_str()
        ))),
    }
}

fn expand_user_path(value: &str) -> PathBuf {
    if let Some(stripped) = value.strip_prefix("~/")
        && let Some(home) = env::var_os("HOME")
    {
        return PathBuf::from(home).join(stripped);
    }

    PathBuf::from(value)
}
