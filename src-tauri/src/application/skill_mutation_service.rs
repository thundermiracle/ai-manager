use std::{
    env, fs,
    io::ErrorKind,
    path::{Path, PathBuf},
};

use crate::{
    contracts::{command::CommandError, common::ClientKind, mutate::MutationAction},
    infra::{MutationTestHooks, SafeFileMutator},
};

use super::{
    skill_github_repository::read_github_skill_manifest,
    skill_metadata_parser::parse_skill_metadata,
    skill_mutation_path_resolver::resolve_skill_root_path,
    skill_mutation_payload::{
        SkillInstallKind, SkillMutationPayload, parse_skill_mutation_payload,
    },
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkillMutationResult {
    pub source_path: String,
    pub message: String,
}

pub struct SkillMutationService;

impl SkillMutationService {
    pub fn new() -> Self {
        Self
    }

    pub fn mutate(
        &self,
        client: ClientKind,
        action: MutationAction,
        target_id: &str,
        payload: Option<&serde_json::Value>,
    ) -> Result<SkillMutationResult, CommandError> {
        validate_skill_target_id(target_id)?;
        let payload = parse_skill_mutation_payload(action, payload)?;

        match action {
            MutationAction::Add => add_skill(client, target_id, &payload),
            MutationAction::Remove => remove_skill(client, target_id, &payload),
            MutationAction::Update => update_skill(client, target_id, &payload),
        }
    }
}

impl Default for SkillMutationService {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SkillManifestSource {
    manifest: String,
    install_kind: SkillInstallKind,
    source_reference: Option<String>,
}

fn add_skill(
    client: ClientKind,
    target_id: &str,
    payload: &SkillMutationPayload,
) -> Result<SkillMutationResult, CommandError> {
    let root_path =
        resolve_skill_root_path(client, MutationAction::Add, payload.skills_dir.as_deref())?;
    let manifest_source = resolve_manifest_source(target_id, payload)?;

    let metadata = parse_skill_metadata(&manifest_source.manifest);
    if metadata.description.is_none() {
        return Err(CommandError::validation(
            "Skill manifest metadata is incompatible: include at least one heading or description line.",
        ));
    }

    let install_kind = payload.install_kind.unwrap_or(manifest_source.install_kind);
    let directory_manifest = directory_manifest_path(&root_path, target_id);
    let file_manifest = file_manifest_path(&root_path, target_id);
    let destination_manifest = match install_kind {
        SkillInstallKind::Directory => directory_manifest.clone(),
        SkillInstallKind::File => file_manifest.clone(),
    };

    let mut conflicts: Vec<String> = Vec::new();
    if directory_manifest.exists() {
        conflicts.push(directory_manifest.display().to_string());
    }
    if file_manifest.exists() {
        conflicts.push(file_manifest.display().to_string());
    }
    if !conflicts.is_empty() {
        return Err(CommandError::validation(format!(
            "Skill '{}' already exists. Conflicts: {}",
            target_id,
            conflicts.join(", ")
        )));
    }

    if let Some(parent) = destination_manifest.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            CommandError::internal(format!(
                "Failed to create skill destination directory '{}': {}",
                parent.display(),
                error
            ))
        })?;
    }

    let mutator = SafeFileMutator::new();
    let outcome = if payload.fail_after_write {
        mutator.replace_file_with_hooks(
            &destination_manifest,
            manifest_source.manifest.as_bytes(),
            MutationTestHooks {
                fail_after_backup: false,
                fail_after_write: true,
            },
        )
    } else {
        mutator.replace_file(&destination_manifest, manifest_source.manifest.as_bytes())
    }
    .map_err(|failure| {
        CommandError::internal(format!(
            "[stage={:?}] {} (rollback_succeeded={})",
            failure.stage, failure.message, failure.rollback_succeeded
        ))
    })?;

    let mut message = format!(
        "Added skill '{}' for '{}'. Installed at '{}'.",
        target_id,
        client.as_str(),
        destination_manifest.display()
    );
    if let Some(source_reference) = manifest_source.source_reference {
        message.push_str(&format!(" Source: {}.", source_reference));
    }
    if let Some(backup_path) = outcome.backup_path {
        message.push_str(&format!(" Backup: {}.", backup_path));
    }

    Ok(SkillMutationResult {
        source_path: destination_manifest.display().to_string(),
        message,
    })
}

fn remove_skill(
    client: ClientKind,
    target_id: &str,
    payload: &SkillMutationPayload,
) -> Result<SkillMutationResult, CommandError> {
    let root_path = resolve_skill_root_path(
        client,
        MutationAction::Remove,
        payload.skills_dir.as_deref(),
    )?;
    let removal_targets =
        resolve_removal_targets(&root_path, target_id, payload.source_path.as_deref())?;

    for target in &removal_targets {
        fs::remove_file(target).map_err(|error| {
            CommandError::internal(format!(
                "Failed to remove skill manifest '{}': {}",
                target.display(),
                error
            ))
        })?;
    }

    for target in &removal_targets {
        cleanup_skill_directory_if_empty(target)?;
    }

    let mut message = format!("Removed skill '{}' for '{}'.", target_id, client.as_str());
    if removal_targets.len() > 1 {
        message.push_str(" Cleaned up stale skill entries.");
    }
    message.push_str(&format!(
        " Removed: {}.",
        removal_targets
            .iter()
            .map(|path| path.display().to_string())
            .collect::<Vec<_>>()
            .join(", ")
    ));

    Ok(SkillMutationResult {
        source_path: removal_targets
            .first()
            .map(|path| path.display().to_string())
            .unwrap_or_default(),
        message,
    })
}

fn update_skill(
    client: ClientKind,
    target_id: &str,
    payload: &SkillMutationPayload,
) -> Result<SkillMutationResult, CommandError> {
    let root_path = resolve_skill_root_path(
        client,
        MutationAction::Update,
        payload.skills_dir.as_deref(),
    )?;
    let target_manifest = resolve_update_target(&root_path, target_id)?;
    let target_install_kind = infer_install_kind_from_manifest_path(&target_manifest);

    if let Some(requested_kind) = payload.install_kind
        && requested_kind != target_install_kind
    {
        return Err(CommandError::validation(
            "payload.install_kind must match the currently installed skill layout for update mutations.",
        ));
    }

    let manifest_source = resolve_manifest_source(target_id, payload)?;
    let metadata = parse_skill_metadata(&manifest_source.manifest);
    if metadata.description.is_none() {
        return Err(CommandError::validation(
            "Skill manifest metadata is incompatible: include at least one heading or description line.",
        ));
    }

    let mutator = SafeFileMutator::new();
    let outcome = if payload.fail_after_write {
        mutator.replace_file_with_hooks(
            &target_manifest,
            manifest_source.manifest.as_bytes(),
            MutationTestHooks {
                fail_after_backup: false,
                fail_after_write: true,
            },
        )
    } else {
        mutator.replace_file(&target_manifest, manifest_source.manifest.as_bytes())
    }
    .map_err(|failure| {
        CommandError::internal(format!(
            "[stage={:?}] {} (rollback_succeeded={})",
            failure.stage, failure.message, failure.rollback_succeeded
        ))
    })?;

    let mut message = format!(
        "Updated skill '{}' for '{}'. Installed at '{}'.",
        target_id,
        client.as_str(),
        target_manifest.display()
    );
    if let Some(source_reference) = manifest_source.source_reference {
        message.push_str(&format!(" Source: {}.", source_reference));
    }
    if let Some(backup_path) = outcome.backup_path {
        message.push_str(&format!(" Backup: {}.", backup_path));
    }

    Ok(SkillMutationResult {
        source_path: target_manifest.display().to_string(),
        message,
    })
}

fn resolve_manifest_source(
    target_id: &str,
    payload: &SkillMutationPayload,
) -> Result<SkillManifestSource, CommandError> {
    if let Some(source_path) = payload.source_path.as_deref() {
        let source_path = expand_user_path(source_path);
        let (manifest_path, inferred_kind) = if source_path.is_dir() {
            let manifest_path = source_path.join("SKILL.md");
            if !manifest_path.is_file() {
                return Err(CommandError::validation(format!(
                    "source_path '{}' must contain SKILL.md when using directory install.",
                    source_path.display()
                )));
            }
            (manifest_path, SkillInstallKind::Directory)
        } else if source_path.is_file() {
            let extension = source_path
                .extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or_default();
            if !extension.eq_ignore_ascii_case("md") {
                return Err(CommandError::validation(format!(
                    "source_path '{}' must point to a markdown file.",
                    source_path.display()
                )));
            }
            (source_path.clone(), SkillInstallKind::File)
        } else {
            return Err(CommandError::validation(format!(
                "source_path '{}' does not exist.",
                source_path.display()
            )));
        };

        if let Some(requested_kind) = payload.install_kind
            && requested_kind != inferred_kind
        {
            return Err(CommandError::validation(
                "payload.install_kind is incompatible with payload.source_path shape.",
            ));
        }

        let manifest = fs::read_to_string(&manifest_path).map_err(|error| {
            CommandError::internal(format!(
                "Failed to read skill source manifest '{}': {}",
                manifest_path.display(),
                error
            ))
        })?;

        return Ok(SkillManifestSource {
            manifest,
            install_kind: inferred_kind,
            source_reference: Some(manifest_path.display().to_string()),
        });
    }

    if let Some(github_repo_url) = payload.github_repo_url.as_deref() {
        let github_manifest = read_github_skill_manifest(
            github_repo_url,
            target_id,
            payload.github_skill_path.as_deref(),
        )?;

        return Ok(SkillManifestSource {
            manifest: github_manifest.manifest,
            install_kind: SkillInstallKind::Directory,
            source_reference: Some(format!(
                "{} ({})",
                github_manifest.normalized_repo_url, github_manifest.manifest_path
            )),
        });
    }

    let Some(manifest) = payload.manifest.clone() else {
        return Err(CommandError::validation(
            "payload.manifest, payload.source_path, or payload.github_repo_url is required for skill add/update mutation.",
        ));
    };

    Ok(SkillManifestSource {
        manifest,
        install_kind: payload.install_kind.unwrap_or(SkillInstallKind::Directory),
        source_reference: None,
    })
}

fn resolve_removal_targets(
    root_path: &Path,
    target_id: &str,
    source_path_override: Option<&str>,
) -> Result<Vec<PathBuf>, CommandError> {
    if let Some(source_path_override) = source_path_override {
        let source_path = expand_user_path(source_path_override);
        let manifest_path = if source_path.is_dir() {
            source_path.join("SKILL.md")
        } else {
            source_path
        };

        if !manifest_path.is_file() {
            return Err(CommandError::validation(format!(
                "source_path '{}' does not exist.",
                manifest_path.display()
            )));
        }

        return Ok(vec![manifest_path]);
    }

    let mut targets: Vec<PathBuf> = Vec::new();
    let directory_manifest = directory_manifest_path(root_path, target_id);
    if directory_manifest.is_file() {
        targets.push(directory_manifest);
    }

    let file_manifest = file_manifest_path(root_path, target_id);
    if file_manifest.is_file() {
        targets.push(file_manifest);
    }

    if targets.is_empty() {
        return Err(CommandError::validation(format!(
            "Skill '{}' does not exist.",
            target_id
        )));
    }

    targets.sort_unstable_by(|left, right| left.as_os_str().cmp(right.as_os_str()));
    Ok(targets)
}

fn resolve_update_target(root_path: &Path, target_id: &str) -> Result<PathBuf, CommandError> {
    let targets = resolve_removal_targets(root_path, target_id, None)?;
    if targets.len() > 1 {
        return Err(CommandError::validation(format!(
            "Skill '{}' has multiple installed manifests. Remove stale entries before updating.",
            target_id
        )));
    }

    targets
        .into_iter()
        .next()
        .ok_or_else(|| CommandError::validation(format!("Skill '{}' does not exist.", target_id)))
}

fn validate_skill_target_id(target_id: &str) -> Result<(), CommandError> {
    if target_id.contains('/') || target_id.contains('\\') || target_id.contains("..") {
        return Err(CommandError::validation(
            "target_id must not contain path separators or traversal segments for skill mutation.",
        ));
    }

    Ok(())
}

fn directory_manifest_path(root_path: &Path, target_id: &str) -> PathBuf {
    root_path.join(target_id).join("SKILL.md")
}

fn file_manifest_path(root_path: &Path, target_id: &str) -> PathBuf {
    root_path.join(format!("{target_id}.md"))
}

fn infer_install_kind_from_manifest_path(manifest_path: &Path) -> SkillInstallKind {
    if manifest_path.file_name().and_then(|name| name.to_str()) == Some("SKILL.md") {
        SkillInstallKind::Directory
    } else {
        SkillInstallKind::File
    }
}

fn cleanup_skill_directory_if_empty(manifest_path: &Path) -> Result<(), CommandError> {
    if manifest_path.file_name().and_then(|name| name.to_str()) != Some("SKILL.md") {
        return Ok(());
    }

    let Some(parent) = manifest_path.parent() else {
        return Ok(());
    };

    match fs::remove_dir(parent) {
        Ok(()) => Ok(()),
        Err(error)
            if matches!(
                error.kind(),
                ErrorKind::NotFound | ErrorKind::DirectoryNotEmpty
            ) =>
        {
            Ok(())
        }
        Err(error) => Err(CommandError::internal(format!(
            "Failed to clean up empty skill directory '{}': {}",
            parent.display(),
            error
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

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;

    use serde_json::json;

    use crate::contracts::{common::ClientKind, mutate::MutationAction};

    use super::SkillMutationService;

    #[test]
    fn add_skill_with_manifest_creates_directory_install() {
        let root = test_root("add-manifest");
        let _ = fs::create_dir_all(&root);

        let service = SkillMutationService::new();
        let result = service
            .mutate(
                ClientKind::Cursor,
                MutationAction::Add,
                "python-refactor",
                Some(&json!({
                    "skills_dir": root.display().to_string(),
                    "manifest": "# Python Refactor\n\nRefactor Python safely.\n"
                })),
            )
            .expect("add should succeed");

        let installed_manifest = root.join("python-refactor").join("SKILL.md");
        let content = fs::read_to_string(&installed_manifest).expect("manifest should exist");
        let _ = fs::remove_dir_all(&root);

        assert!(content.contains("Python Refactor"));
        assert_eq!(result.source_path, installed_manifest.display().to_string());
    }

    #[test]
    fn add_duplicate_skill_is_validation_error_and_non_destructive() {
        let root = test_root("duplicate");
        let existing_manifest = root.join("python-refactor").join("SKILL.md");
        let _ = fs::create_dir_all(existing_manifest.parent().expect("parent should exist"));
        let original = "# Existing Skill\n\nExisting description.\n";
        fs::write(&existing_manifest, original).expect("should write existing manifest");

        let service = SkillMutationService::new();
        let error = service
            .mutate(
                ClientKind::ClaudeCode,
                MutationAction::Add,
                "python-refactor",
                Some(&json!({
                    "skills_dir": root.display().to_string(),
                    "manifest": "# New Skill\n\nNew description.\n"
                })),
            )
            .expect_err("duplicate add should fail");

        let content = fs::read_to_string(&existing_manifest).expect("original should remain");
        let _ = fs::remove_dir_all(&root);

        assert!(error.message.contains("already exists"));
        assert_eq!(content, original);
    }

    #[test]
    fn add_rejects_incompatible_metadata() {
        let root = test_root("incompatible");
        let _ = fs::create_dir_all(&root);

        let service = SkillMutationService::new();
        let error = service
            .mutate(
                ClientKind::CodexCli,
                MutationAction::Add,
                "python-refactor",
                Some(&json!({
                    "skills_dir": root.display().to_string(),
                    "manifest": "#\n"
                })),
            )
            .expect_err("incompatible metadata should fail");

        let _ = fs::remove_dir_all(&root);

        assert!(error.message.contains("incompatible"));
    }

    #[test]
    fn add_rolls_back_when_post_write_failure_is_injected() {
        let root = test_root("rollback");
        let _ = fs::create_dir_all(&root);
        let target_manifest = root.join("python-refactor").join("SKILL.md");

        let service = SkillMutationService::new();
        let error = service
            .mutate(
                ClientKind::CodexApp,
                MutationAction::Add,
                "python-refactor",
                Some(&json!({
                    "skills_dir": root.display().to_string(),
                    "manifest": "# Skill\n\nDescription.\n",
                    "fail_after_write": true
                })),
            )
            .expect_err("injected failure should rollback");

        let _ = fs::remove_dir_all(&root);

        assert!(error.message.contains("rollback_succeeded=true"));
        assert!(!target_manifest.exists());
    }

    #[test]
    fn remove_cleans_stale_directory_and_file_entries() {
        let root = test_root("stale-remove");
        let directory_manifest = root.join("python-refactor").join("SKILL.md");
        let _ = fs::create_dir_all(directory_manifest.parent().expect("parent should exist"));
        fs::write(&directory_manifest, "# Skill\n\nDirectory install.\n")
            .expect("should write directory manifest");

        let file_manifest = root.join("python-refactor.md");
        fs::write(&file_manifest, "# Skill\n\nFile install.\n")
            .expect("should write file manifest");

        let service = SkillMutationService::new();
        let result = service
            .mutate(
                ClientKind::Cursor,
                MutationAction::Remove,
                "python-refactor",
                Some(&json!({
                    "skills_dir": root.display().to_string()
                })),
            )
            .expect("remove should succeed");

        let _ = fs::remove_dir_all(&root);

        assert!(result.message.contains("stale skill entries"));
        assert!(!directory_manifest.exists());
        assert!(!file_manifest.exists());
    }

    #[test]
    fn remove_missing_skill_is_validation_error() {
        let root = test_root("remove-missing");
        let _ = fs::create_dir_all(&root);

        let service = SkillMutationService::new();
        let error = service
            .mutate(
                ClientKind::ClaudeCode,
                MutationAction::Remove,
                "python-refactor",
                Some(&json!({
                    "skills_dir": root.display().to_string()
                })),
            )
            .expect_err("missing skill should fail");

        let _ = fs::remove_dir_all(&root);

        assert!(error.message.contains("does not exist"));
    }

    #[test]
    fn update_skill_overwrites_existing_manifest() {
        let root = test_root("update");
        let manifest_path = root.join("python-refactor").join("SKILL.md");
        let _ = fs::create_dir_all(manifest_path.parent().expect("parent should exist"));
        fs::write(&manifest_path, "# Python Refactor\n\nOriginal description.\n")
            .expect("should write manifest");

        let service = SkillMutationService::new();
        let result = service
            .mutate(
                ClientKind::Cursor,
                MutationAction::Update,
                "python-refactor",
                Some(&json!({
                    "skills_dir": root.display().to_string(),
                    "manifest": "# Python Refactor\n\nUpdated description.\n",
                    "install_kind": "directory"
                })),
            )
            .expect("update should succeed");

        let content = fs::read_to_string(&manifest_path).expect("manifest should exist");
        let _ = fs::remove_dir_all(&root);

        assert!(content.contains("Updated description."));
        assert!(result.message.contains("Updated skill"));
    }

    #[test]
    fn update_with_multiple_installs_requires_cleanup() {
        let root = test_root("update-duplicate");
        let directory_manifest = root.join("python-refactor").join("SKILL.md");
        let _ = fs::create_dir_all(directory_manifest.parent().expect("parent should exist"));
        fs::write(&directory_manifest, "# Skill\n\nDirectory install.\n")
            .expect("should write directory manifest");

        let file_manifest = root.join("python-refactor.md");
        fs::write(&file_manifest, "# Skill\n\nFile install.\n")
            .expect("should write file manifest");

        let service = SkillMutationService::new();
        let error = service
            .mutate(
                ClientKind::Cursor,
                MutationAction::Update,
                "python-refactor",
                Some(&json!({
                    "skills_dir": root.display().to_string(),
                    "manifest": "# Skill\n\nUpdated.\n"
                })),
            )
            .expect_err("update should fail when both install layouts exist");

        let _ = fs::remove_dir_all(&root);
        assert!(error.message.contains("multiple installed manifests"));
    }

    fn test_root(suffix: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "ai-manager-skill-mutation-{}-{}",
            std::process::id(),
            suffix
        ))
    }
}
