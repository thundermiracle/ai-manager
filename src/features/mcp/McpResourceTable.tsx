import type { ReactNode } from "react";

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
import { formatClientLabel } from "../clients/client-labels";

interface McpResourceTableProps {
  resources: ResourceRecord[];
  pendingRemovalId: string | null;
  pendingUpdateId: string | null;
  pendingCopyId: string | null;
  onCopy: (resource: ResourceRecord) => Promise<void>;
  onEdit: (resource: ResourceRecord) => Promise<void>;
  onRemove: (resource: ResourceRecord) => Promise<void>;
  emptyMessage?: string;
}

function formatTransportKind(value: string | null): string {
  return value ?? "unknown";
}

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M3 14.75V17h2.25l8.8-8.8-2.25-2.25-8.8 8.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M11.8 5.95 13.9 3.9a1.6 1.6 0 0 1 2.25 0l.05.05a1.6 1.6 0 0 1 0 2.25l-2.1 2.05"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M4.5 6h11m-9.5 0v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6m-7-2h5l.6 1.3H6.4L7 4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <rect x="7" y="3" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

interface McpActionButtonProps {
  icon: ReactNode;
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled: boolean;
  className: string;
  onClick: () => void;
}

function McpActionButton({
  icon,
  label,
  busyLabel,
  busy,
  disabled,
  className,
  onClick,
}: McpActionButtonProps) {
  const tooltip = busy ? busyLabel : label;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`group relative ${className}`}
      title={tooltip}
      aria-label={tooltip}
      aria-busy={busy}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
      <span className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[0.68rem] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {tooltip}
      </span>
      <span className="sr-only">{tooltip}</span>
    </Button>
  );
}

function StatusBadge({ tone, label }: { tone: "neutral" | "success" | "warning"; label: string }) {
  const className =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ${className}`}
    >
      {label}
    </span>
  );
}

export function McpResourceTable({
  resources,
  pendingRemovalId,
  pendingUpdateId,
  pendingCopyId,
  onCopy,
  onEdit,
  onRemove,
  emptyMessage,
}: McpResourceTableProps) {
  const resourcesById = new Map(resources.map((resource) => [resource.id, resource]));

  if (resources.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-7 text-center">
        <p className="text-sm leading-relaxed text-slate-600">
          {emptyMessage ?? "No MCP entries registered for the current context."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200/90 bg-white">
      <Table className="min-w-[66rem] max-[720px]:min-w-[52rem]">
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>MCP Entry</TableHead>
            <TableHead>Transport</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Source</TableHead>
            <TableHead aria-label="actions" className="w-36" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map((resource) => {
            const removing = pendingRemovalId === resource.id;
            const updating = pendingUpdateId === resource.id;
            const copying = pendingCopyId === resource.id;
            const shadowingSource =
              resource.shadowed_by === null
                ? null
                : (resourcesById.get(resource.shadowed_by) ?? null);

            return (
              <TableRow
                key={resource.id}
                className={
                  resource.is_effective
                    ? "hover:bg-slate-50/70"
                    : "bg-amber-50/35 hover:bg-amber-50/60"
                }
              >
                <TableCell>
                  <div className="grid gap-1">
                    <span className="text-sm font-medium text-slate-900">
                      {formatClientLabel(resource.client)}
                    </span>
                    <span className="text-xs text-slate-500">{resource.client}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="grid gap-1">
                    <span className="font-medium text-slate-900">{resource.display_name}</span>
                    <span className="text-xs text-slate-500">{resource.logical_id}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="grid gap-1">
                    <span className="text-sm text-slate-900">
                      {formatTransportKind(resource.transport_kind)}
                    </span>
                    <span className="truncate text-xs text-slate-500">
                      {resource.transport_kind === "sse"
                        ? (resource.transport_url ?? "No URL")
                        : (resource.transport_command ?? "No command")}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusBadge
                      tone={resource.enabled ? "success" : "neutral"}
                      label={resource.enabled ? "Enabled" : "Disabled"}
                    />
                    <StatusBadge
                      tone={resource.is_effective ? "success" : "warning"}
                      label={resource.is_effective ? "Effective" : "Shadowed"}
                    />
                    {shadowingSource ? (
                      <span className="text-xs text-slate-500">
                        Hidden by {shadowingSource.source_label}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="grid gap-1">
                    <span className="text-sm font-medium text-slate-900">
                      {resource.source_label}
                    </span>
                    <span className="text-xs uppercase tracking-[0.08em] text-slate-500">
                      {resource.source_scope.replace("_", " ")}
                    </span>
                    {resource.source_path ? (
                      <span className="truncate text-xs text-slate-500">
                        {resource.source_path}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <McpActionButton
                      icon={<CopyIcon />}
                      label="Copy to another client"
                      busyLabel="Copying..."
                      busy={copying}
                      disabled={copying || updating || removing}
                      className="h-8 w-8 rounded-lg border border-sky-200 bg-sky-50 p-0 text-sky-700 hover:bg-sky-100 hover:text-sky-800"
                      onClick={() => {
                        void onCopy(resource);
                      }}
                    />
                    <McpActionButton
                      icon={<EditIcon />}
                      label={`Edit in ${resource.source_label}`}
                      busyLabel="Updating..."
                      busy={updating}
                      disabled={updating || removing || copying}
                      className="h-8 w-8 rounded-lg border border-amber-200 bg-amber-50 p-0 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
                      onClick={() => {
                        void onEdit(resource);
                      }}
                    />
                    <McpActionButton
                      icon={<RemoveIcon />}
                      label={`Remove from ${resource.source_label}`}
                      busyLabel="Removing..."
                      busy={removing}
                      disabled={removing || updating || copying}
                      className="h-8 w-8 rounded-lg border border-rose-200 bg-rose-50 p-0 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                      onClick={() => {
                        void onRemove(resource);
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
