import type { DetectionStatus } from "../../backend/contracts";
import { Badge } from "../../components/ui/badge";

const STATUS_LABEL: Record<DetectionStatus, string> = {
  absent: "Absent",
  partial: "Partial",
  detected: "Detected",
  error: "Error",
};

const STATUS_VARIANT: Record<DetectionStatus, "secondary" | "warning" | "success" | "destructive"> =
  {
    absent: "secondary",
    partial: "warning",
    detected: "success",
    error: "destructive",
  };

interface DetectionStatusBadgeProps {
  status: DetectionStatus;
}

export function DetectionStatusBadge({ status }: DetectionStatusBadgeProps) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
