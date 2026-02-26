import type { DetectionStatus } from "../../../backend/contracts";

const STATUS_LABEL: Record<DetectionStatus, string> = {
  absent: "Absent",
  partial: "Partial",
  detected: "Detected",
  error: "Error",
};

const STATUS_CLASS: Record<DetectionStatus, string> = {
  absent: "status-badge status-badge-absent",
  partial: "status-badge status-badge-partial",
  detected: "status-badge status-badge-detected",
  error: "status-badge status-badge-error",
};

interface StatusBadgeProps {
  status: DetectionStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</span>;
}
