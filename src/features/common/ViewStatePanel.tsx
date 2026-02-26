interface ViewStatePanelProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ViewStatePanel({ title, message, actionLabel, onAction }: ViewStatePanelProps) {
  return (
    <section className="view-state-panel">
      <h2>{title}</h2>
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button type="button" className="ghost-button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}
