import type { ResourceRecord } from "../../backend/contracts";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

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
    return (
      <p className="text-sm text-slate-600">No Skill entries registered for the selected client.</p>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-auto p-0">
        <Table className="min-w-[35rem] max-[720px]:min-w-0">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Install Kind</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead>Source</TableHead>
              <TableHead aria-label="actions" className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((resource) => {
              const removing = pendingRemovalId === resource.display_name;
              return (
                <TableRow key={resource.id}>
                  <TableCell>{resource.display_name}</TableCell>
                  <TableCell>{formatInstallKind(resource.install_kind)}</TableCell>
                  <TableCell>{resource.enabled ? "yes" : "no"}</TableCell>
                  <TableCell>{formatSourcePath(resource.source_path)}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void onRemove(resource);
                      }}
                      disabled={removing}
                    >
                      {removing ? "Removing..." : "Remove"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
