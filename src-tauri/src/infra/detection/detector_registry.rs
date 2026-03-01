use super::{
    ClientDetector,
    clients::{ClaudeCodeDetector, CodexAppDetector, CodexCliDetector, CursorDetector},
};

pub struct DetectorRegistry {
    detectors: Vec<Box<dyn ClientDetector>>,
}

impl DetectorRegistry {
    pub fn with_default_detectors() -> Self {
        Self {
            detectors: vec![
                Box::new(ClaudeCodeDetector::new()),
                Box::new(CodexCliDetector::new()),
                Box::new(CursorDetector::new()),
                Box::new(CodexAppDetector::new()),
            ],
        }
    }

    pub fn all(&self) -> impl Iterator<Item = &dyn ClientDetector> {
        self.detectors.iter().map(std::boxed::Box::as_ref)
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
            .map(|detector| {
                detector
                    .detect(&DetectClientsRequest {
                        include_versions: false,
                    })
                    .client
            })
            .collect();

        assert_eq!(
            clients,
            vec![
                ClientKind::ClaudeCode,
                ClientKind::CodexCli,
                ClientKind::Cursor,
                ClientKind::CodexApp,
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
                ClientKind::ClaudeCode
                    | ClientKind::CodexCli
                    | ClientKind::Cursor
                    | ClientKind::CodexApp
            ));
        }
    }
}
