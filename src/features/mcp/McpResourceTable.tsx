import type { ResourceRecord } from "../../backend/contracts";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

interface McpResourceTableProps {
  resources: ResourceRecord[];
  pendingRemovalId: string | null;
  pendingUpdateId: string | null;
  onEdit: (resource: ResourceRecord) => Promise<void>;
  onRemove: (resource: ResourceRecord) => Promise<void>;
  emptyMessage?: string;
}

function formatSourcePath(sourcePath: string | null): string {
  return sourcePath ?? "Auto-resolved";
}

function formatTransportKind(value: string | null): string {
  return value ?? "unknown";
}

export function McpResourceTable({
  resources,
  pendingRemovalId,
  pendingUpdateId,
  onEdit,
  onRemove,
  emptyMessage,
}: McpResourceTableProps) {
  if (resources.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-7 text-center">
        <p className="text-sm leading-relaxed text-slate-600">
          {emptyMessage ?? "No MCP entries registered for the selected client."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200/90 bg-white">
      <Table className="min-w-[42rem] max-[720px]:min-w-[36rem]">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Transport</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead>Source</TableHead>
            <TableHead aria-label="actions" className="w-40" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map((resource) => {
            const removing = pendingRemovalId === resource.display_name;
            const updating = pendingUpdateId === resource.display_name;
            return (
              <TableRow key={resource.id} className="hover:bg-slate-50/70">
                <TableCell className="font-medium text-slate-900">
                  {resource.display_name}
                </TableCell>
                <TableCell>{formatTransportKind(resource.transport_kind)}</TableCell>
                <TableCell>{resource.enabled ? "yes" : "no"}</TableCell>
                <TableCell>{formatSourcePath(resource.source_path)}</TableCell>
                <TableCell className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      void onEdit(resource);
                    }}
                    disabled={updating || removing}
                  >
                    {updating ? "Updating..." : "Edit"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void onRemove(resource);
                    }}
                    disabled={removing || updating}
                  >
                    {removing ? "Removing..." : "Remove"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
