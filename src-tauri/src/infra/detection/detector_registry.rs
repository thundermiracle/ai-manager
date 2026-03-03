use super::{
    ClientDetector,
    clients::{ClaudeCodeDetector, CodexDetector, CursorDetector},
};
use crate::interface::contracts::common::ClientKind;

pub struct DetectorRegistry {
    detectors: Vec<Box<dyn ClientDetector>>,
}

impl DetectorRegistry {
    pub fn with_default_detectors() -> Self {
        Self {
            detectors: vec![
                Box::new(ClaudeCodeDetector::new()),
                Box::new(CodexDetector::new()),
                Box::new(CursorDetector::new()),
            ],
        }
    }

    pub fn all(&self) -> impl Iterator<Item = &dyn ClientDetector> {
        self.detectors.iter().map(std::boxed::Box::as_ref)
    }

    pub fn find(&self, client: ClientKind) -> Option<&dyn ClientDetector> {
        self.all().find(|detector| detector.client_kind() == client)
    }
}

#[cfg(test)]
mod tests {
    use crate::interface::contracts::{
        common::ClientKind,
        detect::{DetectClientsRequest, DetectionStatus},
    };

    use super::DetectorRegistry;

    #[test]
    fn registry_contains_all_supported_detectors() {
        let registry = DetectorRegistry::with_default_detectors();

        let clients: Vec<ClientKind> = registry
            .all()
            .map(|detector| detector.client_kind())
            .collect();

        assert_eq!(
            clients,
            vec![
                ClientKind::ClaudeCode,
                ClientKind::Codex,
                ClientKind::Cursor,
            ]
        );
    }

    #[test]
    fn all_detectors_emit_shared_schema_with_confidence_range() {
        let registry = DetectorRegistry::with_default_detectors();

        for detector in registry.all() {
            let detection = detector.detect(&DetectClientsRequest {
                include_versions: true,
            });

            assert!(matches!(
                detection.status,
                DetectionStatus::Detected
                    | DetectionStatus::Partial
                    | DetectionStatus::Absent
                    | DetectionStatus::Error
            ));
            assert!(detection.confidence <= 100);
            assert!(matches!(
                detection.client,
                ClientKind::ClaudeCode | ClientKind::Codex | ClientKind::Cursor
            ));
        }
    }

    #[test]
    fn find_returns_target_detector_without_iterating_callers_over_all_detectors() {
        let registry = DetectorRegistry::with_default_detectors();

        let detector = registry.find(ClientKind::Cursor);

        assert!(detector.is_some());
        assert_eq!(
            detector
                .expect("cursor detector should exist")
                .client_kind(),
            ClientKind::Cursor
        );
    }
}
