use crate::{
    interface::contracts::detect::{DetectClientsRequest, DetectClientsResponse},
    infra::DetectorRegistry,
};

pub struct DetectionService<'a> {
    detector_registry: &'a DetectorRegistry,
}

impl<'a> DetectionService<'a> {
    pub fn new(detector_registry: &'a DetectorRegistry) -> Self {
        Self { detector_registry }
    }

    pub fn detect_clients(&self, request: &DetectClientsRequest) -> DetectClientsResponse {
        let clients = self
            .detector_registry
            .all()
            .map(|detector| detector.detect(request))
            .collect();

        DetectClientsResponse { clients }
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        interface::contracts::{common::ClientKind, detect::DetectClientsRequest},
        infra::DetectorRegistry,
    };

    use super::DetectionService;

    #[test]
    fn detect_clients_collects_results_from_all_detectors() {
        let detector_registry = DetectorRegistry::with_default_detectors();
        let service = DetectionService::new(&detector_registry);

        let response = service.detect_clients(&DetectClientsRequest {
            include_versions: false,
        });

        assert_eq!(response.clients.len(), detector_registry.all().count());
        assert_eq!(
            response
                .clients
                .iter()
                .map(|detection| detection.client)
                .collect::<Vec<_>>(),
            vec![
                ClientKind::ClaudeCode,
                ClientKind::CodexCli,
                ClientKind::Cursor,
                ClientKind::CodexApp,
            ]
        );
    }
}
