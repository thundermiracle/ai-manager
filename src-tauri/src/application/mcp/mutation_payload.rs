use crate::interface::contracts::{command::CommandError, mutate::MutationAction};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum McpTransportPayload {
    Stdio { command: String, args: Vec<String> },
    Sse { url: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct McpMutationPayload {
    pub source_path: Option<String>,
    pub enabled: Option<bool>,
    pub transport: Option<McpTransportPayload>,
}

pub fn parse_mcp_mutation_payload(
    action: MutationAction,
    payload: Option<&serde_json::Value>,
) -> Result<McpMutationPayload, CommandError> {
    let Some(payload) = payload else {
        return if matches!(action, MutationAction::Remove) {
            Ok(McpMutationPayload::default())
        } else {
            Err(CommandError::validation(
                "payload is required for MCP add/update mutation.",
            ))
        };
    };

    let source_path = payload
        .get("source_path")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let enabled = payload.get("enabled").and_then(serde_json::Value::as_bool);

    let transport = if let Some(transport_value) = payload.get("transport") {
        Some(parse_transport_payload(transport_value)?)
    } else {
        None
    };

    if matches!(action, MutationAction::Add | MutationAction::Update) && transport.is_none() {
        return Err(CommandError::validation(
            "payload.transport is required for MCP add/update mutation.",
        ));
    }

    Ok(McpMutationPayload {
        source_path,
        enabled,
        transport,
    })
}

fn parse_transport_payload(
    payload: &serde_json::Value,
) -> Result<McpTransportPayload, CommandError> {
    let Some(payload) = payload.as_object() else {
        return Err(CommandError::validation(
            "payload.transport must be an object.",
        ));
    };

    let command = payload
        .get("command")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let url = payload
        .get("url")
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());

    match (command, url) {
        (Some(command), None) => {
            let args = payload
                .get("args")
                .and_then(serde_json::Value::as_array)
                .map(|args| {
                    args.iter()
                        .filter_map(serde_json::Value::as_str)
                        .map(str::to_string)
                        .collect()
                })
                .unwrap_or_default();
            Ok(McpTransportPayload::Stdio {
                command: command.to_string(),
                args,
            })
        }
        (None, Some(url)) => {
            if !url.starts_with("http://") && !url.starts_with("https://") {
                return Err(CommandError::validation(
                    "payload.transport.url must start with http:// or https://.",
                ));
            }
            Ok(McpTransportPayload::Sse {
                url: url.to_string(),
            })
        }
        (Some(_), Some(_)) => Err(CommandError::validation(
            "payload.transport must define exactly one transport: either command or url.",
        )),
        (None, None) => Err(CommandError::validation(
            "payload.transport must include command or url.",
        )),
    }
}

#[cfg(test)]
mod tests {
    use crate::domain::MutationAction;
    use serde_json::json;

    use super::{McpTransportPayload, parse_mcp_mutation_payload};

    #[test]
    fn add_payload_requires_transport() {
        let error = parse_mcp_mutation_payload(MutationAction::Add, Some(&json!({})))
            .expect_err("transport should be required");
        assert!(error.message.contains("payload.transport"));
    }

    #[test]
    fn stdio_transport_payload_is_parsed() {
        let payload = parse_mcp_mutation_payload(
            MutationAction::Add,
            Some(&json!({
                "transport": {
                    "command": "npx",
                    "args": ["-y", "server"]
                }
            })),
        )
        .expect("valid stdio payload should parse");

        assert!(matches!(
            payload.transport,
            Some(McpTransportPayload::Stdio { command, args })
            if command == "npx" && args.len() == 2
        ));
    }

    #[test]
    fn remove_payload_can_be_empty() {
        let payload = parse_mcp_mutation_payload(MutationAction::Remove, None)
            .expect("remove payload should be optional");
        assert!(payload.transport.is_none());
    }

    #[test]
    fn update_payload_requires_transport() {
        let error = parse_mcp_mutation_payload(MutationAction::Update, Some(&json!({})))
            .expect_err("transport should be required for update");
        assert!(error.message.contains("payload.transport"));
    }
}
