export type ClientKind = "claude_code" | "codex" | "cursor";

export type ResourceKind = "mcp" | "skill" | "subagent";
export type ResourceSourceScope = "user" | "project_shared" | "project_private";
export type ResourceViewMode = "effective" | "all_sources";

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
  app_path: string | null;
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

export interface DiscoverSkillRepositoryRequest {
  github_repo_url: string;
}

export interface DiscoveredSkillCandidate {
  manifest_path: string;
  suggested_target_id: string;
  summary: string;
  manifest_checksum: string;
}

export interface DiscoverSkillRepositoryResponse {
  normalized_repo_url: string;
  warning: string;
  items: DiscoveredSkillCandidate[];
}

export interface ListResourcesRequest {
  client?: ClientKind | null;
  resource_kind: ResourceKind;
  enabled?: boolean | null;
  project_root?: string | null;
  view_mode?: ResourceViewMode | null;
  scope_filter?: ResourceSourceScope[] | null;
}

export interface ResourceRecord {
  id: string;
  logical_id: string;
  client: ClientKind;
  display_name: string;
  enabled: boolean;
  transport_kind: string | null;
  transport_command: string | null;
  transport_args: string[] | null;
  transport_url: string | null;
  source_path: string | null;
  source_id: string;
  source_scope: ResourceSourceScope;
  source_label: string;
  is_effective: boolean;
  shadowed_by: string | null;
  description: string | null;
  install_kind: string | null;
  manifest_content: string | null;
}

export interface ListResourcesResponse {
  client: ClientKind | null;
  resource_kind: ResourceKind;
  project_root: string | null;
  view_mode: ResourceViewMode;
  items: ResourceRecord[];
  warning: string | null;
}

export type MutationAction = "add" | "remove" | "update";

export interface MutateResourceRequest {
  client: ClientKind;
  resource_kind: ResourceKind;
  action: MutationAction;
  target_id: string;
  project_root?: string | null;
  target_source_id?: string | null;
  payload: Record<string, unknown> | null;
}

export interface MutateResourceResponse {
  accepted: boolean;
  action: MutationAction;
  target_id: string;
  message: string;
  source_path: string | null;
  target_source_id: string | null;
}

export interface ReplicateResourceRequest {
  resource_kind: ResourceKind;
  source_client: ClientKind;
  source_target_id: string;
  source_source_id: string;
  source_project_root?: string | null;
  destination_client: ClientKind;
  destination_target_id?: string | null;
  destination_source_id?: string | null;
  destination_project_root?: string | null;
  overwrite?: boolean;
}

export interface ReplicateResourceResponse {
  accepted: boolean;
  resource_kind: ResourceKind;
  source_client: ClientKind;
  source_target_id: string;
  destination_client: ClientKind;
  destination_target_id: string;
  destination_source_id: string;
  message: string;
}
