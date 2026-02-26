use crate::contracts::{
    common::ClientKind,
    detect::{ClientDetection, DetectClientsRequest, DetectionEvidence, DetectionStatus},
};

use super::probe::{ConfigProbe, probe_binary_path, probe_config_path};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DetectorKind {
    Cli,
    Desktop,
}

#[derive(Debug, Clone, Copy)]
pub struct PathBasedDetectorConfig {
    pub client: ClientKind,
    pub display_name: &'static str,
    pub kind: DetectorKind,
    pub binary_candidates: &'static [&'static str],
    pub config_override_env_var: &'static str,
    pub config_fallback_paths: &'static [&'static str],
}

pub fn evaluate_path_based_detector(
    config: &PathBasedDetectorConfig,
    request: &DetectClientsRequest,
) -> ClientDetection {
    let binary_path = probe_binary_path(config.binary_candidates);
    let config_probe =
        probe_config_path(config.config_override_env_var, config.config_fallback_paths);

    let (config_path, override_invalid_path) = match config_probe {
        ConfigProbe::Resolved(path) => (Some(path), None),
        ConfigProbe::OverrideInvalid(path) => (None, Some(path)),
        ConfigProbe::Missing => (None, None),
    };

    let (status, confidence, note) = resolve_status_and_note(
        config,
        binary_path.is_some(),
        config_path.is_some(),
        override_invalid_path.as_deref(),
    );

    let evidence = DetectionEvidence {
        binary_path,
        config_path,
        version: if request.include_versions {
            Some("not_collected".to_string())
        } else {
            None
        },
    };

    ClientDetection {
        client: config.client,
        status,
        confidence,
        evidence,
        note,
    }
}

fn resolve_status_and_note(
    config: &PathBasedDetectorConfig,
    binary_found: bool,
    config_found: bool,
    override_invalid_path: Option<&str>,
) -> (DetectionStatus, u8, String) {
    if let Some(invalid_path) = override_invalid_path {
        return (
            DetectionStatus::Partial,
            20,
            format!(
                "{} override '{}' is set but unreadable: {}",
                config.display_name, config.config_override_env_var, invalid_path
            ),
        );
    }

    match config.kind {
        DetectorKind::Cli => match (binary_found, config_found) {
            (true, true) => (
                DetectionStatus::Detected,
                100,
                format!(
                    "{} detector resolved both binary and config evidence.",
                    config.display_name
                ),
            ),
            (true, false) | (false, true) => (
                DetectionStatus::Partial,
                60,
                format!(
                    "{} detector resolved partial evidence (binary: {}, config: {}).",
                    config.display_name, binary_found, config_found
                ),
            ),
            (false, false) => (
                DetectionStatus::Absent,
                0,
                format!(
                    "{} detector did not resolve any evidence.",
                    config.display_name
                ),
            ),
        },
        DetectorKind::Desktop => {
            if config_found {
                (
                    DetectionStatus::Detected,
                    90,
                    format!(
                        "{} detector resolved configuration evidence.",
                        config.display_name
                    ),
                )
            } else if binary_found {
                (
                    DetectionStatus::Partial,
                    45,
                    format!(
                        "{} detector resolved binary evidence only.",
                        config.display_name
                    ),
                )
            } else {
                (
                    DetectionStatus::Absent,
                    0,
                    format!(
                        "{} detector did not resolve any evidence.",
                        config.display_name
                    ),
                )
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::contracts::{common::ClientKind, detect::DetectionStatus};

    use super::{DetectorKind, PathBasedDetectorConfig, resolve_status_and_note};

    #[test]
    fn invalid_override_resolves_to_partial_state() {
        let config = PathBasedDetectorConfig {
            client: ClientKind::CodexCli,
            display_name: "Test CLI",
            kind: DetectorKind::Cli,
            binary_candidates: &[],
            config_override_env_var: "AI_MANAGER_TEST_INVALID_OVERRIDE",
            config_fallback_paths: &[],
        };

        let (status, confidence, note) =
            resolve_status_and_note(&config, false, false, Some("/definitely/not/a/file.json"));

        assert!(matches!(status, DetectionStatus::Partial));
        assert_eq!(confidence, 20);
        assert!(note.contains("AI_MANAGER_TEST_INVALID_OVERRIDE"));
    }
}
