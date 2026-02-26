mod client_adapter;
mod client_profile;

pub use client_adapter::{AdapterListResult, AdapterMutationResult, ClientAdapter};
pub use client_profile::{
    CLAUDE_CODE_PROFILE, CODEX_APP_PROFILE, CODEX_CLI_PROFILE, CURSOR_PROFILE, ClientProfile,
};
