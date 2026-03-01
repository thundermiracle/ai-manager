use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

use serde::Deserialize;
use serde_json::json;

use super::{
    mcp::mutation_service::McpMutationService, skill::mutation_service::SkillMutationService,
};
use crate::{
    contracts::{common::ClientKind, mutate::MutationAction},
    detection::DetectorRegistry,
    infra::parsers::{ParseOutcome, ParserRegistry},
};

#[derive(Debug, Deserialize)]
struct ParserFixtureCase {
    client: String,
    fixture: String,
    expected: String,
}

#[test]
fn parser_fixtures_cover_supported_clients_and_expected_outcomes() {
    let fixtures_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("fixtures/parsers");
    let index_payload =
        fs::read_to_string(fixtures_root.join("index.json")).expect("fixture index should exist");
    let cases: Vec<ParserFixtureCase> =
        serde_json::from_str(&index_payload).expect("fixture index should be valid JSON");
    let parser_registry = ParserRegistry::new();

    let expected_clients: HashSet<String> = HashSet::from_iter(
        ["claude_code", "codex_cli", "cursor", "codex_app"]
            .into_iter()
            .map(str::to_string),
    );
    let actual_clients: HashSet<String> = cases.iter().map(|case| case.client.clone()).collect();
    assert_eq!(
        actual_clients, expected_clients,
        "fixture clients drifted from supported client matrix"
    );

    assert!(
        cases.iter().any(|case| case.expected == "success"),
        "fixture index must include success cases"
    );
    assert!(
        cases.iter().any(|case| case.expected == "failure"),
        "fixture index must include failure cases"
    );

    for case in &cases {
        let client = parse_client_kind(&case.client);
        let payload = fs::read_to_string(fixtures_root.join(&case.fixture))
            .unwrap_or_else(|error| panic!("failed to read fixture '{}': {error}", case.fixture));

        let outcome = parser_registry.parse_client_config(client, &payload);
        match (case.expected.as_str(), outcome) {
            ("success", ParseOutcome::Success { data, .. }) => {
                assert_eq!(
                    data.client, client,
                    "fixture '{}' client mismatch",
                    case.fixture
                );
            }
            ("failure", ParseOutcome::Failure { errors, .. }) => {
                assert!(
                    !errors.is_empty(),
                    "fixture '{}' expected failure without parser errors",
                    case.fixture
                );
                assert!(
                    errors.iter().all(|error| !error.message.trim().is_empty()),
                    "fixture '{}' failure contained empty error message",
                    case.fixture
                );
            }
            ("success", ParseOutcome::Failure { .. }) => {
                panic!(
                    "fixture '{}' regressed from success to failure",
                    case.fixture
                );
            }
            ("failure", ParseOutcome::Success { .. }) => {
                panic!(
                    "fixture '{}' regressed from failure to success",
                    case.fixture
                );
            }
            (other, _) => panic!(
                "fixture '{}' has unsupported expected value: {other}",
                case.fixture
            ),
        }
    }
}

#[test]
fn mcp_mutation_round_trip_covers_success_and_failure_paths() {
    let root = test_root("mcp-round-trip");
    let _ = fs::create_dir_all(&root);

    let config_path = root.join("mcp.json");
    fs::write(&config_path, r#"{"mcpServers": {}}"#).expect("seed config should be writable");

    let detector_registry = DetectorRegistry::with_default_detectors();
    let service = McpMutationService::new(&detector_registry);

    let add_result = service
        .mutate(
            ClientKind::Cursor,
            MutationAction::Add,
            "filesystem",
            Some(&json!({
                "source_path": config_path.display().to_string(),
                "transport": {
                    "command": "npx",
                    "args": ["-y", "@modelcontextprotocol/server-filesystem"]
                },
                "enabled": true
            })),
        )
        .expect("MCP add should succeed");

    let after_add =
        fs::read_to_string(&config_path).expect("config should be readable after MCP add");
    assert!(after_add.contains("filesystem"));
    assert!(add_result.message.contains("Added MCP"));

    let update_result = service
        .mutate(
            ClientKind::Cursor,
            MutationAction::Update,
            "filesystem",
            Some(&json!({
                "source_path": config_path.display().to_string(),
                "transport": {
                    "url": "https://mcp.example.com/sse"
                },
                "enabled": false
            })),
        )
        .expect("MCP update should succeed");

    let after_update =
        fs::read_to_string(&config_path).expect("config should be readable after MCP update");
    assert!(after_update.contains("https://mcp.example.com/sse"));
    assert!(update_result.message.contains("Updated MCP"));

    let remove_result = service
        .mutate(
            ClientKind::Cursor,
            MutationAction::Remove,
            "filesystem",
            Some(&json!({ "source_path": config_path.display().to_string() })),
        )
        .expect("MCP remove should succeed");

    let after_remove =
        fs::read_to_string(&config_path).expect("config should be readable after MCP remove");
    assert!(!after_remove.contains("filesystem"));
    assert!(remove_result.message.contains("Removed MCP"));

    let error = service
        .mutate(
            ClientKind::Cursor,
            MutationAction::Remove,
            "filesystem",
            Some(&json!({ "source_path": config_path.display().to_string() })),
        )
        .expect_err("removing a missing MCP should be actionable validation failure");

    let _ = fs::remove_dir_all(&root);

    assert!(
        error.message.contains("does not exist"),
        "missing MCP remove should explain why it failed"
    );
}

#[test]
fn skill_mutation_round_trip_covers_success_and_failure_paths() {
    let root = test_root("skill-round-trip");
    let _ = fs::create_dir_all(&root);

    let service = SkillMutationService::new();
    let add_result = service
        .mutate(
            ClientKind::Cursor,
            MutationAction::Add,
            "python-refactor",
            Some(&json!({
                "skills_dir": root.display().to_string(),
                "manifest": "# Python Refactor\n\nRefactor Python safely.\n"
            })),
        )
        .expect("skill add should succeed");

    let manifest_path = Path::new(&add_result.source_path).to_path_buf();
    assert!(
        manifest_path.exists(),
        "installed skill manifest should exist after add"
    );

    let update_result = service
        .mutate(
            ClientKind::Cursor,
            MutationAction::Update,
            "python-refactor",
            Some(&json!({
                "skills_dir": root.display().to_string(),
                "manifest": "# Python Refactor\n\nRefactor Python safely (updated).\n"
            })),
        )
        .expect("skill update should succeed");
    assert!(update_result.message.contains("Updated skill"));

    let after_update = fs::read_to_string(&manifest_path).expect("updated manifest should exist");
    assert!(after_update.contains("(updated)"));

    let remove_result = service
        .mutate(
            ClientKind::Cursor,
            MutationAction::Remove,
            "python-refactor",
            Some(&json!({
                "skills_dir": root.display().to_string()
            })),
        )
        .expect("skill remove should succeed");

    assert!(
        remove_result.message.contains("Removed skill"),
        "successful skill remove should be explicit in response"
    );
    assert!(
        !manifest_path.exists(),
        "skill manifest should be removed after delete"
    );

    let error = service
        .mutate(
            ClientKind::Cursor,
            MutationAction::Remove,
            "python-refactor",
            Some(&json!({
                "skills_dir": root.display().to_string()
            })),
        )
        .expect_err("removing a missing skill should fail");

    let _ = fs::remove_dir_all(&root);

    assert!(
        error.message.contains("does not exist"),
        "missing skill remove should explain why it failed"
    );
}

fn parse_client_kind(value: &str) -> ClientKind {
    match value {
        "claude_code" => ClientKind::ClaudeCode,
        "codex_cli" => ClientKind::CodexCli,
        "cursor" => ClientKind::Cursor,
        "codex_app" => ClientKind::CodexApp,
        other => panic!("unsupported client kind in fixture index: {other}"),
    }
}

fn test_root(suffix: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "ai-manager-critical-paths-{}-{}",
        std::process::id(),
        suffix
    ))
}
