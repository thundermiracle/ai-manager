use crate::interface::contracts::{
    common::ClientKind,
    detect::{ClientDetection, DetectClientsRequest, DetectionEvidence, DetectionStatus},
};

use super::probe::{
    ConfigProbe, probe_app_path, probe_binary_path, probe_cli_binary, probe_config_path,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DetectorKind {
    Cli,
    Desktop,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DetectionGate {
    CliVersion,
    AppInstall,
}

#[derive(Debug, Clone, Copy)]
pub struct PathBasedDetectorConfig {
    pub client: ClientKind,
    pub display_name: &'static str,
    pub kind: DetectorKind,
    pub detection_gate: DetectionGate,
    pub startup_probe_command: Option<&'static str>,
    pub binary_candidates: &'static [&'static str],
    pub app_candidates: &'static [&'static str],
    pub config_override_env_vars: &'static [&'static str],
    pub config_fallback_paths: &'static [&'static str],
}

pub fn evaluate_path_based_detector(
    config: &PathBasedDetectorConfig,
    request: &DetectClientsRequest,
) -> ClientDetection {
    let startup_probe_candidates: Vec<&str> = match config.startup_probe_command {
        Some(command) => vec![command],
        None => config.binary_candidates.to_vec(),
    };

    let (cli_found, binary_path, version) = match config.kind {
        DetectorKind::Cli | DetectorKind::Desktop => {
            let probe = probe_cli_binary(&startup_probe_candidates, request.include_versions);
            let binary_path = probe
                .binary_path
                .or_else(|| probe_binary_path(config.binary_candidates));
            (probe.found, binary_path, probe.version)
        }
    };
    let app_path = probe_app_path(config.app_candidates);
    let app_found = app_path.is_some();
    let gate_satisfied = match config.detection_gate {
        DetectionGate::CliVersion => cli_found,
        DetectionGate::AppInstall => app_found,
    };
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
        gate_satisfied,
        config_path.is_some(),
        probe_issue.as_ref(),
    );

    let evidence = DetectionEvidence {
        binary_path,
        app_path,
        config_path,
        version,
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
    gate_satisfied: bool,
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

    match config.detection_gate {
        DetectionGate::CliVersion => match (gate_satisfied, config_found) {
            (true, true) => (
                DetectionStatus::Detected,
                100,
                format!(
                    "[detected] {} detector resolved both binary and config evidence.",
                    config.display_name
                ),
            ),
            (true, false) => (
                DetectionStatus::Detected,
                85,
                format!(
                    "[binary_detected_config_missing] {} binary is executable (`--version`), config was not found.",
                    config.display_name
                ),
            ),
            (false, true) => (
                DetectionStatus::Partial,
                50,
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
        DetectionGate::AppInstall => {
            if gate_satisfied && config_found {
                (
                    DetectionStatus::Detected,
                    100,
                    format!(
                        "[detected] {} detector resolved both app installation and config evidence.",
                        config.display_name
                    ),
                )
            } else if gate_satisfied {
                (
                    DetectionStatus::Detected,
                    85,
                    format!(
                        "[app_detected_config_missing] {} app installation is present, config was not found.",
                        config.display_name
                    ),
                )
            } else if config_found {
                (
                    DetectionStatus::Partial,
                    50,
                    format!(
                        "[app_missing] {} config resolved but app installation was not found.",
                        config.display_name
                    ),
                )
            } else {
                (
                    DetectionStatus::Absent,
                    0,
                    format!(
                        "[app_and_config_missing] {} detector did not resolve app installation or config evidence.",
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

    use super::{
        DetectionGate, DetectorKind, PathBasedDetectorConfig, ProbeIssue,
        evaluate_path_based_detector, resolve_status_and_note,
    };
    use crate::interface::contracts::detect::DetectClientsRequest;

    #[test]
    fn missing_override_resolves_to_partial_state() {
        let config = PathBasedDetectorConfig {
            client: ClientKind::Codex,
            display_name: "Test CLI",
            kind: DetectorKind::Cli,
            detection_gate: DetectionGate::CliVersion,
            startup_probe_command: None,
            binary_candidates: &[],
            app_candidates: &[],
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
    fn cli_detection_fixtures_distinguish_binary_and_config_states() {
        let config = PathBasedDetectorConfig {
            client: ClientKind::ClaudeCode,
            display_name: "Claude Code",
            kind: DetectorKind::Cli,
            detection_gate: DetectionGate::CliVersion,
            startup_probe_command: None,
            binary_candidates: &[],
            app_candidates: &[],
            config_override_env_vars: &["AI_MANAGER_CLAUDE_CODE_MCP_CONFIG"],
            config_fallback_paths: &[],
        };

        let fixtures = vec![
            (true, true, DetectionStatus::Detected, "[detected]"),
            (
                true,
                false,
                DetectionStatus::Detected,
                "[binary_detected_config_missing]",
            ),
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
            detection_gate: DetectionGate::AppInstall,
            startup_probe_command: None,
            binary_candidates: &[],
            app_candidates: &[],
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

    #[test]
    fn desktop_detection_requires_app_install_for_detected_state() {
        let config = PathBasedDetectorConfig {
            client: ClientKind::Cursor,
            display_name: "Cursor",
            kind: DetectorKind::Desktop,
            detection_gate: DetectionGate::AppInstall,
            startup_probe_command: None,
            binary_candidates: &[],
            app_candidates: &[],
            config_override_env_vars: &["AI_MANAGER_CURSOR_MCP_CONFIG"],
            config_fallback_paths: &[],
        };

        let fixtures = vec![
            (true, true, DetectionStatus::Detected, "[detected]"),
            (
                true,
                false,
                DetectionStatus::Detected,
                "[app_detected_config_missing]",
            ),
            (false, true, DetectionStatus::Partial, "[app_missing]"),
            (
                false,
                false,
                DetectionStatus::Absent,
                "[app_and_config_missing]",
            ),
        ];

        for (binary_found, config_found, expected_status, reason_code) in fixtures {
            let (status, _, note) =
                resolve_status_and_note(&config, binary_found, config_found, None);
            assert_eq!(status, expected_status);
            assert!(note.contains(reason_code));
        }
    }

    #[cfg(unix)]
    #[test]
    fn startup_probe_command_is_required_for_cli_detected_state() {
        let config = PathBasedDetectorConfig {
            client: ClientKind::ClaudeCode,
            display_name: "Claude Code",
            kind: DetectorKind::Cli,
            detection_gate: DetectionGate::CliVersion,
            startup_probe_command: Some("/definitely/missing/primary-cli"),
            binary_candidates: &["sh"],
            app_candidates: &[],
            config_override_env_vars: &[],
            config_fallback_paths: &[],
        };

        let detection = evaluate_path_based_detector(
            &config,
            &DetectClientsRequest {
                include_versions: true,
            },
        );

        assert!(matches!(detection.status, DetectionStatus::Absent));
        assert!(detection.evidence.binary_path.is_some());
        assert_eq!(detection.evidence.version, None);
    }
}
