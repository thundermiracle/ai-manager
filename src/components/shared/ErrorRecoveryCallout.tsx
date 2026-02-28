import type { ErrorDiagnostic } from "../../features/common/errorDiagnostics";
import { Alert } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

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
    <Alert variant="destructive" className="grid gap-2">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{title}</h3>
        <Badge variant={diagnostic.recoverable ? "warning" : "destructive"}>
          {diagnostic.recoverable ? "Recoverable" : "Non-recoverable"}
        </Badge>
      </header>

      <p className="text-xs uppercase tracking-[0.04em] text-rose-900/90">
        Code: {diagnostic.code}
      </p>
      <p className="leading-relaxed">{diagnostic.message}</p>

      {diagnostic.backupPath ? (
        <p className="text-sm">
          Backup path:{" "}
          <code className="rounded bg-rose-900/10 px-1.5 py-0.5">{diagnostic.backupPath}</code>
        </p>
      ) : null}

      <ul className="grid list-disc gap-1 pl-5 text-sm">
        {diagnostic.guidance.map((step, index) => (
          <li key={`${diagnostic.code}-${index.toString()}`}>{step}</li>
        ))}
      </ul>

      {onRetry && retryLabel ? (
        <Button
          type="button"
          variant="outline"
          className="w-fit border-rose-300 bg-white"
          onClick={onRetry}
        >
          {retryLabel}
        </Button>
      ) : null}
    </Alert>
  );
}
