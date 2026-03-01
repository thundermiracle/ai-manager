use serde::{Deserialize, Serialize};

use super::ClientKind;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResourceRecord {
    pub id: String,
    pub client: ClientKind,
    pub display_name: String,
    pub enabled: bool,
    pub transport_kind: Option<String>,
    pub transport_command: Option<String>,
    pub transport_args: Option<Vec<String>>,
    pub transport_url: Option<String>,
    pub source_path: Option<String>,
    pub description: Option<String>,
    pub install_kind: Option<String>,
    pub manifest_content: Option<String>,
}
