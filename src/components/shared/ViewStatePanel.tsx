import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface ViewStatePanelProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ViewStatePanel({ title, message, actionLabel, onAction }: ViewStatePanelProps) {
  return (
    <Card className="border-dashed border-slate-300 bg-slate-50/80">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 p-4 pt-0">
        <p className="leading-relaxed text-slate-700">{message}</p>
        {actionLabel && onAction ? (
          <Button type="button" variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
