use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClientKind {
  ClaudeCode,
  CodexCli,
  Cursor,
  CodexApp,
}

impl ClientKind {
  pub const fn as_str(self) -> &'static str {
    match self {
      Self::ClaudeCode => "claude_code",
      Self::CodexCli => "codex_cli",
      Self::Cursor => "cursor",
      Self::CodexApp => "codex_app",
    }
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceKind {
  Mcp,
  Skill,
}

impl ResourceKind {
  pub const fn as_str(self) -> &'static str {
    match self {
      Self::Mcp => "mcp",
      Self::Skill => "skill",
    }
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LifecyclePhase {
  Running,
  ShuttingDown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LifecycleSnapshot {
  pub phase: LifecyclePhase,
  pub initialized_at_epoch_ms: u128,
  pub shutdown_requested_at_epoch_ms: Option<u128>,
}
