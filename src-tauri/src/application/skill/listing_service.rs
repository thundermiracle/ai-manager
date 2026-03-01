use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::contracts::{common::ClientKind, list::ResourceRecord};

use super::{
    metadata_parser::parse_skill_metadata,
    path_resolver::{SkillDirResolution, resolve_skill_dir},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SkillListResult {
    pub items: Vec<ResourceRecord>,
    pub warning: Option<String>,
}

pub struct SkillListingService;

impl SkillListingService {
    pub fn new() -> Self {
        Self
    }

    pub fn list(&self, client: ClientKind, enabled_filter: Option<bool>) -> SkillListResult {
        let SkillDirResolution {
            path: maybe_root,
            mut warnings,
        } = resolve_skill_dir(client);

        let Some(root) = maybe_root else {
            return SkillListResult {
                items: Vec::new(),
                warning: (!warnings.is_empty()).then(|| warnings.join(" | ")),
            };
        };

        let scan_outcome = collect_skills_from_directory(client, &root, enabled_filter);
        warnings.extend(scan_outcome.warnings);

        SkillListResult {
            items: scan_outcome.items,
            warning: (!warnings.is_empty()).then(|| warnings.join(" | ")),
        }
    }
}

impl Default for SkillListingService {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SkillScanOutcome {
    items: Vec<ResourceRecord>,
    warnings: Vec<String>,
}

fn collect_skills_from_directory(
    client: ClientKind,
    root: &Path,
    enabled_filter: Option<bool>,
) -> SkillScanOutcome {
    let mut items: Vec<ResourceRecord> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();

    let mut candidate_paths: Vec<PathBuf> = match fs::read_dir(root) {
        Ok(entries) => entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .collect(),
        Err(error) => {
            warnings.push(format!(
                "[{}:SKILLS_DIR_READ_ERROR] failed to read '{}': {}",
                client.as_str(),
                root.display(),
                error
            ));
            return SkillScanOutcome { items, warnings };
        }
    };

    candidate_paths.sort_unstable_by(|left, right| left.as_os_str().cmp(right.as_os_str()));

    for candidate_path in candidate_paths {
        let Some(manifest_candidate) = resolve_manifest_candidate(&candidate_path) else {
            continue;
        };

        let manifest_source = match fs::read_to_string(&manifest_candidate.manifest_path) {
            Ok(source) => source,
            Err(error) => {
                warnings.push(format!(
                    "[{}:SKILL_READ_ERROR] failed to read '{}': {}",
                    client.as_str(),
                    manifest_candidate.manifest_path.display(),
                    error
                ));
                continue;
            }
        };

        let enabled = true;
        if let Some(filter) = enabled_filter
            && enabled != filter
        {
            continue;
        }

        let metadata = parse_skill_metadata(&manifest_source);
        items.push(ResourceRecord {
            id: format!("{}::skill::{}", client.as_str(), manifest_candidate.name),
            client,
            display_name: manifest_candidate.name,
            enabled,
            transport_kind: None,
            transport_command: None,
            transport_args: None,
            transport_url: None,
            source_path: Some(manifest_candidate.manifest_path.display().to_string()),
            description: metadata.description,
            install_kind: Some(manifest_candidate.install_kind.to_string()),
            manifest_content: Some(manifest_source),
        });
    }

    items.sort_by(|left, right| {
        (left.display_name.as_str(), left.id.as_str())
            .cmp(&(right.display_name.as_str(), right.id.as_str()))
    });

    SkillScanOutcome { items, warnings }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SkillManifestCandidate {
    name: String,
    install_kind: &'static str,
    manifest_path: PathBuf,
}

fn resolve_manifest_candidate(path: &Path) -> Option<SkillManifestCandidate> {
    if path.is_dir() {
        let manifest_path = path.join("SKILL.md");
        if !manifest_path.is_file() {
            return None;
        }

        let name = path.file_name()?.to_string_lossy().to_string();
        return Some(SkillManifestCandidate {
            name,
            install_kind: "directory",
            manifest_path,
        });
    }

    if path.is_file() {
        let extension = path.extension()?.to_string_lossy().to_ascii_lowercase();
        if extension != "md" {
            return None;
        }

        let name = path.file_stem()?.to_string_lossy().to_string();
        return Some(SkillManifestCandidate {
            name,
            install_kind: "file",
            manifest_path: path.to_path_buf(),
        });
    }

    None
}

#[cfg(test)]
mod tests {
    use std::fs;

    use crate::contracts::common::ClientKind;

    use super::collect_skills_from_directory;

    #[test]
    fn scans_directory_and_file_skill_installs_with_metadata() {
        let temp_root = test_root("scan");
        let _ = fs::create_dir_all(&temp_root);

        let directory_skill = temp_root.join("python-refactor");
        let _ = fs::create_dir_all(&directory_skill);
        fs::write(
            directory_skill.join("SKILL.md"),
            "# Python Refactor\n\nRefactor Python code safely.\n",
        )
        .expect("should create directory skill");

        fs::write(
            temp_root.join("quick-fix.md"),
            "# Quick Fix\n\nSmall debugging helper.\n",
        )
        .expect("should create file skill");

        let outcome = collect_skills_from_directory(ClientKind::Cursor, &temp_root, None);

        let _ = fs::remove_dir_all(&temp_root);

        assert_eq!(outcome.items.len(), 2);
        assert!(outcome.warnings.is_empty());
        assert!(
            outcome
                .items
                .iter()
                .any(|item| item.install_kind.as_deref() == Some("directory"))
        );
        assert!(
            outcome
                .items
                .iter()
                .any(|item| item.install_kind.as_deref() == Some("file"))
        );
        assert!(
            outcome
                .items
                .iter()
                .all(|item| item.description.is_some() && item.source_path.is_some())
        );
    }

    #[test]
    fn malformed_skill_entries_do_not_break_listing() {
        let temp_root = test_root("malformed");
        let _ = fs::create_dir_all(&temp_root);

        let valid_skill = temp_root.join("safe-skill");
        let _ = fs::create_dir_all(&valid_skill);
        fs::write(valid_skill.join("SKILL.md"), "# Safe Skill\n\nWorks.\n")
            .expect("should create valid skill");

        fs::write(temp_root.join("broken.md"), [0xff, 0xfe, 0x00])
            .expect("should create malformed skill");

        let outcome = collect_skills_from_directory(ClientKind::CodexCli, &temp_root, None);

        let _ = fs::remove_dir_all(&temp_root);

        assert_eq!(outcome.items.len(), 1);
        assert!(outcome.warnings.iter().any(|warning| {
            warning.contains("SKILL_READ_ERROR") && warning.contains("broken.md")
        }));
    }

    #[test]
    fn enabled_filter_false_returns_empty_skill_set() {
        let temp_root = test_root("enabled-filter");
        let _ = fs::create_dir_all(&temp_root);

        let valid_skill = temp_root.join("safe-skill");
        let _ = fs::create_dir_all(&valid_skill);
        fs::write(valid_skill.join("SKILL.md"), "# Safe Skill\n\nWorks.\n")
            .expect("should create valid skill");

        let outcome = collect_skills_from_directory(ClientKind::CodexApp, &temp_root, Some(false));

        let _ = fs::remove_dir_all(&temp_root);

        assert!(outcome.items.is_empty());
    }

    fn test_root(suffix: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "ai-manager-skill-listing-{}-{}",
            std::process::id(),
            suffix
        ))
    }
}
