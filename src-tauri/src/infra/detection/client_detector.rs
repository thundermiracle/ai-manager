use crate::interface::contracts::detect::{ClientDetection, DetectClientsRequest};

pub trait ClientDetector: Send + Sync {
    fn detect(&self, request: &DetectClientsRequest) -> ClientDetection;
}
