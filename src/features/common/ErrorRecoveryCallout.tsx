import type { ErrorDiagnostic } from "./errorDiagnostics";

interface ErrorRecoveryCalloutProps {
  title: string;
  diagnostic: ErrorDiagnostic;
  retryLabel?: string;
  onRetry?: () => void;
}

export function ErrorRecoveryCallout({
  title,
  diagnostic,
  retryLabel,
  onRetry,
}: ErrorRecoveryCalloutProps) {
  return (
    <section className="recovery-callout" role="alert">
      <header className="recovery-callout-header">
        <h3>{title}</h3>
        <span
          className={
            diagnostic.recoverable
              ? "recovery-callout-badge recovery-callout-badge-recoverable"
              : "recovery-callout-badge recovery-callout-badge-nonrecoverable"
          }
        >
          {diagnostic.recoverable ? "Recoverable" : "Non-recoverable"}
        </span>
      </header>

      <p className="recovery-callout-code">Code: {diagnostic.code}</p>
      <p className="recovery-callout-message">{diagnostic.message}</p>

      {diagnostic.backupPath ? (
        <p className="recovery-callout-backup">
          Backup path: <code>{diagnostic.backupPath}</code>
        </p>
      ) : null}

      <ul className="recovery-callout-guidance">
        {diagnostic.guidance.map((step, index) => (
          <li key={`${diagnostic.code}-${index.toString()}`}>{step}</li>
        ))}
      </ul>

      {onRetry && retryLabel ? (
        <button type="button" className="ghost-button" onClick={onRetry}>
          {retryLabel}
        </button>
      ) : null}
    </section>
  );
}
