#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct SkillMetadata {
    pub description: Option<String>,
}

pub fn parse_skill_metadata(source: &str) -> SkillMetadata {
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

    SkillMetadata {
        description: first_description.or(first_heading),
    }
}

#[cfg(test)]
mod tests {
    use super::parse_skill_metadata;

    #[test]
    fn metadata_uses_first_non_heading_line_as_description() {
        let metadata = parse_skill_metadata(
            r#"# Python Refactor

Refactor Python code safely.

More details...
"#,
        );

        assert_eq!(
            metadata.description.as_deref(),
            Some("Refactor Python code safely.")
        );
    }

    #[test]
    fn metadata_falls_back_to_heading_when_description_missing() {
        let metadata = parse_skill_metadata("# Python Refactor");
        assert_eq!(metadata.description.as_deref(), Some("Python Refactor"));
    }
}
