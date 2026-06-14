import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SessionsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plan a session</h1>
        <p className="text-muted-foreground">
          Pick your hours — get a prioritised topic list.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available time</CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Hours</label>
            <Input type="number" defaultValue={2} className="w-24" />
          </div>
          <Button>Plan with AI</Button>
          <Button variant="outline">Pick manually</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pomodoro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-5xl font-mono tabular-nums">25:00</div>
          <div className="flex gap-2">
            <Button>Start</Button>
            <Button variant="outline">Reset</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
