use crate::interface::contracts::{
    common::ClientKind,
    detect::{ClientDetection, DetectClientsRequest},
};

use super::super::{
    client_detector::ClientDetector,
    path_based::{DetectorKind, PathBasedDetectorConfig, evaluate_path_based_detector},
};

const CONFIG: PathBasedDetectorConfig = PathBasedDetectorConfig {
    client: ClientKind::ClaudeCode,
    display_name: "Claude Code",
    kind: DetectorKind::Cli,
    binary_candidates: &["claude", "claude-code"],
    config_override_env_vars: &["AI_MANAGER_CLAUDE_CODE_MCP_CONFIG"],
    config_fallback_paths: &["~/.claude/claude_code_config.json"],
};

pub struct ClaudeCodeDetector;

impl ClaudeCodeDetector {
    pub fn new() -> Self {
        Self
    }
}

impl ClientDetector for ClaudeCodeDetector {
    fn detect(&self, request: &DetectClientsRequest) -> ClientDetection {
        evaluate_path_based_detector(&CONFIG, request)
    }
}
