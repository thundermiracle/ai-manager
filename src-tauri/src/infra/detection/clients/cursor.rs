use crate::interface::contracts::{
    common::ClientKind,
    detect::{ClientDetection, DetectClientsRequest},
};

use super::super::{
    client_detector::ClientDetector,
    path_based::{
        DetectionGate, DetectorKind, PathBasedDetectorConfig, evaluate_path_based_detector,
    },
};

const CONFIG: PathBasedDetectorConfig = PathBasedDetectorConfig {
    client: ClientKind::Cursor,
    display_name: "Cursor",
    kind: DetectorKind::Desktop,
    detection_gate: DetectionGate::AppInstall,
    startup_probe_command: Some("cursor"),
    binary_candidates: &["cursor", "Cursor"],
    app_candidates: &["/Applications/Cursor.app", "~/Applications/Cursor.app"],
    config_override_env_vars: &["AI_MANAGER_CURSOR_MCP_CONFIG"],
    config_fallback_paths: &[
        "~/.cursor/mcp.json",
        "~/Library/Application Support/Cursor/User/mcp.json",
    ],
};

pub struct CursorDetector;

impl CursorDetector {
    pub fn new() -> Self {
        Self
    }
}

impl ClientDetector for CursorDetector {
    fn client_kind(&self) -> ClientKind {
        CONFIG.client
    }

    fn detect(&self, request: &DetectClientsRequest) -> ClientDetection {
        evaluate_path_based_detector(&CONFIG, request)
    }
}
