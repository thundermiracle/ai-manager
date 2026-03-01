use regex::{Captures, Regex};
use std::sync::OnceLock;

const REDACTED_VALUE: &str = "[REDACTED]";
const SENSITIVE_KEYS_PATTERN: &str = concat!(
    "(?:access[_-]?token|api[_-]?key|authorization|bearer|client[_-]?secret|",
    "password|private[_-]?key|secret|token)"
);

pub fn redact_sensitive_text(input: &str) -> String {
    if input.is_empty() {
        return String::new();
    }

    let redacted_assignments = key_value_regex().replace_all(input, |captures: &Captures<'_>| {
        let prefix = captures.get(1).map_or("", |group| group.as_str());
        let value = captures.get(2).map_or("", |group| group.as_str());
        format!("{prefix}{}", redact_value(value))
    });

    let redacted_bearer = bearer_regex()
        .replace_all(&redacted_assignments, |captures: &Captures<'_>| {
            let prefix = captures.get(1).map_or("", |group| group.as_str());
            format!("{prefix}{REDACTED_VALUE}")
        })
        .to_string();

    known_token_regex()
        .replace_all(&redacted_bearer, REDACTED_VALUE)
        .to_string()
}

fn redact_value(value: &str) -> String {
    if value.to_ascii_lowercase().starts_with("bearer ") {
        return format!("Bearer {REDACTED_VALUE}");
    }

    if value.len() >= 2 {
        let first = value.as_bytes()[0];
        let last = value.as_bytes()[value.len() - 1];
        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            let quote = first as char;
            return format!("{quote}{REDACTED_VALUE}{quote}");
        }
    }

    REDACTED_VALUE.to_string()
}

fn key_value_regex() -> &'static Regex {
    static KEY_VALUE_REGEX: OnceLock<Regex> = OnceLock::new();
    KEY_VALUE_REGEX.get_or_init(|| {
        let pattern = format!(
            r#"(?i)((?:['"]?{keys}['"]?)\s*[:=]\s*)((?:bearer\s+[A-Za-z0-9._~+/=-]+)|(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}}\]\)]+))"#,
            keys = SENSITIVE_KEYS_PATTERN
        );
        Regex::new(&pattern).expect("sensitive key-value regex must compile")
    })
}

fn bearer_regex() -> &'static Regex {
    static BEARER_REGEX: OnceLock<Regex> = OnceLock::new();
    BEARER_REGEX.get_or_init(|| {
        Regex::new(r"(?i)(\bbearer\s+)[A-Za-z0-9._~+/=-]+").expect("bearer regex must compile")
    })
}

fn known_token_regex() -> &'static Regex {
    static KNOWN_TOKEN_REGEX: OnceLock<Regex> = OnceLock::new();
    KNOWN_TOKEN_REGEX.get_or_init(|| {
        Regex::new(
            r"(?i)\b(?:sk-[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{8,}|xox[baprs]-[A-Za-z0-9-]{8,}|AIza[0-9A-Za-z_-]{20,})\b",
        )
        .expect("known token regex must compile")
    })
}

#[cfg(test)]
mod tests {
    use super::redact_sensitive_text;

    #[test]
    fn redacts_json_style_key_values() {
        let redacted = redact_sensitive_text(r#"{"api_key":"abc123","name":"demo"}"#);
        assert_eq!(redacted, r#"{"api_key":"[REDACTED]","name":"demo"}"#);
    }

    #[test]
    fn redacts_assignment_style_values() {
        let redacted = redact_sensitive_text("token=abc123 secret:xyz123");
        assert_eq!(redacted, "token=[REDACTED] secret:[REDACTED]");
    }

    #[test]
    fn redacts_bearer_tokens() {
        let redacted = redact_sensitive_text("Authorization: Bearer mytoken123");
        assert_eq!(redacted, "Authorization: Bearer [REDACTED]");
    }

    #[test]
    fn redacts_bearer_tokens_for_key_value_assignments() {
        let redacted = redact_sensitive_text("authorization=Bearer mytoken123");
        assert_eq!(redacted, "authorization=Bearer [REDACTED]");
    }

    #[test]
    fn redacts_known_token_formats_without_key() {
        let redacted = redact_sensitive_text("Failed with value sk-abc1234567890xyz");
        assert_eq!(redacted, "Failed with value [REDACTED]");
    }

    #[test]
    fn leaves_non_sensitive_text_unchanged() {
        let original = "No secrets here";
        let redacted = redact_sensitive_text(original);
        assert_eq!(redacted, original);
    }
}
