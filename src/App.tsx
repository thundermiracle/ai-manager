import { useState } from "react";

import { detectClients, listResources, mutateResource } from "./backend/client";
import type { ClientKind, MutateResourceRequest, ResourceKind } from "./backend/contracts";
import "./App.css";

const SUPPORTED_CLIENTS: ClientKind[] = ["claude_code", "codex_cli", "cursor", "codex_app"];

const SUPPORTED_RESOURCE_KINDS: ResourceKind[] = ["mcp", "skill"];

function formatEnvelope(command: string, envelope: unknown): string {
  return JSON.stringify({ command, envelope }, null, 2);
}

function App() {
  const [selectedClient, setSelectedClient] = useState<ClientKind>("claude_code");
  const [resourceKind, setResourceKind] = useState<ResourceKind>("mcp");
  const [targetId, setTargetId] = useState("example.resource");
  const [runningCommand, setRunningCommand] = useState<string | null>(null);
  const [commandOutput, setCommandOutput] = useState("No command executed yet.");

  async function runDetectCommand() {
    const command = "detect_clients";
    setRunningCommand(command);

    try {
      const envelope = await detectClients({ include_versions: true });
      setCommandOutput(formatEnvelope(command, envelope));
    } catch (error) {
      setCommandOutput(
        formatEnvelope(command, {
          ok: false,
          error: error instanceof Error ? error.message : "Unknown invoke error",
        }),
      );
    } finally {
      setRunningCommand(null);
    }
  }

  async function runListCommand() {
    const command = "list_resources";
    setRunningCommand(command);

    try {
      const envelope = await listResources({
        client: selectedClient,
        resource_kind: resourceKind,
      });
      setCommandOutput(formatEnvelope(command, envelope));
    } catch (error) {
      setCommandOutput(
        formatEnvelope(command, {
          ok: false,
          error: error instanceof Error ? error.message : "Unknown invoke error",
        }),
      );
    } finally {
      setRunningCommand(null);
    }
  }

  async function runMutateCommand() {
    const command = "mutate_resource";
    setRunningCommand(command);

    const request: MutateResourceRequest = {
      client: selectedClient,
      resource_kind: resourceKind,
      action: "add",
      target_id: targetId,
      payload: null,
    };

    try {
      const envelope = await mutateResource(request);
      setCommandOutput(formatEnvelope(command, envelope));
    } catch (error) {
      setCommandOutput(
        formatEnvelope(command, {
          ok: false,
          error: error instanceof Error ? error.message : "Unknown invoke error",
        }),
      );
    } finally {
      setRunningCommand(null);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="tag">Issue #15: Command Boundary + App State</p>
        <h1>AI Manager Backend API Scaffold</h1>
        <p className="summary">
          Frontend now calls typed detect/list/mutate backend commands through a shared result
          envelope.
        </p>
      </section>

      <section className="panel">
        <h2>Placeholder Command Runner</h2>

        <div className="field-grid">
          <label htmlFor="client-select">Client</label>
          <select
            id="client-select"
            value={selectedClient}
            onChange={(event) => setSelectedClient(event.currentTarget.value as ClientKind)}
          >
            {SUPPORTED_CLIENTS.map((client) => (
              <option key={client} value={client}>
                {client}
              </option>
            ))}
          </select>

          <label htmlFor="resource-select">Resource Kind</label>
          <select
            id="resource-select"
            value={resourceKind}
            onChange={(event) => setResourceKind(event.currentTarget.value as ResourceKind)}
          >
            {SUPPORTED_RESOURCE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>

          <label htmlFor="target-id">Mutation Target ID</label>
          <input
            id="target-id"
            value={targetId}
            onChange={(event) => setTargetId(event.currentTarget.value)}
            placeholder="example.resource"
          />
        </div>

        <div className="actions">
          <button type="button" onClick={runDetectCommand} disabled={runningCommand !== null}>
            {runningCommand === "detect_clients" ? "Running..." : "Run detect_clients"}
          </button>
          <button type="button" onClick={runListCommand} disabled={runningCommand !== null}>
            {runningCommand === "list_resources" ? "Running..." : "Run list_resources"}
          </button>
          <button type="button" onClick={runMutateCommand} disabled={runningCommand !== null}>
            {runningCommand === "mutate_resource" ? "Running..." : "Run mutate_resource"}
          </button>
        </div>

        <pre className="command-output">{commandOutput}</pre>
      </section>
    </main>
  );
}

export default App;
