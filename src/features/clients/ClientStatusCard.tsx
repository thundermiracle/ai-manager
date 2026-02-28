import type { ClientDetection } from "../../backend/contracts";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { formatClientLabel } from "./client-labels";
import { DetectionStatusBadge } from "./DetectionStatusBadge";

interface ClientStatusCardProps {
  detection: ClientDetection;
  selected: boolean;
  onSelect: (client: ClientDetection["client"]) => void;
}

function formatEvidence(value: string | null): string {
  return value ?? "Not available";
}

export function ClientStatusCard({ detection, selected, onSelect }: ClientStatusCardProps) {
  return (
    <Card
      className={
        selected
          ? "border-sky-500/70 shadow-[0_14px_24px_rgba(17,89,147,0.18)]"
          : "border-slate-200"
      }
    >
      <CardHeader className="flex-row items-start justify-between gap-3 p-4">
        <div>
          <p className="mb-0.5 text-[0.72rem] uppercase tracking-[0.08em] text-slate-500">
            {detection.client}
          </p>
          <h3 className="text-[1.06rem] leading-tight">{formatClientLabel(detection.client)}</h3>
        </div>
        <DetectionStatusBadge status={detection.status} />
      </CardHeader>

      <CardContent className="grid gap-3 p-4 pt-0">
        <details className="rounded-lg border border-slate-200 bg-sky-50/40 px-3 py-2 open:bg-sky-50">
          <summary className="cursor-pointer list-none text-sm font-semibold text-sky-900 marker:hidden">
            Show tool details
          </summary>
          <dl className="mt-2 grid gap-2">
            <div className="grid gap-0.5">
              <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Confidence</dt>
              <dd className="text-sm leading-snug text-slate-800">{detection.confidence}%</dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Binary</dt>
              <dd className="break-words text-sm leading-snug text-slate-800">
                {formatEvidence(detection.evidence.binary_path)}
              </dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Config</dt>
              <dd className="break-words text-sm leading-snug text-slate-800">
                {formatEvidence(detection.evidence.config_path)}
              </dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Version</dt>
              <dd className="break-words text-sm leading-snug text-slate-800">
                {formatEvidence(detection.evidence.version)}
              </dd>
            </div>
          </dl>

          <p className="mt-2 text-sm leading-relaxed text-slate-600">{detection.note}</p>
        </details>

        <Button
          variant={selected ? "secondary" : "outline"}
          className={
            selected ? "border-sky-300 bg-sky-100 text-sky-900 hover:bg-sky-200" : undefined
          }
          type="button"
          onClick={() => onSelect(detection.client)}
        >
          {selected ? "Selected" : "Select Client"}
        </Button>
      </CardContent>
    </Card>
  );
}
