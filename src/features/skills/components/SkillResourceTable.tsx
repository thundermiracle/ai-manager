import type { ResourceRecord } from "../../../backend/contracts";

interface SkillResourceTableProps {
  resources: ResourceRecord[];
  pendingRemovalId: string | null;
  onRemove: (resource: ResourceRecord) => Promise<void>;
}

function formatSourcePath(sourcePath: string | null): string {
  return sourcePath ?? "Auto-resolved";
}

function formatInstallKind(value: string | null): string {
  return value ?? "unknown";
}

export function SkillResourceTable({
  resources,
  pendingRemovalId,
  onRemove,
}: SkillResourceTableProps) {
  if (resources.length === 0) {
    return <p className="mcp-empty">No Skill entries registered for the selected client.</p>;
  }

  return (
    <div className="mcp-table-wrapper">
      <table className="mcp-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Install Kind</th>
            <th>Enabled</th>
            <th>Source</th>
            <th aria-label="actions" />
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => {
            const removing = pendingRemovalId === resource.display_name;
            return (
              <tr key={resource.id}>
                <td>{resource.display_name}</td>
                <td>{formatInstallKind(resource.install_kind)}</td>
                <td>{resource.enabled ? "yes" : "no"}</td>
                <td>{formatSourcePath(resource.source_path)}</td>
                <td className="mcp-table-action-cell">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      void onRemove(resource);
                    }}
                    disabled={removing}
                  >
                    {removing ? "Removing..." : "Remove"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
