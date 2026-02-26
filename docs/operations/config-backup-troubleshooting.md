# Operations Guide: Config Paths, Backup, and Troubleshooting

This guide documents real application behavior for issue `#35`.

## Config Locations and Overrides (macOS-first)

### MCP config paths

- Claude Code:
  - Override: `AI_MANAGER_CLAUDE_CODE_MCP_CONFIG`
  - Fallback: `~/.claude/claude_code_config.json`
- Codex CLI:
  - Override: `AI_MANAGER_CODEX_CLI_MCP_CONFIG`
  - Fallback: `~/.codex/config.toml`
- Cursor:
  - Override: `AI_MANAGER_CURSOR_MCP_CONFIG`
  - Fallback order:
    - `~/.cursor/mcp.json`
    - `~/Library/Application Support/Cursor/User/mcp.json`
- Codex App:
  - Override: `AI_MANAGER_CODEX_APP_MCP_CONFIG`
  - Fallback order:
    - `~/Library/Application Support/Codex/mcp.json`
    - `~/.config/Codex/mcp.json`

### Skills directory paths

- Claude Code:
  - Override: `AI_MANAGER_CLAUDE_CODE_SKILLS_DIR`
  - Fallback: `~/.claude/skills`
- Codex CLI:
  - Override: `AI_MANAGER_CODEX_CLI_SKILLS_DIR`
  - Fallback: `~/.codex/skills`
- Cursor:
  - Override: `AI_MANAGER_CURSOR_SKILLS_DIR`
  - Fallback order:
    - `~/.cursor/skills`
    - `~/Library/Application Support/Cursor/User/skills`
- Codex App:
  - Override: `AI_MANAGER_CODEX_APP_SKILLS_DIR`
  - Fallback order:
    - `~/Library/Application Support/Codex/skills`
    - `~/.config/Codex/skills`

## Backup and Restore Procedure

Before file mutation, the app creates backup artifacts for existing targets.

- Backup directory: sibling directory named `.ai-manager-backups`
- Backup naming: `<filename>.<timestamp_ms>.bak`
- Backup creation condition: target file already exists
- Rollback behavior:
  - If original file existed, backup is copied back
  - If original file did not exist, newly created file is removed

### How to restore

When action feedback includes `Backup: ...` and `Source: ...`, restore with:

```bash
cp "<backup_path>" "<target_path>"
```

If only `Backup: ...` is visible, use the client path mapping above to determine the target path.

## Troubleshooting Playbook

### Detection failures

- `[config_override_missing]`: override env path points to a missing file
  - Check env var value and file existence
- `[config_permission_denied]`: config exists but is unreadable
  - Fix read permissions for the current user
- `[binary_missing]`: CLI binary not found in `PATH`
  - Install client or update `PATH`
- `[binary_and_config_missing]`: neither executable nor config was resolved
  - Verify installation and default config locations

### Parse and list failures

- `Invalid JSON MCP config: ...`
  - Fix syntax in JSON config and retry
- `Invalid TOML MCP config: ...`
  - Fix syntax in TOML config and retry
- Permission or I/O failures while reading config
  - Verify path existence and read permission

### Mutation failures

- `MCP '<id>' already exists.` / `MCP '<id>' does not exist.`
  - Use list flow first, then re-run add/remove
- `Skill '<id>' already exists. Conflicts: ...`
  - Remove conflict target or choose a different id
- `source_path '<...>' does not exist.`
  - Correct the path and retry
- Internal mutation failure with `rollback_succeeded=true`
  - Mutation was reverted; inspect source config and backup, then retry
