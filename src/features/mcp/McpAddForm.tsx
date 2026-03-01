import { type FormEvent, type KeyboardEvent, useRef } from "react";

import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../lib/utils";
import type { McpOfficialPreset } from "./official-presets";
import type { McpAddFormState, McpAddMode, McpPresetSource, TransportMode } from "./useMcpAddForm";

interface McpAddFormProps {
  disabled: boolean;
  state: McpAddFormState;
  onModeChange: (value: McpAddMode) => void;
  onTargetIdChange: (value: string) => void;
  onTransportModeChange: (value: TransportMode) => void;
  onCommandChange: (value: string) => void;
  onArgsInputChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onEnabledChange: (value: boolean) => void;
  onRegistryQueryChange: (value: string) => void;
  onReloadRegistry: () => Promise<void>;
  onApplyPreset: (preset: McpOfficialPreset, source: McpPresetSource) => void;
  onOpenPresetDocs: (preset: McpOfficialPreset) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  className?: string;
}

export function McpAddForm({
  disabled,
  state,
  onModeChange,
  onTargetIdChange,
  onTransportModeChange,
  onCommandChange,
  onArgsInputChange,
  onUrlChange,
  onEnabledChange,
  onRegistryQueryChange,
  onReloadRegistry,
  onApplyPreset,
  onOpenPresetDocs,
  onSubmit,
  className,
}: McpAddFormProps) {
  const addFormSectionRef = useRef<HTMLDivElement | null>(null);

  const selectedRegistryPreset =
    state.registryResults.find((preset) => preset.id === state.selectedRegistryPresetId) ?? null;
  const selectedPreset =
    state.presets.find((preset) => preset.id === state.selectedPresetId) ?? null;
  const activePreset = state.mode === "registry" ? selectedRegistryPreset : selectedPreset;

  function jumpToAddForm() {
    requestAnimationFrame(() => {
      addFormSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      const targetInput = document.getElementById("mcp-target-id");
      if (targetInput instanceof HTMLInputElement) {
        targetInput.focus({ preventScroll: true });
        targetInput.select();
      }
    });
  }

  function renderPresetCards(source: McpPresetSource, presets: McpOfficialPreset[]) {
    const selectedId =
      source === "registry" ? state.selectedRegistryPresetId : state.selectedPresetId;
    const selectedPreset = presets.find((preset) => preset.id === selectedId) ?? null;
    const orderedPresets =
      selectedPreset === null
        ? presets
        : [selectedPreset, ...presets.filter((preset) => preset.id !== selectedPreset.id)];

    return (
      <div className="grid gap-2">
        {orderedPresets.map((preset) => (
          <div
            key={`${source}-${preset.id}`}
            className={cn(
              "grid gap-2 rounded-xl border bg-slate-50/55 p-3 transition-colors",
              selectedId === preset.id
                ? "sticky top-0 z-10 border-sky-400 bg-sky-50/95 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.15)]"
                : "border-slate-200",
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{preset.name}</p>
                {selectedId === preset.id ? (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-sky-700">
                    Loaded to Form
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-slate-600">{preset.summary}</p>
              <p className="mt-1 text-[0.7rem] uppercase tracking-[0.08em] text-slate-500">
                {preset.sourceLabel}
              </p>
              <p className="mt-1 break-all text-xs text-slate-600">
                {preset.transport.mode === "stdio"
                  ? `${preset.transport.command} ${preset.transport.args.join(" ")}`
                  : preset.transport.url}
              </p>
              {preset.notes.map((note) => (
                <p key={note} className="mt-1 text-xs text-slate-600">
                  • {note}
                </p>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenPresetDocs(preset)}
                disabled={disabled}
              >
                Open Docs
              </Button>
              <Button
                type="button"
                size="sm"
                variant={selectedId === preset.id ? "secondary" : "default"}
                onClick={() => {
                  onApplyPreset(preset, source);
                  jumpToAddForm();
                }}
                disabled={disabled}
              >
                {selectedId === preset.id
                  ? "Loaded to Form"
                  : source === "registry"
                    ? "Use Entry"
                    : "Use Preset"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function handleRegistryInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    void onReloadRegistry();
  }

  function renderTransportEditor() {
    return (
      <>
        <Label htmlFor="mcp-transport-mode">Transport</Label>
        <select
          id="mcp-transport-mode"
          className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          value={state.transportMode}
          onChange={(event) => onTransportModeChange(event.currentTarget.value as TransportMode)}
          disabled={disabled}
        >
          <option value="stdio">stdio (command + args)</option>
          <option value="sse">sse (url)</option>
        </select>

        {state.transportMode === "stdio" ? (
          <>
            <Label htmlFor="mcp-command">Command</Label>
            <Input
              id="mcp-command"
              value={state.command}
              onChange={(event) => onCommandChange(event.currentTarget.value)}
              placeholder="npx"
              disabled={disabled}
            />

            <Label htmlFor="mcp-args">Args (comma-separated)</Label>
            <Input
              id="mcp-args"
              value={state.argsInput}
              onChange={(event) => onArgsInputChange(event.currentTarget.value)}
              placeholder="-y, @scope/package"
              disabled={disabled}
            />
          </>
        ) : (
          <>
            <Label htmlFor="mcp-url">SSE URL</Label>
            <Input
              id="mcp-url"
              value={state.url}
              onChange={(event) => onUrlChange(event.currentTarget.value)}
              placeholder="https://example.com/sse"
              disabled={disabled}
            />
          </>
        )}
      </>
    );
  }

  function renderLoadedPresetSummary() {
    if (activePreset === null) {
      return null;
    }

    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50/70 p-3">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-sky-700">
          Loaded to Form
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{activePreset.name}</p>
        <p className="mt-0.5 text-xs text-slate-700">
          {activePreset.transport.mode === "stdio"
            ? `${state.command} ${state.argsInput}`
            : state.url}
        </p>
        <p className="mt-1 text-xs text-slate-600">You can edit the fields below before adding.</p>
      </div>
    );
  }

  return (
    <form
      className={cn("grid min-w-0 content-start gap-2", className)}
      onSubmit={(event) => void onSubmit(event)}
    >
      {state.localError ? <Alert variant="destructive">{state.localError}</Alert> : null}

      <Label>Add Method</Label>
      <div className="grid grid-cols-3 gap-2 max-[560px]:grid-cols-1">
        <Button
          type="button"
          variant={state.mode === "registry" ? "default" : "outline"}
          className="min-w-0 w-full"
          onClick={() => onModeChange("registry")}
          disabled={disabled}
        >
          Official Registry
        </Button>
        <Button
          type="button"
          variant={state.mode === "preset" ? "default" : "outline"}
          className="min-w-0 w-full"
          onClick={() => onModeChange("preset")}
          disabled={disabled}
        >
          Presets
        </Button>
        <Button
          type="button"
          variant={state.mode === "manual" ? "default" : "outline"}
          className="min-w-0 w-full"
          onClick={() => onModeChange("manual")}
          disabled={disabled}
        >
          Manual
        </Button>
      </div>

      {state.mode === "registry" ? (
        <>
          <Label htmlFor="mcp-registry-query">Registry Search</Label>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <Input
              id="mcp-registry-query"
              value={state.registryQuery}
              onChange={(event) => onRegistryQueryChange(event.currentTarget.value)}
              onKeyDown={handleRegistryInputKeyDown}
              placeholder="github, figma"
              disabled={disabled || state.registryLoading}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void onReloadRegistry();
              }}
              disabled={disabled || state.registryLoading}
            >
              {state.registryLoading ? "Loading..." : "Search"}
            </Button>
          </div>

          {state.registryError ? <Alert variant="warning">{state.registryError}</Alert> : null}

          {state.registryResults.length > 0 ? (
            <>
              <Label>Official MCP Registry</Label>
              {renderPresetCards("registry", state.registryResults)}
            </>
          ) : null}

          {selectedRegistryPreset ? (
            <Alert variant="default" className="break-words">
              Selected registry entry: {selectedRegistryPreset.name}
            </Alert>
          ) : null}

          <div ref={addFormSectionRef} className="grid gap-2">
            <Label htmlFor="mcp-target-id">Target ID</Label>
            <Input
              id="mcp-target-id"
              value={state.targetId}
              onChange={(event) => onTargetIdChange(event.currentTarget.value)}
              placeholder="github"
              disabled={disabled}
            />

            {renderLoadedPresetSummary()}
            {activePreset ? renderTransportEditor() : null}
          </div>
        </>
      ) : null}

      {state.mode === "preset" ? (
        <>
          <Label>Curated Presets</Label>
          {renderPresetCards("preset", state.presets)}

          {selectedPreset ? (
            <Alert variant="default" className="break-words">
              Selected preset: {selectedPreset.name}
            </Alert>
          ) : null}

          <div ref={addFormSectionRef} className="grid gap-2">
            <Label htmlFor="mcp-target-id">Target ID</Label>
            <Input
              id="mcp-target-id"
              value={state.targetId}
              onChange={(event) => onTargetIdChange(event.currentTarget.value)}
              placeholder="github"
              disabled={disabled}
            />

            {renderLoadedPresetSummary()}
            {activePreset ? renderTransportEditor() : null}
          </div>
        </>
      ) : null}

      {state.mode === "manual" ? (
        <>
          <Label htmlFor="mcp-target-id">Target ID</Label>
          <Input
            id="mcp-target-id"
            value={state.targetId}
            onChange={(event) => onTargetIdChange(event.currentTarget.value)}
            placeholder="filesystem"
            disabled={disabled}
          />

          {renderTransportEditor()}
        </>
      ) : null}

      <label className="mt-1 flex items-center gap-2 text-sm text-slate-700" htmlFor="mcp-enabled">
        <input
          id="mcp-enabled"
          className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          type="checkbox"
          checked={state.enabled}
          onChange={(event) => onEnabledChange(event.currentTarget.checked)}
          disabled={disabled}
        />
        Enable this MCP entry immediately
      </label>

      <Button type="submit" disabled={disabled}>
        {state.mode === "manual"
          ? "Add MCP"
          : state.mode === "registry"
            ? "Add from Registry"
            : "Add from Preset"}
      </Button>
    </form>
  );
}
