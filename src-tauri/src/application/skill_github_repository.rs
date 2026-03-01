use std::{
    collections::HashMap,
    fs,
    io::ErrorKind,
    path::{Component, Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use crate::contracts::command::CommandError;

use super::skill_metadata_parser::parse_skill_metadata;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GitHubSkillCandidate {
    pub manifest_path: String,
    pub suggested_target_id: String,
    pub summary: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GitHubRepositoryScan {
    pub normalized_repo_url: String,
    pub items: Vec<GitHubSkillCandidate>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GitHubSkillManifest {
    pub normalized_repo_url: String,
    pub manifest_path: String,
    pub manifest: String,
}

pub fn scan_github_repository(github_repo_url: &str) -> Result<GitHubRepositoryScan, CommandError> {
    with_cloned_repository(github_repo_url, |normalized_repo_url, repo_root| {
        let manifest_paths = collect_skill_manifests(repo_root, 4)?;
        if manifest_paths.is_empty() {
            return Err(CommandError::validation(format!(
                "No SKILL.md file was found in '{}'.",
                normalized_repo_url
            )));
        }

        let mut target_id_counts: HashMap<String, usize> = HashMap::new();
        let mut items: Vec<GitHubSkillCandidate> = Vec::new();

        for manifest_path in manifest_paths {
            let relative_manifest_path = manifest_path
                .strip_prefix(repo_root)
                .ok()
                .map(path_to_posix)
                .unwrap_or_else(|| manifest_path.display().to_string());

            let manifest = fs::read_to_string(&manifest_path).map_err(|error| {
                CommandError::internal(format!(
                    "Failed to read skill source manifest '{}': {}",
                    manifest_path.display(),
                    error
                ))
            })?;
            let metadata = parse_skill_metadata(&manifest);
            let summary = metadata
                .description
                .unwrap_or_else(|| "No description found in SKILL.md.".to_string());

            let base_target_id =
                suggest_target_id_from_path(&relative_manifest_path, normalized_repo_url);
            let count = target_id_counts.entry(base_target_id.clone()).or_insert(0);
            *count += 1;
            let suggested_target_id = if *count == 1 {
                base_target_id
            } else {
                format!("{base_target_id}-{}", *count)
            };

            items.push(GitHubSkillCandidate {
                manifest_path: relative_manifest_path,
                suggested_target_id,
                summary,
            });
        }

        items.sort_unstable_by(|left, right| left.manifest_path.cmp(&right.manifest_path));
        Ok(GitHubRepositoryScan {
            normalized_repo_url: normalized_repo_url.to_string(),
            items,
        })
    })
}

pub fn read_github_skill_manifest(
    github_repo_url: &str,
    target_id: &str,
    github_skill_path: Option<&str>,
) -> Result<GitHubSkillManifest, CommandError> {
    with_cloned_repository(github_repo_url, |normalized_repo_url, repo_root| {
        let manifest_path = resolve_github_manifest_path(repo_root, target_id, github_skill_path)?;
        let manifest = fs::read_to_string(&manifest_path).map_err(|error| {
            CommandError::internal(format!(
                "Failed to read skill source manifest '{}': {}",
                manifest_path.display(),
                error
            ))
        })?;
        let manifest_path = manifest_path
            .strip_prefix(repo_root)
            .ok()
            .map(path_to_posix)
            .unwrap_or_else(|| manifest_path.display().to_string());

        Ok(GitHubSkillManifest {
            normalized_repo_url: normalized_repo_url.to_string(),
            manifest_path,
            manifest,
        })
    })
}

pub fn normalize_github_repo_url(value: &str) -> Result<String, CommandError> {
    let trimmed = value.trim().trim_end_matches('/');
    let Some(path) = trimmed.strip_prefix("https://github.com/") else {
        return Err(CommandError::validation(
            "payload.github_repo_url must start with 'https://github.com/'.",
        ));
    };

    let segments: Vec<&str> = path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    if segments.len() != 2 {
        return Err(CommandError::validation(
            "payload.github_repo_url must point to a repository root URL like 'https://github.com/<owner>/<repo>'.",
        ));
    }

    let owner = segments[0];
    let repo = segments[1].trim_end_matches(".git");
    if owner.is_empty() || repo.is_empty() {
        return Err(CommandError::validation(
            "payload.github_repo_url must include both owner and repository name.",
        ));
    }

    Ok(format!("https://github.com/{owner}/{repo}"))
}

fn with_cloned_repository<T, F>(github_repo_url: &str, operation: F) -> Result<T, CommandError>
where
    F: FnOnce(&str, &Path) -> Result<T, CommandError>,
{
    let normalized_repo_url = normalize_github_repo_url(github_repo_url)?;
    let cloned_repo_path = make_temp_clone_path();
    clone_github_repo(&normalized_repo_url, &cloned_repo_path)?;

    let result = operation(&normalized_repo_url, &cloned_repo_path);
    let cleanup_result = fs::remove_dir_all(&cloned_repo_path);

    match (result, cleanup_result) {
        (Ok(value), Ok(())) => Ok(value),
        (Ok(value), Err(error)) if error.kind() == ErrorKind::NotFound => Ok(value),
        (Ok(_), Err(error)) => Err(CommandError::internal(format!(
            "Failed to clean temporary cloned repository '{}': {}",
            cloned_repo_path.display(),
            error
        ))),
        (Err(error), _) => Err(error),
    }
}

fn resolve_github_manifest_path(
    repo_root: &Path,
    target_id: &str,
    github_skill_path: Option<&str>,
) -> Result<PathBuf, CommandError> {
    if let Some(github_skill_path) = github_skill_path {
        let explicit_manifest_path = resolve_explicit_manifest_path(repo_root, github_skill_path)?;
        if explicit_manifest_path.is_file() {
            return Ok(explicit_manifest_path);
        }
        return Err(CommandError::validation(format!(
            "payload.github_skill_path '{}' does not exist in the repository.",
            github_skill_path
        )));
    }

    let target_manifest = repo_root.join(target_id).join("SKILL.md");
    if target_manifest.is_file() {
        return Ok(target_manifest);
    }

    let root_manifest = repo_root.join("SKILL.md");
    if root_manifest.is_file() {
        return Ok(root_manifest);
    }

    let manifests = collect_skill_manifests(repo_root, 4)?;
    if manifests.is_empty() {
        return Err(CommandError::validation(format!(
            "No SKILL.md file was found in '{}' for target_id '{}'.",
            repo_root.display(),
            target_id
        )));
    }

    if manifests.len() == 1 {
        return Ok(manifests[0].clone());
    }

    let preview = manifests
        .iter()
        .take(4)
        .map(|path| path.display().to_string())
        .collect::<Vec<_>>()
        .join(", ");
    Err(CommandError::validation(format!(
        "Multiple SKILL.md files were found in '{}' for target_id '{}'. Set target_id to match one repository folder. Candidates: {}",
        repo_root.display(),
        target_id,
        preview
    )))
}

fn resolve_explicit_manifest_path(
    repo_root: &Path,
    github_skill_path: &str,
) -> Result<PathBuf, CommandError> {
    let trimmed = github_skill_path.trim().trim_start_matches('/');
    let candidate = PathBuf::from(trimmed);
    if candidate.as_os_str().is_empty() {
        return Err(CommandError::validation(
            "payload.github_skill_path must not be empty.",
        ));
    }
    if candidate.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        return Err(CommandError::validation(
            "payload.github_skill_path must be a relative path within the repository.",
        ));
    }
    let is_skill_manifest = candidate
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.eq_ignore_ascii_case("SKILL.md"));
    if !is_skill_manifest {
        return Err(CommandError::validation(
            "payload.github_skill_path must point to a SKILL.md file.",
        ));
    }

    Ok(repo_root.join(candidate))
}

fn make_temp_clone_path() -> PathBuf {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    std::env::temp_dir().join(format!(
        "ai-manager-skill-github-clone-{}-{}",
        std::process::id(),
        timestamp
    ))
}

fn clone_github_repo(repo_url: &str, destination: &Path) -> Result<(), CommandError> {
    let output = Command::new("git")
        .arg("clone")
        .arg("--depth")
        .arg("1")
        .arg(repo_url)
        .arg(destination)
        .output()
        .map_err(|error| {
            CommandError::internal(format!(
                "Failed to execute git clone for '{}': {}",
                repo_url, error
            ))
        })?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(CommandError::validation(format!(
        "Failed to clone GitHub repository '{}': {}",
        repo_url,
        stderr.trim()
    )))
}

fn collect_skill_manifests(root: &Path, max_depth: usize) -> Result<Vec<PathBuf>, CommandError> {
    let mut stack: Vec<(PathBuf, usize)> = vec![(root.to_path_buf(), 0)];
    let mut manifests: Vec<PathBuf> = Vec::new();

    while let Some((dir, depth)) = stack.pop() {
        let entries = fs::read_dir(&dir).map_err(|error| {
            CommandError::internal(format!(
                "Failed to enumerate cloned repository directory '{}': {}",
                dir.display(),
                error
            ))
        })?;

        for entry in entries {
            let entry = entry.map_err(|error| {
                CommandError::internal(format!(
                    "Failed to inspect cloned repository entry under '{}': {}",
                    dir.display(),
                    error
                ))
            })?;
            let path = entry.path();
            let file_type = entry.file_type().map_err(|error| {
                CommandError::internal(format!(
                    "Failed to inspect file type for '{}': {}",
                    path.display(),
                    error
                ))
            })?;

            if file_type.is_file()
                && path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.eq_ignore_ascii_case("SKILL.md"))
            {
                manifests.push(path);
                continue;
            }

            if file_type.is_dir() && depth < max_depth {
                stack.push((path, depth + 1));
            }
        }
    }

    manifests.sort_unstable();
    Ok(manifests)
}

fn suggest_target_id_from_path(relative_manifest_path: &str, normalized_repo_url: &str) -> String {
    let candidate = if relative_manifest_path.eq_ignore_ascii_case("SKILL.md") {
        normalized_repo_url
            .trim_end_matches('/')
            .split('/')
            .next_back()
            .unwrap_or("imported-skill")
            .to_string()
    } else {
        Path::new(relative_manifest_path)
            .parent()
            .and_then(|parent| parent.file_name())
            .and_then(|name| name.to_str())
            .unwrap_or("imported-skill")
            .to_string()
    };

    sanitize_target_id(&candidate)
}

fn sanitize_target_id(value: &str) -> String {
    let mut sanitized = String::with_capacity(value.len());
    let mut previous_dash = false;
    for character in value.chars() {
        let normalized = character.to_ascii_lowercase();
        if normalized.is_ascii_alphanumeric() || normalized == '_' {
            sanitized.push(normalized);
            previous_dash = false;
            continue;
        }
        if !previous_dash {
            sanitized.push('-');
            previous_dash = true;
        }
    }
    let trimmed = sanitized.trim_matches('-');
    if trimmed.is_empty() {
        "imported-skill".to_string()
    } else {
        trimmed.to_string()
    }
}

fn path_to_posix(path: &Path) -> String {
    path.components()
        .map(|component| component.as_os_str().to_string_lossy().to_string())
        .collect::<Vec<_>>()
        .join("/")
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use super::{
        normalize_github_repo_url, resolve_explicit_manifest_path, sanitize_target_id,
        suggest_target_id_from_path,
    };

    #[test]
    fn normalize_github_repo_url_accepts_dot_git_suffix() {
        let normalized = normalize_github_repo_url("https://github.com/thundermiracle/skills.git/")
            .expect("url should normalize");

        assert_eq!(normalized, "https://github.com/thundermiracle/skills");
    }

    #[test]
    fn sanitize_target_id_normalizes_non_ascii_and_symbols() {
        let sanitized = sanitize_target_id("Python Refactor!@#");
        assert_eq!(sanitized, "python-refactor");
    }

    #[test]
    fn target_id_suggestion_uses_repo_name_for_root_skill() {
        let suggestion = suggest_target_id_from_path("SKILL.md", "https://github.com/acme/skills");
        assert_eq!(suggestion, "skills");
    }

    #[test]
    fn resolve_explicit_manifest_path_rejects_parent_traversal() {
        let error = resolve_explicit_manifest_path(Path::new("/tmp/repo"), "../SKILL.md")
            .expect_err("parent traversal should fail");

        assert!(error.message.contains("relative path"));
    }

    #[test]
    fn resolve_explicit_manifest_path_accepts_relative_skill_md() {
        let root =
            std::env::temp_dir().join(format!("ai-manager-explicit-path-{}", std::process::id()));
        let _ = fs::create_dir_all(root.join("python-refactor"));
        let manifest_path = root.join("python-refactor").join("SKILL.md");
        fs::write(&manifest_path, "# Skill").expect("should write manifest");

        let resolved = resolve_explicit_manifest_path(&root, "python-refactor/SKILL.md")
            .expect("path should resolve");
        let _ = fs::remove_dir_all(&root);

        assert_eq!(resolved, manifest_path);
    }
}
