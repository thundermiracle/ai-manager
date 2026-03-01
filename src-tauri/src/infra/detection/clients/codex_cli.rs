use crate::interface::contracts::{
    common::ClientKind,
    detect::{ClientDetection, DetectClientsRequest},
};

use super::super::{
    client_detector::ClientDetector,
    path_based::{DetectorKind, PathBasedDetectorConfig, evaluate_path_based_detector},
};

const CONFIG: PathBasedDetectorConfig = PathBasedDetectorConfig {
    client: ClientKind::CodexCli,
    display_name: "Codex CLI",
    kind: DetectorKind::Cli,
    binary_candidates: &["codex", "codex-cli"],
    config_override_env_var: "AI_MANAGER_CODEX_CLI_MCP_CONFIG",
    config_fallback_paths: &["~/.codex/config.toml"],
};

pub struct CodexCliDetector;

impl CodexCliDetector {
    pub fn new() -> Self {
        Self
    }
}

impl ClientDetector for CodexCliDetector {
    fn detect(&self, request: &DetectClientsRequest) -> ClientDetection {
        evaluate_path_based_detector(&CONFIG, request)
    }
}
