import { useMemo, useState } from "react";

import type { ClientDetection } from "./backend/contracts";
import { ErrorRecoveryCallout } from "./components/shared/ErrorRecoveryCallout";
import { ViewStatePanel } from "./components/shared/ViewStatePanel";
import { Button } from "./components/ui/button";
import { ClientStatusCard } from "./features/clients/ClientStatusCard";
import { formatClientLabel } from "./features/clients/client-labels";
import { useClientDetections } from "./features/clients/useClientDetections";
import { McpManagerPanel } from "./features/mcp/McpManagerPanel";
import { type AppRoute, NAVIGATION_ITEMS } from "./features/navigation";
import { SkillsManagerPanel } from "./features/skills/SkillsManagerPanel";
import { cn } from "./lib/utils";
import "./App.css";

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

function App() {
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
  const isDashboardRoute = activeRoute === "dashboard";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_8%_2%,#f9f8f3_0%,#edf6ff_40%,#e9f0f4_100%)] p-4 text-slate-900 max-[720px]:p-3">
      <aside className="fixed left-4 top-4 z-10 grid h-[calc(100vh-2rem)] w-[clamp(17rem,24vw,20rem)] grid-rows-[auto_1fr] gap-5 overflow-y-auto rounded-[1.25rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-5 text-slate-100 shadow-[0_20px_44px_rgba(13,27,50,0.24)] max-[980px]:static max-[980px]:mb-4 max-[980px]:h-auto max-[980px]:w-full max-[980px]:grid-rows-[auto] max-[720px]:rounded-xl max-[720px]:p-4">
        <div className="grid gap-2">
          <p className="text-xs uppercase tracking-[0.11em] text-sky-300">AI Manager</p>
          <h1 className="text-[clamp(1.35rem,2.5vw,1.8rem)] leading-tight">
            Client Control Center
          </h1>
          <p className="text-sm leading-relaxed text-slate-200">
            macOS-first shell for detection, MCP, and Skills operations.
          </p>
        </div>

        <nav
          className="grid content-start gap-2 max-[980px]:grid-cols-3 max-[720px]:grid-cols-1"
          aria-label="Primary Navigation"
        >
          {NAVIGATION_ITEMS.map((item) => (
            <button
              key={item.route}
              type="button"
              className={cn(
                "grid gap-1 rounded-xl border px-4 py-3 text-left transition hover:-translate-y-0.5",
                activeRoute === item.route
                  ? "border-sky-100 bg-gradient-to-br from-sky-400 to-cyan-400 text-slate-900"
                  : "border-slate-300/20 bg-slate-900/30 text-slate-100 hover:border-sky-300/70",
                "max-[980px]:min-h-20 max-[980px]:content-center",
              )}
              onClick={() => setActiveRoute(item.route)}
            >
              <span className="text-sm font-semibold">{item.title}</span>
              <small
                className={activeRoute === item.route ? "text-slate-800/85" : "text-slate-300"}
              >
                {item.subtitle}
              </small>
            </button>
          ))}
        </nav>
      </aside>

      <section className="ml-[calc(clamp(17rem,24vw,20rem)+1rem)] grid gap-4 rounded-[1.25rem] border border-slate-200/80 bg-white/85 p-5 shadow-[0_20px_36px_rgba(22,35,64,0.09)] backdrop-blur max-[980px]:ml-0 max-[720px]:rounded-xl max-[720px]:p-4">
        <header className="flex items-start justify-between gap-3 max-[720px]:flex-col">
          <div>
            <h2 className="text-[clamp(1.3rem,2.4vw,1.65rem)] font-semibold leading-tight">
              App Shell and Client Dashboard
            </h2>
            <p className="mt-1.5 text-slate-700">
              {selectedDetection
                ? `Current client: ${formatClientLabel(selectedDetection.client)}`
                : "Choose a client to continue."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void refresh();
            }}
            disabled={phase === "loading"}
          >
            {phase === "loading" ? "Refreshing..." : "Refresh Detection"}
          </Button>
        </header>

        {lastOperationId ? (
          <p className="mt-[-0.1rem] text-sm text-slate-500">Operation: {lastOperationId}</p>
        ) : null}

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
            {isDashboardRoute ? (
              <section className="grid grid-cols-[repeat(auto-fit,minmax(16.3rem,1fr))] gap-3">
                {detections.map((detection) => (
                  <ClientStatusCard
                    key={detection.client}
                    detection={detection}
                    selected={detection.client === selectedClient}
                    onSelect={setSelectedClient}
                  />
                ))}
              </section>
            ) : (
              <section className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#fbfdff_0%,#f7fafc_100%)] px-4 py-3">
                <div className="grid gap-1">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.09em] text-slate-500">
                    Active Client
                  </p>
                  <p className="text-sm text-slate-700">
                    Manager views prioritize resource operations. Open dashboard for full tool
                    cards.
                  </p>
                </div>

                <div className="flex items-center gap-2 max-[720px]:w-full">
                  <select
                    className="h-10 min-w-[13.5rem] rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 max-[720px]:w-full"
                    value={selectedClient ?? ""}
                    onChange={(event) =>
                      setSelectedClient(event.currentTarget.value as ClientDetection["client"])
                    }
                  >
                    {detections.map((detection) => (
                      <option key={detection.client} value={detection.client}>
                        {formatClientLabel(detection.client)}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveRoute("dashboard")}
                  >
                    Open Dashboard
                  </Button>
                </div>
              </section>
            )}

            {featureContent}
          </>
        ) : null}
      </section>
    </main>
  );
}

export default App;
