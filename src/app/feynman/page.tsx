import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function FeynmanPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Feynman review</h1>
        <p className="text-muted-foreground">
          Explain a topic in your words. Get scored on understanding.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your explanation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="w-full min-h-40 rounded-md border bg-transparent p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Explain the topic as if teaching a beginner…"
          />
          <Button>Score my understanding</Button>
        </CardContent>
      </Card>
    </div>
  );
}
