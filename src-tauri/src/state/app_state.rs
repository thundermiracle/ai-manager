use std::sync::{
  RwLock,
  atomic::{AtomicU64, Ordering},
};

use crate::contracts::common::{LifecyclePhase, LifecycleSnapshot};

use super::clock::now_epoch_ms;

pub struct AppState {
  lifecycle: RwLock<LifecycleSnapshot>,
  operation_counter: AtomicU64,
}

impl AppState {
  pub fn new() -> Self {
    Self {
      lifecycle: RwLock::new(LifecycleSnapshot {
        phase: LifecyclePhase::Running,
        initialized_at_epoch_ms: now_epoch_ms(),
        shutdown_requested_at_epoch_ms: None,
      }),
      operation_counter: AtomicU64::new(0),
    }
  }

  pub fn lifecycle_snapshot(&self) -> LifecycleSnapshot {
    self.with_lifecycle_read(|snapshot| snapshot.clone())
  }

  pub fn is_shutting_down(&self) -> bool {
    self.with_lifecycle_read(|snapshot| matches!(snapshot.phase, LifecyclePhase::ShuttingDown))
  }

  pub fn mark_shutdown_requested(&self) {
    self.with_lifecycle_write(|snapshot| {
      if snapshot.shutdown_requested_at_epoch_ms.is_none() {
        snapshot.shutdown_requested_at_epoch_ms = Some(now_epoch_ms());
      }

      snapshot.phase = LifecyclePhase::ShuttingDown;
    });
  }

  pub fn next_operation_id(&self, command_name: &str) -> String {
    let sequence = self.operation_counter.fetch_add(1, Ordering::Relaxed) + 1;
    format!("{}-{}", command_name, sequence)
  }

  fn with_lifecycle_read<T>(&self, accessor: impl FnOnce(&LifecycleSnapshot) -> T) -> T {
    match self.lifecycle.read() {
      Ok(guard) => accessor(&guard),
      Err(poisoned) => accessor(&poisoned.into_inner()),
    }
  }

  fn with_lifecycle_write(&self, mutator: impl FnOnce(&mut LifecycleSnapshot)) {
    match self.lifecycle.write() {
      Ok(mut guard) => mutator(&mut guard),
      Err(poisoned) => {
        let mut guard = poisoned.into_inner();
        mutator(&mut guard);
      }
    }
  }
}

impl Default for AppState {
  fn default() -> Self {
    Self::new()
  }
}

#[cfg(test)]
mod tests {
  use super::AppState;
  use crate::contracts::common::LifecyclePhase;

  #[test]
  fn operation_id_counter_increments_per_command_prefix() {
    let state = AppState::new();

    assert_eq!(state.next_operation_id("detect"), "detect-1");
    assert_eq!(state.next_operation_id("detect"), "detect-2");
    assert_eq!(state.next_operation_id("list"), "list-3");
  }

  #[test]
  fn mark_shutdown_is_idempotent() {
    let state = AppState::new();

    state.mark_shutdown_requested();
    let first = state.lifecycle_snapshot();

    state.mark_shutdown_requested();
    let second = state.lifecycle_snapshot();

    assert!(matches!(first.phase, LifecyclePhase::ShuttingDown));
    assert_eq!(first.shutdown_requested_at_epoch_ms, second.shutdown_requested_at_epoch_ms);
    assert!(state.is_shutting_down());
  }
}
