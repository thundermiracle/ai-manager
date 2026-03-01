use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::Deserialize;

use crate::domain::ClientKind;

use super::{ParseOutcome, ParserRegistry};

#[derive(Debug, Deserialize)]
struct FixtureCase {
    name: String,
    client: String,
    fixture: String,
    expected: String,
    min_servers: usize,
    warning_codes: Vec<String>,
    error_codes: Vec<String>,
}

#[test]
fn parser_registry_matches_fixture_expectations() {
    let fixtures_root = fixtures_root();
    let fixture_cases = load_fixture_cases(&fixtures_root);
    let registry = ParserRegistry::new();

    for case in fixture_cases {
        let client = parse_client_kind(&case.client);
        let source_path = fixtures_root.join(&case.fixture);
        let source = fs::read_to_string(&source_path).unwrap_or_else(|error| {
            panic!(
                "failed to read fixture '{}': {error}",
                source_path.display()
            )
        });

        let expected_warning_codes = sorted_codes(case.warning_codes.clone());
        let expected_error_codes = sorted_codes(case.error_codes.clone());

        match registry.parse_client_config(client, &source) {
            ParseOutcome::Success { data, warnings } => {
                assert_eq!(
                    case.expected, "success",
                    "fixture '{}' expected a failure but parser returned success",
                    case.name
                );
                assert_eq!(data.client, client, "fixture '{}'", case.name);
                assert_eq!(
                    data.format,
                    expected_format(client),
                    "fixture '{}'",
                    case.name
                );
                assert!(
                    data.mcp_servers.len() >= case.min_servers,
                    "fixture '{}' expected at least {} servers, got {}",
                    case.name,
                    case.min_servers,
                    data.mcp_servers.len()
                );

                let actual_warning_codes =
                    sorted_codes(warnings.into_iter().map(|warning| warning.code.to_string()));
                assert_eq!(
                    actual_warning_codes, expected_warning_codes,
                    "fixture '{}' warning code mismatch",
                    case.name
                );
                assert!(
                    expected_error_codes.is_empty(),
                    "fixture '{}' expected error codes {:?} but parser returned success",
                    case.name,
                    expected_error_codes
                );
            }
            ParseOutcome::Failure { warnings, errors } => {
                let warning_messages: Vec<String> = warnings
                    .iter()
                    .map(|warning| format!("{}: {}", warning.code, warning.message))
                    .collect();
                let error_messages: Vec<String> = errors
                    .iter()
                    .map(|error| format!("{}: {}", error.code, error.message))
                    .collect();
                let actual_warning_codes =
                    sorted_codes(warnings.into_iter().map(|warning| warning.code.to_string()));
                let actual_error_codes =
                    sorted_codes(errors.into_iter().map(|error| error.code.to_string()));
                assert_eq!(
                    case.expected, "failure",
                    "fixture '{}' expected success but parser returned failure (warnings: {:?}, errors: {:?})",
                    case.name, warning_messages, error_messages
                );

                assert_eq!(
                    actual_warning_codes, expected_warning_codes,
                    "fixture '{}' warning code mismatch",
                    case.name
                );
                assert_eq!(
                    actual_error_codes, expected_error_codes,
                    "fixture '{}' error code mismatch",
                    case.name
                );
            }
        }
    }
}

fn fixtures_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("fixtures/parsers")
}

fn load_fixture_cases(fixtures_root: &Path) -> Vec<FixtureCase> {
    let index_path = fixtures_root.join("index.json");
    let index_payload = fs::read_to_string(&index_path).unwrap_or_else(|error| {
        panic!(
            "failed to read fixture index '{}': {error}",
            index_path.display()
        )
    });

    serde_json::from_str::<Vec<FixtureCase>>(&index_payload).unwrap_or_else(|error| {
        panic!(
            "failed to parse fixture index '{}': {error}",
            index_path.display()
        )
    })
}

fn parse_client_kind(value: &str) -> ClientKind {
    match value {
        "claude_code" => ClientKind::ClaudeCode,
        "codex" => ClientKind::Codex,
        "cursor" => ClientKind::Cursor,
        other => panic!("unsupported client kind in fixture index: {other}"),
    }
}

fn expected_format(client: ClientKind) -> &'static str {
    match client {
        ClientKind::Codex => "toml",
        ClientKind::ClaudeCode | ClientKind::Cursor => "json",
    }
}

fn sorted_codes<I>(codes: I) -> Vec<String>
where
    I: IntoIterator<Item = String>,
{
    let mut normalized: Vec<String> = codes.into_iter().collect();
    normalized.sort_unstable();
    normalized
}
