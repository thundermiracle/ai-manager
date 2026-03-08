use std::{collections::HashMap, fs, path::Path};

use crate::{
    domain::{ClientKind, ResourceSourceMetadata, ResourceSourceScope},
    interface::contracts::list::{ResourceRecord, ResourceViewMode},
};

use super::{
    metadata_parser::parse_subagent_metadata,
    source_catalog_service::{SubagentSourceCatalogService, SubagentSourceDescriptor},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubagentListResult {
    pub items: Vec<ResourceRecord>,
    pub warning: Option<String>,
}

pub struct SubagentListingService;

impl SubagentListingService {
    pub fn new() -> Self {
        Self
    }

    pub fn list(
        &self,
        client: ClientKind,
        project_root: Option<&str>,
        enabled_filter: Option<bool>,
        view_mode: ResourceViewMode,
        scope_filter: Option<&[ResourceSourceScope]>,
    ) -> SubagentListResult {
        let descriptors = SubagentSourceCatalogService::new().list_sources(client, project_root);
        collect_from_descriptors(descriptors, enabled_filter, view_mode, scope_filter)
    }
}

impl Default for SubagentListingService {
    fn default() -> Self {
        Self::new()
    }
}

fn collect_from_descriptors<I>(
    descriptors: I,
    enabled_filter: Option<bool>,
    view_mode: ResourceViewMode,
    scope_filter: Option<&[ResourceSourceScope]>,
) -> SubagentListResult
where
    I: IntoIterator<Item = SubagentSourceDescriptor>,
{
    let mut items: Vec<ResourceRecord> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();

    for descriptor in descriptors {
        if scope_filter.is_some_and(|scopes| !scopes.contains(&descriptor.source_scope)) {
            continue;
        }

        let scan_outcome = collect_subagents_from_directory(&descriptor, enabled_filter);
        items.extend(scan_outcome.items);
        warnings.extend(scan_outcome.warnings);
    }

    apply_effective_precedence(&mut items);
    if !matches!(view_mode, ResourceViewMode::AllSources) {
        items.retain(|item| item.is_effective);
    }

    items.sort_by(|left, right| {
        (
            left.client.as_str(),
            left.display_name.as_str(),
            left.id.as_str(),
        )
            .cmp(&(
                right.client.as_str(),
                right.display_name.as_str(),
                right.id.as_str(),
            ))
    });

    SubagentListResult {
        items,
        warning: (!warnings.is_empty()).then(|| warnings.join(" | ")),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SubagentScanOutcome {
    items: Vec<ResourceRecord>,
    warnings: Vec<String>,
}

fn collect_subagents_from_directory(
    descriptor: &SubagentSourceDescriptor,
    enabled_filter: Option<bool>,
) -> SubagentScanOutcome {
    let mut items: Vec<ResourceRecord> = Vec::new();
    let mut warnings: Vec<String> = Vec::new();

    if enabled_filter == Some(false) {
        return SubagentScanOutcome { items, warnings };
    }

    if !descriptor.directory_path.exists() {
        return SubagentScanOutcome { items, warnings };
    }

    let mut candidate_paths = match fs::read_dir(&descriptor.directory_path) {
        Ok(entries) => entries
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| is_markdown_file(path))
            .collect::<Vec<_>>(),
        Err(error) => {
            warnings.push(format!(
                "[{}:SUBAGENT_DIR_READ_ERROR] failed to read '{}': {}",
                descriptor.client.as_str(),
                descriptor.directory_path.display(),
                error
            ));
            return SubagentScanOutcome { items, warnings };
        }
    };

    candidate_paths.sort_unstable_by(|left, right| left.as_os_str().cmp(right.as_os_str()));

    for candidate_path in candidate_paths {
        let manifest_source = match fs::read_to_string(&candidate_path) {
            Ok(source) => source,
            Err(error) => {
                warnings.push(format!(
                    "[{}:SUBAGENT_READ_ERROR] failed to read '{}': {}",
                    descriptor.client.as_str(),
                    candidate_path.display(),
                    error
                ));
                continue;
            }
        };

        let fallback_name = candidate_path
            .file_stem()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_else(|| "subagent".to_string());
        let metadata = parse_subagent_metadata(&manifest_source);
        let logical_id = metadata
            .name
            .clone()
            .unwrap_or_else(|| fallback_name.clone());
        let display_name = metadata.name.unwrap_or(fallback_name);

        items.push(
            ResourceRecord {
                id: format!(
                    "{}::subagent::{}::{}",
                    descriptor.client.as_str(),
                    descriptor.source_id,
                    logical_id
                ),
                logical_id,
                client: descriptor.client,
                display_name,
                enabled: true,
                transport_kind: None,
                transport_command: None,
                transport_args: None,
                transport_url: None,
                source_path: Some(candidate_path.display().to_string()),
                source_id: String::new(),
                source_scope: descriptor.source_scope,
                source_label: String::new(),
                is_effective: true,
                shadowed_by: None,
                description: metadata.description,
                install_kind: Some("file".to_string()),
                manifest_content: Some(manifest_source),
            }
            .with_source_metadata(ResourceSourceMetadata {
                source_id: descriptor.source_id.clone(),
                source_scope: descriptor.source_scope,
                source_label: descriptor.source_label.clone(),
                is_effective: true,
                shadowed_by: None,
            }),
        );
    }

    SubagentScanOutcome { items, warnings }
}

fn is_markdown_file(path: &Path) -> bool {
    path.is_file()
        && path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
}

fn apply_effective_precedence(items: &mut [ResourceRecord]) {
    let mut indices_by_resource: HashMap<(String, String), Vec<usize>> = HashMap::new();

    for (index, item) in items.iter().enumerate() {
        indices_by_resource
            .entry((item.client.as_str().to_string(), item.logical_id.clone()))
            .or_default()
            .push(index);
    }

    for indices in indices_by_resource.values() {
        let Some((&winner_index, rest)) = indices.split_first() else {
            continue;
        };

        let winner_index = rest
            .iter()
            .copied()
            .fold(winner_index, |current, candidate| {
                if precedence_key(&items[candidate]) < precedence_key(&items[current]) {
                    candidate
                } else {
                    current
                }
            });

        let winner_id = items[winner_index].id.clone();
        for index in indices {
            let item = &mut items[*index];
            item.is_effective = *index == winner_index;
            item.shadowed_by = (*index != winner_index).then(|| winner_id.clone());
        }
    }
}

fn precedence_key(item: &ResourceRecord) -> (u8, &str, &str) {
    (
        precedence_rank(item.source_scope),
        item.source_id.as_str(),
        item.id.as_str(),
    )
}

fn precedence_rank(scope: ResourceSourceScope) -> u8 {
    match scope {
        ResourceSourceScope::ProjectShared => 0,
        ResourceSourceScope::User => 1,
        ResourceSourceScope::ProjectPrivate => 2,
    }
}

#[cfg(test)]
mod tests {
    use std::{fs, path::Path};

    use crate::{
        domain::{ClientKind, ResourceSourceScope},
        interface::contracts::list::ResourceViewMode,
    };

    use super::{SubagentSourceDescriptor, collect_from_descriptors, precedence_rank};

    #[test]
    fn project_subagent_shadows_personal_entry_in_all_sources_view() {
        let temp_root = test_root("shadowing");
        let user_dir = temp_root.join("user-agents");
        let project_dir = temp_root.join("project-agents");
        let _ = fs::create_dir_all(&user_dir);
        let _ = fs::create_dir_all(&project_dir);

        fs::write(
            user_dir.join("reviewer.md"),
            r#"---
name: reviewer
description: Reviews from personal scope.
---
"#,
        )
        .expect("should create user subagent");
        fs::write(
            project_dir.join("reviewer.md"),
            r#"---
name: reviewer
description: Reviews from project scope.
---
"#,
        )
        .expect("should create project subagent");

        let result = collect_from_descriptors(
            vec![
                descriptor(ResourceSourceScope::User, &user_dir),
                descriptor(ResourceSourceScope::ProjectShared, &project_dir),
            ],
            None,
            ResourceViewMode::AllSources,
            None,
        );

        let _ = fs::remove_dir_all(&temp_root);

        assert_eq!(result.items.len(), 2);
        assert!(result.warning.is_none());

        let project_item = result
            .items
            .iter()
            .find(|item| item.source_scope == ResourceSourceScope::ProjectShared)
            .expect("project item should exist");
        let user_item = result
            .items
            .iter()
            .find(|item| item.source_scope == ResourceSourceScope::User)
            .expect("user item should exist");

        assert!(project_item.is_effective);
        assert_eq!(
            user_item.shadowed_by.as_deref(),
            Some(project_item.id.as_str())
        );
        assert!(!user_item.is_effective);
    }

    #[test]
    fn effective_view_keeps_only_highest_precedence_entry() {
        let temp_root = test_root("effective-view");
        let user_dir = temp_root.join("user-agents");
        let project_dir = temp_root.join("project-agents");
        let _ = fs::create_dir_all(&user_dir);
        let _ = fs::create_dir_all(&project_dir);

        fs::write(user_dir.join("reviewer.md"), "# Reviewer\n\nPersonal.\n")
            .expect("should create user subagent");
        fs::write(project_dir.join("reviewer.md"), "# Reviewer\n\nProject.\n")
            .expect("should create project subagent");

        let result = collect_from_descriptors(
            vec![
                descriptor(ResourceSourceScope::User, &user_dir),
                descriptor(ResourceSourceScope::ProjectShared, &project_dir),
            ],
            None,
            ResourceViewMode::Effective,
            None,
        );

        let _ = fs::remove_dir_all(&temp_root);

        assert_eq!(result.items.len(), 1);
        assert_eq!(
            result.items[0].source_scope,
            ResourceSourceScope::ProjectShared
        );
        assert!(result.items[0].is_effective);
    }

    #[test]
    fn scope_filter_ignores_unrequested_sources() {
        let temp_root = test_root("scope-filter");
        let user_dir = temp_root.join("user-agents");
        let project_dir = temp_root.join("project-agents");
        let _ = fs::create_dir_all(&user_dir);
        let _ = fs::create_dir_all(&project_dir);

        fs::write(user_dir.join("reviewer.md"), "# Reviewer\n\nPersonal.\n")
            .expect("should create user subagent");
        fs::write(project_dir.join("reviewer.md"), "# Reviewer\n\nProject.\n")
            .expect("should create project subagent");

        let result = collect_from_descriptors(
            vec![
                descriptor(ResourceSourceScope::User, &user_dir),
                descriptor(ResourceSourceScope::ProjectShared, &project_dir),
            ],
            None,
            ResourceViewMode::AllSources,
            Some(&[ResourceSourceScope::ProjectShared]),
        );

        let _ = fs::remove_dir_all(&temp_root);

        assert_eq!(result.items.len(), 1);
        assert!(
            result
                .items
                .iter()
                .all(|item| item.source_scope == ResourceSourceScope::ProjectShared)
        );
    }

    #[test]
    fn precedence_prefers_project_scope_for_native_subagents() {
        assert!(
            precedence_rank(ResourceSourceScope::ProjectShared)
                < precedence_rank(ResourceSourceScope::User)
        );
    }

    fn descriptor(scope: ResourceSourceScope, directory_path: &Path) -> SubagentSourceDescriptor {
        SubagentSourceDescriptor {
            client: ClientKind::ClaudeCode,
            source_id: format!(
                "subagent::claude_code::{}::{}",
                scope.as_str(),
                directory_path.display()
            ),
            source_scope: scope,
            source_label: match scope {
                ResourceSourceScope::User => "Personal subagents directory".to_string(),
                ResourceSourceScope::ProjectShared => "Project subagents directory".to_string(),
                ResourceSourceScope::ProjectPrivate => {
                    "Project private subagents directory".to_string()
                }
            },
            directory_path: directory_path.to_path_buf(),
            project_root: None,
        }
    }

    fn test_root(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "ai-manager-subagents-{name}-{}",
            std::process::id()
        ))
    }
}
