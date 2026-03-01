use serde::{Deserialize, Serialize};

pub use crate::domain::{ClientKind, ResourceKind};

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
