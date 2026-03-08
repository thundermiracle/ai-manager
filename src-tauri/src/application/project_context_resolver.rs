use std::{env, fs, path::PathBuf};

use crate::interface::contracts::command::CommandError;

#[derive(Debug, Clone, Default)]
pub struct ProjectContextResolver {
    home_dir: Option<PathBuf>,
}

impl ProjectContextResolver {
    pub fn new() -> Self {
        Self {
            home_dir: env::var_os("HOME").map(PathBuf::from),
        }
    }

    pub fn resolve(&self, project_root: Option<&str>) -> Result<Option<String>, CommandError> {
        let Some(project_root) = project_root.map(str::trim) else {
            return Ok(None);
        };

        if project_root.is_empty() {
            return Ok(None);
        }

        let expanded = self.expand_user_path(project_root)?;

        if !expanded.exists() {
            return Err(CommandError::validation(
                "project_root must reference an existing directory.",
            ));
        }

        if !expanded.is_dir() {
            return Err(CommandError::validation(
                "project_root must reference a directory.",
            ));
        }

        let canonical = fs::canonicalize(&expanded)
            .map_err(|_| CommandError::validation("project_root could not be canonicalized."))?;

        Ok(Some(canonical.to_string_lossy().into_owned()))
    }

    fn expand_user_path(&self, value: &str) -> Result<PathBuf, CommandError> {
        if value == "~" {
            return self.home_dir.clone().ok_or_else(|| {
                CommandError::validation("project_root uses '~' but HOME is not available.")
            });
        }

        if let Some(relative_path) = value.strip_prefix("~/") {
            let Some(home_dir) = &self.home_dir else {
                return Err(CommandError::validation(
                    "project_root uses '~' but HOME is not available.",
                ));
            };

            return Ok(home_dir.join(relative_path));
        }

        Ok(PathBuf::from(value))
    }

    #[cfg(test)]
    fn with_home_dir(home_dir: Option<PathBuf>) -> Self {
        Self { home_dir }
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::ProjectContextResolver;

    #[test]
    fn resolve_returns_none_when_project_root_is_missing_or_blank() {
        let resolver = ProjectContextResolver::with_home_dir(None);

        assert_eq!(
            resolver.resolve(None).expect("missing root should pass"),
            None
        );
        assert_eq!(
            resolver
                .resolve(Some("   "))
                .expect("blank root should pass"),
            None
        );
    }

    #[test]
    fn resolve_expands_home_relative_paths() {
        let home_dir = test_root("home");
        let project_root = home_dir.join("workspace");
        fs::create_dir_all(&project_root).expect("home project root should exist");
        let expected_root = project_root
            .canonicalize()
            .expect("canonical path")
            .display()
            .to_string();

        let resolver = ProjectContextResolver::with_home_dir(Some(home_dir.clone()));
        let resolved = resolver
            .resolve(Some("~/workspace"))
            .expect("home relative path should resolve");

        let _ = fs::remove_dir_all(&home_dir);

        assert_eq!(resolved, Some(expected_root));
    }

    #[test]
    fn resolve_rejects_missing_directories() {
        let resolver = ProjectContextResolver::with_home_dir(None);
        let missing_root = test_root("missing");

        let error = resolver
            .resolve(Some(&missing_root.display().to_string()))
            .expect_err("missing project root should fail");

        assert!(error.message.contains("existing directory"));
    }

    #[test]
    fn resolve_rejects_files() {
        let root = test_root("file");
        fs::create_dir_all(&root).expect("root should be writable");
        let file_path = root.join("project.txt");
        fs::write(&file_path, "not a directory").expect("file should be writable");

        let resolver = ProjectContextResolver::with_home_dir(None);
        let error = resolver
            .resolve(Some(&file_path.display().to_string()))
            .expect_err("file path should fail");

        let _ = fs::remove_dir_all(&root);

        assert!(error.message.contains("reference a directory"));
    }

    #[test]
    fn resolve_canonicalizes_existing_directories() {
        let root = test_root("canonical");
        let project_root = root.join("repo");
        fs::create_dir_all(&project_root).expect("project root should be writable");
        fs::create_dir_all(root.join("nested")).expect("nested path should exist");
        let expected_root = project_root
            .canonicalize()
            .expect("canonical path")
            .display()
            .to_string();

        let request_root = root.join("nested").join("..").join("repo");
        let resolver = ProjectContextResolver::with_home_dir(None);
        let resolved = resolver
            .resolve(Some(&request_root.display().to_string()))
            .expect("existing project root should resolve");

        let _ = fs::remove_dir_all(&root);

        assert_eq!(resolved, Some(expected_root));
    }

    fn test_root(name: &str) -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!(
            "ai-manager-project-context-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        root
    }
}
