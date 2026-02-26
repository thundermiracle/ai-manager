use serde::{Deserialize, Serialize};

use super::common::ClientKind;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct DetectClientsRequest {
    #[serde(default)]
    pub include_versions: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DetectionStatus {
    Absent,
    Partial,
    Detected,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DetectionEvidence {
    pub binary_path: Option<String>,
    pub config_path: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClientDetection {
    pub client: ClientKind,
    pub status: DetectionStatus,
    pub evidence: DetectionEvidence,
    pub note: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DetectClientsResponse {
    pub clients: Vec<ClientDetection>,
}
