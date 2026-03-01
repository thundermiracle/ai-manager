mod client_adapter;
mod client_kind;
mod client_profile;
mod mutation_action;
mod resource_kind;

pub use client_adapter::{AdapterListResult, AdapterMutationResult, ClientAdapter};
pub use client_kind::ClientKind;
pub use client_profile::{
    CLAUDE_CODE_PROFILE, CODEX_APP_PROFILE, CODEX_CLI_PROFILE, CURSOR_PROFILE, ClientProfile,
};
pub use mutation_action::MutationAction;
pub use resource_kind::ResourceKind;
