use crate::interface::contracts::{
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
    pub config_override_env_vars: &'static [&'static str],
    pub config_fallback_paths: &'static [&'static str],
}

pub fn evaluate_path_based_detector(
    config: &PathBasedDetectorConfig,
    request: &DetectClientsRequest,
) -> ClientDetection {
    let binary_path = probe_binary_path(config.binary_candidates);
    let config_probe = probe_config_path(
        config.config_override_env_vars,
        config.config_fallback_paths,
    );

    let (config_path, probe_issue) = match config_probe {
        ConfigProbe::Resolved(path) => (Some(path), None),
        ConfigProbe::OverrideMissing(path) => (None, Some(ProbeIssue::OverrideMissing(path))),
        ConfigProbe::OverridePermissionDenied(path) => {
            (None, Some(ProbeIssue::OverridePermissionDenied(path)))
        }
        ConfigProbe::PermissionDenied(path) => (None, Some(ProbeIssue::PermissionDenied(path))),
        ConfigProbe::Missing => (None, None),
    };

    let (status, confidence, note) = resolve_status_and_note(
        config,
        binary_path.is_some(),
        config_path.is_some(),
        probe_issue.as_ref(),
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

#[derive(Debug, Clone)]
enum ProbeIssue {
    OverrideMissing(String),
    OverridePermissionDenied(String),
    PermissionDenied(String),
}

fn resolve_status_and_note(
    config: &PathBasedDetectorConfig,
    binary_found: bool,
    config_found: bool,
    probe_issue: Option<&ProbeIssue>,
) -> (DetectionStatus, u8, String) {
    if let Some(issue) = probe_issue {
        return match issue {
            ProbeIssue::OverrideMissing(path) => (
                DetectionStatus::Partial,
                20,
                format!(
                    "[config_override_missing] {} override '{}' points to missing config: {}",
                    config.display_name, config.config_override_env_vars[0], path
                ),
            ),
            ProbeIssue::OverridePermissionDenied(path) => (
                DetectionStatus::Error,
                0,
                format!(
                    "[config_permission_denied] {} override '{}' is not readable: {}",
                    config.display_name, config.config_override_env_vars[0], path
                ),
            ),
            ProbeIssue::PermissionDenied(path) => (
                DetectionStatus::Error,
                0,
                format!(
                    "[config_permission_denied] {} fallback config is not readable: {}",
                    config.display_name, path
                ),
            ),
        };
    }

    match config.kind {
        DetectorKind::Cli => match (binary_found, config_found) {
            (true, true) => (
                DetectionStatus::Detected,
                100,
                format!(
                    "[detected] {} detector resolved both binary and config evidence.",
                    config.display_name
                ),
            ),
            (true, false) => (
                DetectionStatus::Partial,
                60,
                format!(
                    "[config_missing] {} binary resolved but config was not found.",
                    config.display_name
                ),
            ),
            (false, true) => (
                DetectionStatus::Partial,
                60,
                format!(
                    "[binary_missing] {} config resolved but binary was not found.",
                    config.display_name
                ),
            ),
            (false, false) => (
                DetectionStatus::Absent,
                0,
                format!(
                    "[binary_and_config_missing] {} detector did not resolve any evidence.",
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
                        "[config_detected] {} detector resolved configuration evidence.",
                        config.display_name
                    ),
                )
            } else if binary_found {
                (
                    DetectionStatus::Partial,
                    45,
                    format!(
                        "[binary_only] {} detector resolved binary evidence only.",
                        config.display_name
                    ),
                )
            } else {
                (
                    DetectionStatus::Absent,
                    0,
                    format!(
                        "[evidence_missing] {} detector did not resolve any evidence.",
                        config.display_name
                    ),
                )
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::interface::contracts::{common::ClientKind, detect::DetectionStatus};

    use super::{DetectorKind, PathBasedDetectorConfig, ProbeIssue, resolve_status_and_note};

    #[test]
    fn missing_override_resolves_to_partial_state() {
        let config = PathBasedDetectorConfig {
            client: ClientKind::Codex,
            display_name: "Test CLI",
            kind: DetectorKind::Cli,
            binary_candidates: &[],
            config_override_env_vars: &["AI_MANAGER_TEST_INVALID_OVERRIDE"],
            config_fallback_paths: &[],
        };

        let (status, confidence, note) = resolve_status_and_note(
            &config,
            false,
            false,
            Some(&ProbeIssue::OverrideMissing(
                "/definitely/not/a/file.json".to_string(),
            )),
        );

        assert!(matches!(status, DetectionStatus::Partial));
        assert_eq!(confidence, 20);
        assert!(note.contains("AI_MANAGER_TEST_INVALID_OVERRIDE"));
        assert!(note.contains("[config_override_missing]"));
    }

    #[test]
    fn cli_detection_fixtures_distinguish_binary_and_config_failures() {
        let config = PathBasedDetectorConfig {
            client: ClientKind::ClaudeCode,
            display_name: "Claude Code",
            kind: DetectorKind::Cli,
            binary_candidates: &[],
            config_override_env_vars: &["AI_MANAGER_CLAUDE_CODE_MCP_CONFIG"],
            config_fallback_paths: &[],
        };

        let fixtures = vec![
            (true, true, DetectionStatus::Detected, "[detected]"),
            (true, false, DetectionStatus::Partial, "[config_missing]"),
            (false, true, DetectionStatus::Partial, "[binary_missing]"),
            (
                false,
                false,
                DetectionStatus::Absent,
                "[binary_and_config_missing]",
            ),
        ];

        for (binary_found, config_found, expected_status, reason_code) in fixtures {
            let (status, _, note) =
                resolve_status_and_note(&config, binary_found, config_found, None);
            assert_eq!(status, expected_status);
            assert!(note.contains(reason_code));
        }
    }

    #[test]
    fn desktop_detector_surfaces_permission_failures_as_error() {
        let config = PathBasedDetectorConfig {
            client: ClientKind::Cursor,
            display_name: "Cursor",
            kind: DetectorKind::Desktop,
            binary_candidates: &[],
            config_override_env_vars: &["AI_MANAGER_CURSOR_MCP_CONFIG"],
            config_fallback_paths: &[],
        };

        let (status, confidence, note) = resolve_status_and_note(
            &config,
            false,
            false,
            Some(&ProbeIssue::PermissionDenied(
                "/tmp/unreadable/mcp.json".to_string(),
            )),
        );

        assert!(matches!(status, DetectionStatus::Error));
        assert_eq!(confidence, 0);
        assert!(note.contains("[config_permission_denied]"));
    }
}
