use crate::contracts::{command::CommandError, mutate::MutationAction};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SkillInstallKind {
    Directory,
    File,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct SkillMutationPayload {
    pub source_path: Option<String>,
    pub skills_dir: Option<String>,
    pub manifest: Option<String>,
    pub install_kind: Option<SkillInstallKind>,
    pub fail_after_write: bool,
}

pub fn parse_skill_mutation_payload(
    action: MutationAction,
    payload: Option<&serde_json::Value>,
) -> Result<SkillMutationPayload, CommandError> {
    let Some(payload) = payload else {
        return if matches!(action, MutationAction::Remove) {
            Ok(SkillMutationPayload::default())
        } else {
            Err(CommandError::validation(
                "payload is required for skill add mutation.",
            ))
        };
    };

    let source_path = read_trimmed_string(payload, "source_path");
    let skills_dir = read_trimmed_string(payload, "skills_dir");
    let manifest = read_manifest(payload);
    let fail_after_write = payload
        .get("fail_after_write")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);

    let install_kind = if let Some(raw_kind) = payload
        .get("install_kind")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(parse_install_kind(raw_kind)?)
    } else {
        None
    };

    if source_path.is_some() && manifest.is_some() {
        return Err(CommandError::validation(
            "payload.source_path and payload.manifest cannot be used together.",
        ));
    }

    if matches!(action, MutationAction::Add) && source_path.is_none() && manifest.is_none() {
        return Err(CommandError::validation(
            "payload.manifest or payload.source_path is required for skill add mutation.",
        ));
    }

    Ok(SkillMutationPayload {
        source_path,
        skills_dir,
        manifest,
        install_kind,
        fail_after_write,
    })
}

fn read_trimmed_string(payload: &serde_json::Value, key: &str) -> Option<String> {
    payload
        .get(key)
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn read_manifest(payload: &serde_json::Value) -> Option<String> {
    payload
        .get("manifest")
        .and_then(serde_json::Value::as_str)
        .map(str::to_string)
        .filter(|value| !value.trim().is_empty())
}

fn parse_install_kind(value: &str) -> Result<SkillInstallKind, CommandError> {
    match value {
        "directory" => Ok(SkillInstallKind::Directory),
        "file" => Ok(SkillInstallKind::File),
        _ => Err(CommandError::validation(
            "payload.install_kind must be either 'directory' or 'file'.",
        )),
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use crate::contracts::mutate::MutationAction;

    use super::{SkillInstallKind, parse_skill_mutation_payload};

    #[test]
    fn add_requires_manifest_or_source_path() {
        let error = parse_skill_mutation_payload(MutationAction::Add, Some(&json!({})))
            .expect_err("add payload should require a source");

        assert!(
            error
                .message
                .contains("payload.manifest or payload.source_path")
        );
    }

    #[test]
    fn add_with_manifest_parses_install_kind() {
        let payload = parse_skill_mutation_payload(
            MutationAction::Add,
            Some(&json!({
                "manifest": "# Python Refactor\n\nRefactor Python code safely.\n",
                "install_kind": "file"
            })),
        )
        .expect("payload should parse");

        assert!(matches!(payload.install_kind, Some(SkillInstallKind::File)));
        assert!(payload.source_path.is_none());
    }

    #[test]
    fn source_and_manifest_are_mutually_exclusive() {
        let error = parse_skill_mutation_payload(
            MutationAction::Add,
            Some(&json!({
                "source_path": "/tmp/skill.md",
                "manifest": "# Skill\n\nContent\n"
            })),
        )
        .expect_err("source_path + manifest should fail");

        assert!(error.message.contains("cannot be used together"));
    }

    #[test]
    fn remove_payload_is_optional() {
        let payload = parse_skill_mutation_payload(MutationAction::Remove, None)
            .expect("remove payload should be optional");

        assert!(payload.source_path.is_none());
        assert!(payload.manifest.is_none());
    }
}
