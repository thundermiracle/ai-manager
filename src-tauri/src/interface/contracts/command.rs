use serde::{Deserialize, Serialize};

use super::common::LifecycleSnapshot;
use crate::infra::security::redaction::redact_sensitive_text;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CommandErrorCode {
    ValidationError,
    NotImplemented,
    ShuttingDown,
    InternalError,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CommandError {
    pub code: CommandErrorCode,
    pub message: String,
    pub recoverable: bool,
}

impl CommandError {
    pub fn validation(message: impl Into<String>) -> Self {
        let message = message.into();
        Self {
            code: CommandErrorCode::ValidationError,
            message: redact_sensitive_text(&message),
            recoverable: true,
        }
    }

    pub fn not_implemented(message: impl Into<String>) -> Self {
        let message = message.into();
        Self {
            code: CommandErrorCode::NotImplemented,
            message: redact_sensitive_text(&message),
            recoverable: true,
        }
    }

    pub fn shutting_down() -> Self {
        Self {
            code: CommandErrorCode::ShuttingDown,
            message: "Application is shutting down. Retry after restart.".to_string(),
            recoverable: true,
        }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        let message = message.into();
        Self {
            code: CommandErrorCode::InternalError,
            message: redact_sensitive_text(&message),
            recoverable: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CommandMeta {
    pub operation_id: String,
    pub lifecycle: LifecycleSnapshot,
}

impl CommandMeta {
    pub fn new(operation_id: String, lifecycle: LifecycleSnapshot) -> Self {
        Self {
            operation_id,
            lifecycle,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CommandEnvelope<T> {
    pub ok: bool,
    pub data: Option<T>,
    pub error: Option<CommandError>,
    pub meta: CommandMeta,
}

impl<T> CommandEnvelope<T> {
    pub fn success(data: T, meta: CommandMeta) -> Self {
        Self {
            ok: true,
            data: Some(data),
            error: None,
            meta,
        }
    }

    pub fn failure(error: CommandError, meta: CommandMeta) -> Self {
        Self {
            ok: false,
            data: None,
            error: Some(error),
            meta,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{CommandEnvelope, CommandError, CommandErrorCode, CommandMeta};
    use crate::interface::contracts::common::{LifecyclePhase, LifecycleSnapshot};

    fn meta(operation_id: &str) -> CommandMeta {
        CommandMeta::new(
            operation_id.to_string(),
            LifecycleSnapshot {
                phase: LifecyclePhase::Running,
                initialized_at_epoch_ms: 1,
                shutdown_requested_at_epoch_ms: None,
            },
        )
    }

    #[test]
    fn envelope_success_contains_data_and_no_error() {
        let envelope = CommandEnvelope::success("ok".to_string(), meta("detect-1"));

        assert!(envelope.ok);
        assert_eq!(envelope.data.as_deref(), Some("ok"));
        assert!(envelope.error.is_none());
    }

    #[test]
    fn envelope_failure_contains_error_and_no_data() {
        let error = CommandError::validation("invalid payload");
        let envelope: CommandEnvelope<String> = CommandEnvelope::failure(error, meta("mutate-1"));

        assert!(!envelope.ok);
        assert!(envelope.data.is_none());

        let Some(err) = envelope.error else {
            panic!("expected error");
        };

        assert_eq!(err.code, CommandErrorCode::ValidationError);
        assert_eq!(err.message, "invalid payload");
        assert!(err.recoverable);
    }

    #[test]
    fn internal_error_is_non_recoverable() {
        let error = CommandError::internal("registry misconfigured");

        assert_eq!(error.code, CommandErrorCode::InternalError);
        assert_eq!(error.message, "registry misconfigured");
        assert!(!error.recoverable);
    }

    #[test]
    fn command_error_masks_sensitive_values() {
        let error = CommandError::validation("token=abc123");
        assert_eq!(error.message, "token=[REDACTED]");
    }
}
