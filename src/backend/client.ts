import { invoke } from "@tauri-apps/api/core";

import type {
  CommandEnvelope,
  DetectClientsRequest,
  DetectClientsResponse,
  ListResourcesRequest,
  ListResourcesResponse,
  MutateResourceRequest,
  MutateResourceResponse,
} from "./contracts";

export async function detectClients(
  request: DetectClientsRequest,
): Promise<CommandEnvelope<DetectClientsResponse>> {
  return invoke("detect_clients", { request });
}

export async function listResources(
  request: ListResourcesRequest,
): Promise<CommandEnvelope<ListResourcesResponse>> {
  return invoke("list_resources", { request });
}

export async function mutateResource(
  request: MutateResourceRequest,
): Promise<CommandEnvelope<MutateResourceResponse>> {
  return invoke("mutate_resource", { request });
}
