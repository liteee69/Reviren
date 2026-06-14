import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const cards = [
  { front: "What is inverse kinematics?", deck: "Robotics" },
  { front: "Define gradient descent", deck: "Machine Learning" },
  { front: "What is a PID controller?", deck: "Robotics" },
];

export default function FlashcardsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flashcards</h1>
          <p className="text-muted-foreground">Review and generate decks.</p>
        </div>
        <Button>Generate from topic</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.front} className="aspect-video flex flex-col">
            <CardHeader>
              <CardTitle className="text-base">{c.front}</CardTitle>
            </CardHeader>
            <CardContent className="mt-auto text-sm text-muted-foreground">
              {c.deck}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
