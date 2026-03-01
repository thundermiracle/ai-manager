use crate::interface::contracts::{
    common::ClientKind,
    detect::{ClientDetection, DetectClientsRequest},
};

use super::super::{
    client_detector::ClientDetector,
    path_based::{DetectorKind, PathBasedDetectorConfig, evaluate_path_based_detector},
};

const CONFIG: PathBasedDetectorConfig = PathBasedDetectorConfig {
    client: ClientKind::Codex,
    display_name: "Codex",
    kind: DetectorKind::Cli,
    binary_candidates: &["codex", "codex-cli"],
    config_override_env_vars: &["AI_MANAGER_CODEX_MCP_CONFIG"],
    config_fallback_paths: &["~/.codex/config.toml"],
};

pub struct CodexDetector;

impl CodexDetector {
    pub fn new() -> Self {
        Self
    }
}

impl ClientDetector for CodexDetector {
    fn detect(&self, request: &DetectClientsRequest) -> ClientDetection {
        evaluate_path_based_detector(&CONFIG, request)
    }
}
