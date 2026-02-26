use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BackupArtifact {
    pub backup_path: Option<PathBuf>,
    pub target_existed: bool,
}

pub struct BackupManager;

impl BackupManager {
    pub fn new() -> Self {
        Self
    }

    pub fn create_backup(&self, target_path: &Path) -> std::io::Result<BackupArtifact> {
        if !target_path.exists() {
            return Ok(BackupArtifact {
                backup_path: None,
                target_existed: false,
            });
        }

        if !target_path.is_file() {
            return Err(std::io::Error::other(format!(
                "target path '{}' is not a file",
                target_path.display()
            )));
        }

        let backup_path = build_backup_path(target_path)?;
        if let Some(parent) = backup_path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::copy(target_path, &backup_path)?;

        Ok(BackupArtifact {
            backup_path: Some(backup_path),
            target_existed: true,
        })
    }

    pub fn restore_backup(
        &self,
        target_path: &Path,
        backup: &BackupArtifact,
    ) -> std::io::Result<()> {
        if backup.target_existed {
            let Some(backup_path) = backup.backup_path.as_ref() else {
                return Err(std::io::Error::other(
                    "missing backup path for existing target",
                ));
            };
            fs::copy(backup_path, target_path)?;
        } else if target_path.exists() {
            fs::remove_file(target_path)?;
        }

        Ok(())
    }
}

impl Default for BackupManager {
    fn default() -> Self {
        Self::new()
    }
}

fn build_backup_path(target_path: &Path) -> std::io::Result<PathBuf> {
    let parent = target_path.parent().ok_or_else(|| {
        std::io::Error::other(format!(
            "target path '{}' has no parent directory",
            target_path.display()
        ))
    })?;

    let filename = target_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "target".to_string());
    let timestamp_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(std::io::Error::other)?
        .as_millis();

    Ok(parent
        .join(".ai-manager-backups")
        .join(format!("{}.{}.bak", filename, timestamp_ms)))
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::BackupManager;

    #[test]
    fn create_and_restore_backup_for_existing_file() {
        let temp_dir =
            std::env::temp_dir().join(format!("ai-manager-backup-test-{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);

        let target = temp_dir.join("config.json");
        fs::write(&target, "{\"before\":true}").expect("should create target file");

        let manager = BackupManager::new();
        let backup = manager
            .create_backup(&target)
            .expect("should create backup artifact");

        fs::write(&target, "{\"before\":false}").expect("should mutate target");
        manager
            .restore_backup(&target, &backup)
            .expect("should restore backup");

        let restored = fs::read_to_string(&target).expect("should read restored target");
        let _ = fs::remove_dir_all(&temp_dir);

        assert_eq!(restored, "{\"before\":true}");
        assert!(backup.backup_path.is_some());
        assert!(backup.target_existed);
    }
}
