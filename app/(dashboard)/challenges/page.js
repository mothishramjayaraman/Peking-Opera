"use client";

import { useLanguage } from "@/lib/language-context.jsx";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function Challenges() {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <div className="p-6 flex flex-col items-center justify-center h-[60vh]">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Trophy className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold">Challenges Coming Soon</h2>
      <p className="text-muted-foreground mb-4">We are currently building this feature. Check back later!</p>
      <Button onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
    </div>
  );
}
