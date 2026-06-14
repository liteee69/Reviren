import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const roadmaps = [
  { title: "Robotics", phases: 6, progress: 35 },
  { title: "Machine Learning", phases: 8, progress: 12 },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Your learning at a glance.</p>
        </div>
        <Button asChild>
          <Link href="/roadmaps">New roadmap</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Roadmaps</CardDescription>
            <CardTitle className="text-3xl">{roadmaps.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sessions this week</CardDescription>
            <CardTitle className="text-3xl">3</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Flashcards due</CardDescription>
            <CardTitle className="text-3xl">14</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Your roadmaps</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {roadmaps.map((r) => (
            <Card key={r.title}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{r.title}</CardTitle>
                  <Badge variant="secondary">{r.phases} phases</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Progress value={r.progress} />
                <p className="text-sm text-muted-foreground">
                  {r.progress}% complete
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
