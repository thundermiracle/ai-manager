use std::path::Path;

use super::{
    atomic_writer::AtomicWriter,
    backup_manager::{BackupArtifact, BackupManager},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SafeFileMutationResult {
    pub backup_path: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MutationStage {
    Backup,
    Write,
    PostWriteValidation,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MutationFailure {
    pub stage: MutationStage,
    pub message: String,
    pub rollback_succeeded: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct MutationTestHooks {
    pub fail_after_backup: bool,
    pub fail_after_write: bool,
}

pub struct SafeFileMutator {
    backup_manager: BackupManager,
    atomic_writer: AtomicWriter,
}

impl SafeFileMutator {
    pub fn new() -> Self {
        Self {
            backup_manager: BackupManager::new(),
            atomic_writer: AtomicWriter::new(),
        }
    }

    pub fn replace_file(
        &self,
        target_path: &Path,
        new_content: &[u8],
    ) -> Result<SafeFileMutationResult, MutationFailure> {
        self.replace_file_with_hooks(target_path, new_content, MutationTestHooks::default())
    }

    pub(crate) fn replace_file_with_hooks(
        &self,
        target_path: &Path,
        new_content: &[u8],
        hooks: MutationTestHooks,
    ) -> Result<SafeFileMutationResult, MutationFailure> {
        let backup = self
            .backup_manager
            .create_backup(target_path)
            .map_err(|error| MutationFailure {
                stage: MutationStage::Backup,
                message: error.to_string(),
                rollback_succeeded: false,
            })?;

        if hooks.fail_after_backup {
            return Err(self.rollback_with_error(
                target_path,
                &backup,
                MutationStage::Backup,
                "Injected failure after backup.".to_string(),
            ));
        }

        if let Err(error) = self.atomic_writer.replace_file(target_path, new_content) {
            return Err(self.rollback_with_error(
                target_path,
                &backup,
                MutationStage::Write,
                error.to_string(),
            ));
        }

        if hooks.fail_after_write {
            return Err(self.rollback_with_error(
                target_path,
                &backup,
                MutationStage::PostWriteValidation,
                "Injected failure after atomic write.".to_string(),
            ));
        }

        Ok(SafeFileMutationResult {
            backup_path: backup
                .backup_path
                .as_ref()
                .map(|path| path.display().to_string()),
        })
    }

    fn rollback_with_error(
        &self,
        target_path: &Path,
        backup: &BackupArtifact,
        stage: MutationStage,
        original_message: String,
    ) -> MutationFailure {
        match self.backup_manager.restore_backup(target_path, backup) {
            Ok(()) => MutationFailure {
                stage,
                message: original_message,
                rollback_succeeded: true,
            },
            Err(rollback_error) => MutationFailure {
                stage,
                message: format!("{original_message} Rollback failed: {rollback_error}"),
                rollback_succeeded: false,
            },
        }
    }
}

impl Default for SafeFileMutator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::{MutationStage, MutationTestHooks, SafeFileMutator};

    #[test]
    fn successful_replace_creates_backup_and_updates_content() {
        let temp_dir =
            std::env::temp_dir().join(format!("ai-manager-safe-mutate-{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);
        let target = temp_dir.join("mcp.json");
        fs::write(&target, "{\"enabled\":false}").expect("should create target");

        let result = SafeFileMutator::new()
            .replace_file(&target, b"{\"enabled\":true}")
            .expect("replace should succeed");

        let content = fs::read_to_string(&target).expect("should read updated target");
        let _ = fs::remove_dir_all(&temp_dir);

        assert_eq!(content, "{\"enabled\":true}");
        assert!(result.backup_path.is_some());
    }

    #[test]
    fn rollback_restores_original_content_when_post_write_fails() {
        let temp_dir =
            std::env::temp_dir().join(format!("ai-manager-safe-rollback-{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);
        let target = temp_dir.join("config.json");
        fs::write(&target, "{\"version\":1}").expect("should create target");

        let error = SafeFileMutator::new()
            .replace_file_with_hooks(
                &target,
                b"{\"version\":2}",
                MutationTestHooks {
                    fail_after_backup: false,
                    fail_after_write: true,
                },
            )
            .expect_err("post-write failure should trigger rollback");

        let content = fs::read_to_string(&target).expect("should read rolled back file");
        let _ = fs::remove_dir_all(&temp_dir);

        assert!(matches!(error.stage, MutationStage::PostWriteValidation));
        assert!(error.rollback_succeeded);
        assert_eq!(content, "{\"version\":1}");
    }

    #[test]
    fn rollback_removes_new_file_when_target_did_not_exist() {
        let temp_dir =
            std::env::temp_dir().join(format!("ai-manager-safe-new-file-{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);
        let target = temp_dir.join("new-config.json");

        let error = SafeFileMutator::new()
            .replace_file_with_hooks(
                &target,
                b"{\"created\":true}",
                MutationTestHooks {
                    fail_after_backup: false,
                    fail_after_write: true,
                },
            )
            .expect_err("post-write failure should rollback new file");

        let _ = fs::remove_dir_all(&temp_dir);

        assert!(matches!(error.stage, MutationStage::PostWriteValidation));
        assert!(error.rollback_succeeded);
        assert!(!target.exists());
    }
}
