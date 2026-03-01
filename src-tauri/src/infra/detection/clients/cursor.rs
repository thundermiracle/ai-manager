use crate::interface::contracts::{
    common::ClientKind,
    detect::{ClientDetection, DetectClientsRequest},
};

use super::super::{
    client_detector::ClientDetector,
    path_based::{DetectorKind, PathBasedDetectorConfig, evaluate_path_based_detector},
};

const CONFIG: PathBasedDetectorConfig = PathBasedDetectorConfig {
    client: ClientKind::Cursor,
    display_name: "Cursor",
    kind: DetectorKind::Desktop,
    binary_candidates: &["cursor", "Cursor"],
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
    fn detect(&self, request: &DetectClientsRequest) -> ClientDetection {
        evaluate_path_based_detector(&CONFIG, request)
    }
}
