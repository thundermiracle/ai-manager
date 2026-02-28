import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import type { ClientDetection } from "../../backend/contracts";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { getClientInstallGuideUrl } from "./client-install-guides";
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

function DocsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3.5h6.2l3.8 3.8V20a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V5A1.5 1.5 0 0 1 8 3.5Z" />
      <path d="M14.2 3.5V8h4.5" />
      <path d="M9.5 12.2h5" />
      <path d="M9.5 15.8h5" />
    </svg>
  );
}

export function ClientStatusCard({ detection, selected, onSelect }: ClientStatusCardProps) {
  const [installGuideError, setInstallGuideError] = useState<string | null>(null);
  const clientLabel = formatClientLabel(detection.client);
  const installGuideUrl = getClientInstallGuideUrl(detection.client);

  async function handleOpenInstallGuide() {
    setInstallGuideError(null);

    try {
      await openUrl(installGuideUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Failed to open install guide for ${clientLabel}.`;
      setInstallGuideError(message);
    }
  }

  return (
    <Card
      className={
        selected
          ? "min-w-0 border-sky-500/70 shadow-[0_14px_24px_rgba(17,89,147,0.18)]"
          : "min-w-0 border-slate-200"
      }
    >
      <CardHeader className="flex-row items-start justify-between gap-3 p-4">
        <div>
          <p className="mb-0.5 text-[0.72rem] uppercase tracking-[0.08em] text-slate-500">
            {detection.client}
          </p>
          <h3 className="text-[1.06rem] leading-tight">{formatClientLabel(detection.client)}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-8 w-8 cursor-pointer rounded-md p-0"
            onClick={() => {
              void handleOpenInstallGuide();
            }}
            aria-label={`Open install guide for ${clientLabel}`}
            title={`Open install guide for ${clientLabel}`}
          >
            <DocsIcon />
            <span className="sr-only">Open install guide for {clientLabel}</span>
          </Button>
          <DetectionStatusBadge status={detection.status} />
        </div>
      </CardHeader>

      <CardContent className="grid min-w-0 gap-3 p-4 pt-0">
        <details className="min-w-0 rounded-lg border border-slate-200 bg-sky-50/40 px-3 py-2 open:bg-sky-50">
          <summary className="cursor-pointer list-none text-sm font-semibold text-sky-900 marker:hidden">
            Show tool details
          </summary>
          <dl className="mt-2 grid min-w-0 gap-2">
            <div className="grid gap-0.5">
              <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Confidence</dt>
              <dd className="text-sm leading-snug text-slate-800">{detection.confidence}%</dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Binary</dt>
              <dd className="min-w-0 break-all text-sm leading-snug text-slate-800">
                {formatEvidence(detection.evidence.binary_path)}
              </dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Config</dt>
              <dd className="min-w-0 break-all text-sm leading-snug text-slate-800">
                {formatEvidence(detection.evidence.config_path)}
              </dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-xs uppercase tracking-[0.08em] text-slate-500">Version</dt>
              <dd className="min-w-0 break-all text-sm leading-snug text-slate-800">
                {formatEvidence(detection.evidence.version)}
              </dd>
            </div>
          </dl>

          <p className="mt-2 min-w-0 break-all text-sm leading-relaxed text-slate-600">
            {detection.note}
          </p>
        </details>

        {installGuideError ? <Alert variant="destructive">{installGuideError}</Alert> : null}

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
