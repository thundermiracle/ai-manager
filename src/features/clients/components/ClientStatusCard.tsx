import type { ClientDetection } from "../../../backend/contracts";
import { formatClientLabel } from "../client-labels";
import { StatusBadge } from "./StatusBadge";

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
    <article className={selected ? "client-card client-card-selected" : "client-card"}>
      <header className="client-card-header">
        <div>
          <p className="client-card-kicker">{detection.client}</p>
          <h3>{formatClientLabel(detection.client)}</h3>
        </div>
        <StatusBadge status={detection.status} />
      </header>

      <details className="client-details">
        <summary>Show tool details</summary>
        <dl className="client-evidence-list">
          <div>
            <dt>Confidence</dt>
            <dd>{detection.confidence}%</dd>
          </div>
          <div>
            <dt>Binary</dt>
            <dd>{formatEvidence(detection.evidence.binary_path)}</dd>
          </div>
          <div>
            <dt>Config</dt>
            <dd>{formatEvidence(detection.evidence.config_path)}</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>{formatEvidence(detection.evidence.version)}</dd>
          </div>
        </dl>

        <p className="client-note">{detection.note}</p>
      </details>

      <button
        className={selected ? "ghost-button ghost-button-selected" : "ghost-button"}
        type="button"
        onClick={() => onSelect(detection.client)}
      >
        {selected ? "Selected" : "Select Client"}
      </button>
    </article>
  );
}
