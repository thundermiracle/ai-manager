use crate::contracts::common::ClientKind;

use super::{ParseOutcome, ParsedClientConfig};

pub trait ClientConfigParser: Send + Sync {
    fn client_kind(&self) -> ClientKind;
    fn parse(&self, source: &str) -> ParseOutcome<ParsedClientConfig>;
}
