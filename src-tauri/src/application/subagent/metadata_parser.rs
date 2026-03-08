#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct SubagentMetadata {
    pub name: Option<String>,
    pub description: Option<String>,
}

pub fn parse_subagent_metadata(source: &str) -> SubagentMetadata {
    let (frontmatter, body) = split_frontmatter(source);
    let (body_name, body_description) = scan_body_metadata(&body);

    SubagentMetadata {
        name: frontmatter
            .as_ref()
            .and_then(|data| parse_frontmatter_scalar(data, "name"))
            .or(body_name.clone()),
        description: frontmatter
            .as_ref()
            .and_then(|data| parse_frontmatter_scalar(data, "description"))
            .or(body_description)
            .or(body_name),
    }
}

fn split_frontmatter(source: &str) -> (Option<String>, String) {
    let mut lines = source.lines();
    let Some(first_line) = lines.next() else {
        return (None, source.to_string());
    };

    if first_line.trim() != "---" {
        return (None, source.to_string());
    }

    let mut frontmatter_lines: Vec<&str> = Vec::new();
    let mut body_lines: Vec<&str> = Vec::new();
    let mut found_closing_delimiter = false;

    for line in lines {
        if !found_closing_delimiter && line.trim() == "---" {
            found_closing_delimiter = true;
            continue;
        }

        if found_closing_delimiter {
            body_lines.push(line);
        } else {
            frontmatter_lines.push(line);
        }
    }

    if !found_closing_delimiter {
        return (None, source.to_string());
    }

    (Some(frontmatter_lines.join("\n")), body_lines.join("\n"))
}

fn parse_frontmatter_scalar(frontmatter: &str, key: &str) -> Option<String> {
    let prefix = format!("{key}:");

    frontmatter.lines().find_map(|line| {
        let trimmed = line.trim();
        trimmed
            .strip_prefix(&prefix)
            .map(str::trim)
            .and_then(|value| {
                let normalized = value.trim_matches('"').trim_matches('\'').trim();
                (!normalized.is_empty()).then(|| normalized.to_string())
            })
    })
}

fn scan_body_metadata(source: &str) -> (Option<String>, Option<String>) {
    let mut first_heading: Option<String> = None;
    let mut first_description: Option<String> = None;

    for line in source.lines() {
        let trimmed = line.trim();

        if trimmed.is_empty() {
            continue;
        }

        if let Some(heading) = trimmed.strip_prefix('#') {
            if first_heading.is_none() {
                let normalized = heading.trim();
                if !normalized.is_empty() {
                    first_heading = Some(normalized.to_string());
                }
            }
            continue;
        }

        first_description = Some(trimmed.to_string());
        break;
    }

    (first_heading, first_description)
}

#[cfg(test)]
mod tests {
    use super::parse_subagent_metadata;

    #[test]
    fn metadata_prefers_frontmatter_fields() {
        let metadata = parse_subagent_metadata(
            r#"---
name: reviewer
description: Reviews diffs before merge.
tools: bash
---
# Ignored Title

Ignored description.
"#,
        );

        assert_eq!(metadata.name.as_deref(), Some("reviewer"));
        assert_eq!(
            metadata.description.as_deref(),
            Some("Reviews diffs before merge.")
        );
    }

    #[test]
    fn metadata_falls_back_to_body_heading_and_description() {
        let metadata = parse_subagent_metadata(
            r#"# Release Manager

Coordinates release steps.
"#,
        );

        assert_eq!(metadata.name.as_deref(), Some("Release Manager"));
        assert_eq!(
            metadata.description.as_deref(),
            Some("Coordinates release steps.")
        );
    }
}
