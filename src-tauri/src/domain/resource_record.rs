use serde::{Deserialize, Serialize};

use super::{ClientKind, ResourceSourceMetadata, ResourceSourceScope};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResourceRecord {
    pub id: String,
    pub logical_id: String,
    pub client: ClientKind,
    pub display_name: String,
    pub enabled: bool,
    pub transport_kind: Option<String>,
    pub transport_command: Option<String>,
    pub transport_args: Option<Vec<String>>,
    pub transport_url: Option<String>,
    pub source_path: Option<String>,
    pub source_id: String,
    pub source_scope: ResourceSourceScope,
    pub source_label: String,
    pub is_effective: bool,
    pub shadowed_by: Option<String>,
    pub description: Option<String>,
    pub install_kind: Option<String>,
    pub manifest_content: Option<String>,
}

impl ResourceRecord {
    pub fn with_source_metadata(mut self, source: ResourceSourceMetadata) -> Self {
        self.source_id = source.source_id;
        self.source_scope = source.source_scope;
        self.source_label = source.source_label;
        self.is_effective = source.is_effective;
        self.shadowed_by = source.shadowed_by;
        self
    }
}
