use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

pub struct AtomicWriter;

impl AtomicWriter {
    pub fn new() -> Self {
        Self
    }

    pub fn replace_file(&self, target_path: &Path, new_content: &[u8]) -> std::io::Result<()> {
        let temp_path = build_temp_path(target_path)?;
        let parent = target_path.parent().ok_or_else(|| {
            std::io::Error::other(format!(
                "target path '{}' has no parent directory",
                target_path.display()
            ))
        })?;
        fs::create_dir_all(parent)?;

        {
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temp_path)?;
            file.write_all(new_content)?;
            file.sync_all()?;
        }

        if let Err(error) = fs::rename(&temp_path, target_path) {
            let _ = fs::remove_file(&temp_path);
            return Err(error);
        }

        Ok(())
    }
}

impl Default for AtomicWriter {
    fn default() -> Self {
        Self::new()
    }
}

fn build_temp_path(target_path: &Path) -> std::io::Result<PathBuf> {
    let parent = target_path.parent().ok_or_else(|| {
        std::io::Error::other(format!(
            "target path '{}' has no parent directory",
            target_path.display()
        ))
    })?;

    let filename = target_path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "target".to_string());

    let timestamp_nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(std::io::Error::other)?
        .as_nanos();

    Ok(parent.join(format!(
        ".{}.{}.{}.tmp",
        filename,
        std::process::id(),
        timestamp_nanos
    )))
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::AtomicWriter;

    #[test]
    fn replace_file_updates_target_content_atomically() {
        let temp_dir =
            std::env::temp_dir().join(format!("ai-manager-atomic-write-{}", std::process::id()));
        let _ = fs::create_dir_all(&temp_dir);

        let target = temp_dir.join("config.toml");
        fs::write(&target, "enabled = false").expect("should create initial target");

        AtomicWriter::new()
            .replace_file(&target, b"enabled = true")
            .expect("atomic replace should succeed");

        let content = fs::read_to_string(&target).expect("should read replaced target");
        let _ = fs::remove_dir_all(&temp_dir);

        assert_eq!(content, "enabled = true");
    }
}
