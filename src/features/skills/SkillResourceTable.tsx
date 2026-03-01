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

interface SkillResourceTableProps {
  resources: ResourceRecord[];
  pendingRemovalId: string | null;
  pendingUpdateId: string | null;
  pendingCopyId: string | null;
  onEdit: (resource: ResourceRecord) => Promise<void>;
  onCopy: (resource: ResourceRecord) => Promise<void>;
  onRemove: (resource: ResourceRecord) => Promise<void>;
  emptyMessage?: string;
}

function formatSourcePath(sourcePath: string | null): string {
  return sourcePath ?? "Auto-resolved";
}

function formatInstallKind(value: string | null): string {
  return value ?? "unknown";
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <rect x="7" y="3" width="10" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
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

interface SkillActionButtonProps {
  icon: ReactNode;
  label: string;
  busyLabel: string;
  busy: boolean;
  disabled: boolean;
  className: string;
  onClick: () => void;
}

function SkillActionButton({
  icon,
  label,
  busyLabel,
  busy,
  disabled,
  className,
  onClick,
}: SkillActionButtonProps) {
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

export function SkillResourceTable({
  resources,
  pendingRemovalId,
  pendingUpdateId,
  pendingCopyId,
  onEdit,
  onCopy,
  onRemove,
  emptyMessage,
}: SkillResourceTableProps) {
  if (resources.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-7 text-center">
        <p className="text-sm leading-relaxed text-slate-600">
          {emptyMessage ?? "No Skill entries registered for the selected client."}
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
            <TableHead>Install Kind</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead>Source</TableHead>
            <TableHead aria-label="actions" className="w-[17rem]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map((resource) => {
            const removing = pendingRemovalId === resource.display_name;
            const updating = pendingUpdateId === resource.display_name;
            const copying = pendingCopyId === resource.id;
            const sourceText = formatSourcePath(resource.source_path);
            return (
              <TableRow key={resource.id} className="hover:bg-slate-50/70">
                <TableCell
                  className="max-w-[12rem] truncate font-medium text-slate-900"
                  title={resource.display_name}
                >
                  {resource.display_name}
                </TableCell>
                <TableCell>
                  {formatInstallKind(resource.install_kind)}
                </TableCell>
                <TableCell>{resource.enabled ? "yes" : "no"}</TableCell>
                <TableCell
                  className="max-w-[18rem] truncate"
                  title={sourceText}
                >
                  {sourceText}
                </TableCell>
                <TableCell className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                  <SkillActionButton
                    icon={<CopyIcon />}
                    label="Copy"
                    busyLabel="Copying..."
                    busy={copying}
                    disabled={copying || updating || removing}
                    className="h-8 w-8 rounded-lg border border-sky-200 bg-sky-50 p-0 text-sky-700 hover:bg-sky-100 hover:text-sky-800"
                    onClick={() => {
                      void onCopy(resource);
                    }}
                  />
                  <SkillActionButton
                    icon={<EditIcon />}
                    label="Edit"
                    busyLabel="Updating..."
                    busy={updating}
                    disabled={updating || removing || copying}
                    className="h-8 w-8 rounded-lg border border-amber-200 bg-amber-50 p-0 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
                    onClick={() => {
                      void onEdit(resource);
                    }}
                  />
                  <SkillActionButton
                    icon={<RemoveIcon />}
                    label="Remove"
                    busyLabel="Removing..."
                    busy={removing}
                    disabled={removing || updating || copying}
                    className="h-8 w-8 rounded-lg border border-rose-200 bg-rose-50 p-0 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
                    onClick={() => {
                      void onRemove(resource);
                    }}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
