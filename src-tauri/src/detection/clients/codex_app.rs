use crate::contracts::{
    common::ClientKind,
    detect::{ClientDetection, DetectClientsRequest},
};

use super::super::{
    client_detector::ClientDetector,
    path_based::{DetectorKind, PathBasedDetectorConfig, evaluate_path_based_detector},
};

const CONFIG: PathBasedDetectorConfig = PathBasedDetectorConfig {
    client: ClientKind::CodexApp,
    display_name: "Codex App",
    kind: DetectorKind::Desktop,
    binary_candidates: &["codex-app", "Codex"],
    config_override_env_var: "AI_MANAGER_CODEX_APP_MCP_CONFIG",
    config_fallback_paths: &[
        "~/Library/Application Support/Codex/mcp.json",
        "~/.config/Codex/mcp.json",
    ],
};

pub struct CodexAppDetector;

impl CodexAppDetector {
    pub fn new() -> Self {
        Self
    }
}

impl ClientDetector for CodexAppDetector {
    fn detect(&self, request: &DetectClientsRequest) -> ClientDetection {
        evaluate_path_based_detector(&CONFIG, request)
    }
}
