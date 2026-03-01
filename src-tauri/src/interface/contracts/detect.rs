use serde::{Deserialize, Serialize};

use super::common::ClientKind;
use crate::infra::security::redaction::redact_sensitive_text;

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
    pub confidence: u8,
    pub evidence: DetectionEvidence,
    pub note: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DetectClientsResponse {
    pub clients: Vec<ClientDetection>,
}

impl DetectClientsResponse {
    pub fn redact_sensitive(mut self) -> Self {
        for client in &mut self.clients {
            client.note = redact_sensitive_text(&client.note);
        }

        self
    }
}

#[cfg(test)]
mod tests {
    use super::{ClientDetection, DetectClientsResponse, DetectionEvidence, DetectionStatus};
    use crate::domain::ClientKind;

    #[test]
    fn detect_response_redacts_notes() {
        let response = DetectClientsResponse {
            clients: vec![ClientDetection {
                client: ClientKind::Cursor,
                status: DetectionStatus::Detected,
                confidence: 100,
                evidence: DetectionEvidence {
                    binary_path: None,
                    config_path: None,
                    version: None,
                },
                note: "authorization=Bearer topsecret".to_string(),
            }],
        }
        .redact_sensitive();

        assert_eq!(response.clients[0].note, "authorization=Bearer [REDACTED]");
    }
}
