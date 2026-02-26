export type ClientKind = "claude_code" | "codex_cli" | "cursor" | "codex_app";

export type ResourceKind = "mcp" | "skill";

export type LifecyclePhase = "running" | "shutting_down";

export interface LifecycleSnapshot {
  phase: LifecyclePhase;
  initialized_at_epoch_ms: number;
  shutdown_requested_at_epoch_ms: number | null;
}

export type CommandErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_IMPLEMENTED"
  | "SHUTTING_DOWN"
  | "INTERNAL_ERROR";

export interface CommandError {
  code: CommandErrorCode;
  message: string;
  recoverable: boolean;
}

export interface CommandMeta {
  operation_id: string;
  lifecycle: LifecycleSnapshot;
}

export interface CommandEnvelope<T> {
  ok: boolean;
  data: T | null;
  error: CommandError | null;
  meta: CommandMeta;
}

export interface DetectClientsRequest {
  include_versions: boolean;
}

export type DetectionStatus = "absent" | "partial" | "detected" | "error";

export interface DetectionEvidence {
  binary_path: string | null;
  config_path: string | null;
  version: string | null;
}

export interface ClientDetection {
  client: ClientKind;
  status: DetectionStatus;
  confidence: number;
  evidence: DetectionEvidence;
  note: string;
}

export interface DetectClientsResponse {
  clients: ClientDetection[];
}

export interface ListResourcesRequest {
  client?: ClientKind | null;
  resource_kind: ResourceKind;
  enabled?: boolean | null;
}

export interface ResourceRecord {
  id: string;
  client: ClientKind;
  display_name: string;
  enabled: boolean;
  transport_kind: string | null;
  source_path: string | null;
  description: string | null;
  install_kind: string | null;
}

export interface ListResourcesResponse {
  client: ClientKind | null;
  resource_kind: ResourceKind;
  items: ResourceRecord[];
  warning: string | null;
}

export type MutationAction = "add" | "remove";

export interface MutateResourceRequest {
  client: ClientKind;
  resource_kind: ResourceKind;
  action: MutationAction;
  target_id: string;
  payload: Record<string, unknown> | null;
}

export interface MutateResourceResponse {
  accepted: boolean;
  action: MutationAction;
  target_id: string;
  message: string;
}
