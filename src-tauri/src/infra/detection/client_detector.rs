use crate::interface::contracts::common::ClientKind;
use crate::interface::contracts::detect::{ClientDetection, DetectClientsRequest};

pub trait ClientDetector: Send + Sync {
    fn client_kind(&self) -> ClientKind;
    fn detect(&self, request: &DetectClientsRequest) -> ClientDetection;
}
