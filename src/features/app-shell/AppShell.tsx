import { useMemo, useState } from "react";

import type { ClientDetection } from "../../backend/contracts";
import { formatClientLabel } from "../clients/client-labels";
import { ClientStatusCard } from "../clients/components/ClientStatusCard";
import { useClientDetections } from "../clients/useClientDetections";
import { ErrorRecoveryCallout } from "../common/ErrorRecoveryCallout";
import { ViewStatePanel } from "../common/ViewStatePanel";
import { McpManagerPanel } from "../mcp/McpManagerPanel";
import { SkillsManagerPanel } from "../skills/SkillsManagerPanel";
import { type AppRoute, NAVIGATION_ITEMS } from "./navigation";

function findSelectedDetection(
  detections: ClientDetection[],
  selectedClient: ClientDetection["client"] | null,
): ClientDetection | null {
  if (selectedClient === null) {
    return null;
  }

  return detections.find((entry) => entry.client === selectedClient) ?? null;
}

function renderRouteContent(route: AppRoute, selectedDetection: ClientDetection | null) {
  if (route === "dashboard") {
    return null;
  }

  if (route === "mcp") {
    return <McpManagerPanel client={selectedDetection?.client ?? null} />;
  }

  return <SkillsManagerPanel client={selectedDetection?.client ?? null} />;
}

export function AppShell() {
  const [activeRoute, setActiveRoute] = useState<AppRoute>("dashboard");
  const {
    phase,
    detections,
    selectedClient,
    errorMessage,
    errorDiagnostic,
    lastOperationId,
    refresh,
    setSelectedClient,
  } = useClientDetections();

  const selectedDetection = useMemo(
    () => findSelectedDetection(detections, selectedClient),
    [detections, selectedClient],
  );

  const featureContent = useMemo(
    () => renderRouteContent(activeRoute, selectedDetection),
    [activeRoute, selectedDetection],
  );

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-block">
          <p className="brand-kicker">AI Manager</p>
          <h1>Client Control Center</h1>
          <p>macOS-first shell for detection, MCP, and Skills operations.</p>
        </div>

        <nav className="nav-list" aria-label="Primary Navigation">
          {NAVIGATION_ITEMS.map((item) => (
            <button
              key={item.route}
              type="button"
              className={activeRoute === item.route ? "nav-item nav-item-active" : "nav-item"}
              onClick={() => setActiveRoute(item.route)}
            >
              <span>{item.title}</span>
              <small>{item.subtitle}</small>
            </button>
          ))}
        </nav>
      </aside>

      <section className="app-content">
        <header className="content-header">
          <div>
            <p className="content-kicker">Issue #27</p>
            <h2>App Shell and Client Dashboard</h2>
            <p>
              {selectedDetection
                ? `Current client: ${formatClientLabel(selectedDetection.client)}`
                : "Choose a client to continue."}
            </p>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              void refresh();
            }}
            disabled={phase === "loading"}
          >
            {phase === "loading" ? "Refreshing..." : "Refresh Detection"}
          </button>
        </header>

        {lastOperationId ? <p className="operation-id">Operation: {lastOperationId}</p> : null}

        {phase === "loading" ? (
          <ViewStatePanel
            title="Detecting Installed Clients"
            message="Inspecting binaries and config paths for the supported clients."
          />
        ) : null}

        {phase === "error" ? (
          errorDiagnostic ? (
            <ErrorRecoveryCallout
              title="Detection failed"
              diagnostic={errorDiagnostic}
              retryLabel="Retry Detection"
              onRetry={() => {
                void refresh();
              }}
            />
          ) : (
            <ViewStatePanel
              title="Detection Failed"
              message={errorMessage ?? "Unknown detection error."}
              actionLabel="Retry Detection"
              onAction={() => {
                void refresh();
              }}
            />
          )
        ) : null}

        {phase === "ready" && detections.length === 0 ? (
          <ViewStatePanel
            title="No Clients Detected"
            message="No supported clients were detected. Install a supported client or set override paths."
            actionLabel="Retry Detection"
            onAction={() => {
              void refresh();
            }}
          />
        ) : null}

        {phase === "ready" && detections.length > 0 ? (
          <>
            <section className="client-grid">
              {detections.map((detection) => (
                <ClientStatusCard
                  key={detection.client}
                  detection={detection}
                  selected={detection.client === selectedClient}
                  onSelect={setSelectedClient}
                />
              ))}
            </section>

            {featureContent}
          </>
        ) : null}
      </section>
    </main>
  );
}
