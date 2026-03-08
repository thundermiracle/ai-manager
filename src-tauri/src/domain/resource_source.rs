use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ResourceSourceScope {
    #[default]
    User,
    ProjectShared,
    ProjectPrivate,
}

impl ResourceSourceScope {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::User => "user",
            Self::ProjectShared => "project_shared",
            Self::ProjectPrivate => "project_private",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResourceSourceMetadata {
    pub source_id: String,
    pub source_scope: ResourceSourceScope,
    pub source_label: String,
    pub is_effective: bool,
    pub shadowed_by: Option<String>,
}

impl ResourceSourceMetadata {
    pub fn personal(source_id: String, source_label: impl Into<String>) -> Self {
        Self {
            source_id,
            source_scope: ResourceSourceScope::User,
            source_label: source_label.into(),
            is_effective: true,
            shadowed_by: None,
        }
    }
}
