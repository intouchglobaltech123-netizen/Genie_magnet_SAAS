"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { usePlanner } from "@/features/planner/store";
import { questions, SCALE } from "@/lib/mock/planner";
import { cn } from "@/lib/utils";

export function QuizTab({ onFinish }: { onFinish: () => void }) {
  const answers = usePlanner((s) => s.answers);
  const answer = usePlanner((s) => s.answer);
  const idx = usePlanner((s) => s.quizIndex);
  const setIdx = usePlanner((s) => s.setQuizIndex);
  const applySample = usePlanner((s) => s.applySampleAnswers);
  const resetQuiz = usePlanner((s) => s.resetQuiz);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = questions[Math.min(idx, questions.length - 1)];
  const answeredCount = questions.filter((x) => typeof answers[x.n] === "number").length;
  const done = answeredCount === questions.length;
  const isFlow = q.n <= 27;
  const sectionIndex = isFlow ? q.n : q.n - 27;

  const pick = (v: number) => {
    answer(q.n, v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (idx < questions.length - 1) setIdx(idx + 1);
    }, 260);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (/^[1-5]$/.test(e.key)) pick(Number(e.key));
      if (e.key === "ArrowRight" && idx < questions.length - 1) setIdx(idx + 1);
      if (e.key === "ArrowLeft" && idx > 0) setIdx(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <Card className="overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge tone={isFlow ? "accent" : "gold"}>{isFlow ? "Part A · Money Flow Pattern" : "Part B · Money Belief"}</Badge>
              <span className="text-body text-muted-foreground">
                {sectionIndex} of 27
              </span>
            </div>
            <span className="text-body text-muted-foreground tabular">
              {answeredCount}/54 answered
            </span>
          </div>
          <Progress value={(answeredCount / 54) * 100} className="mt-3" />
        </div>

        <div className="relative min-h-[340px] px-6 py-10 md:px-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={q.n}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.18 }}
            >
              <div className="text-body font-medium text-muted-foreground tabular">Question {q.n}</div>
              <h2 className="mt-2 max-w-2xl text-heading font-semibold leading-snug tracking-tight md:text-heading">{q.q}</h2>
              <div className="mt-8 grid grid-cols-5 gap-2 md:gap-3">
                {SCALE.map((s) => {
                  const active = answers[q.n] === s.value;
                  return (
                    <button
                      key={s.value}
                      onClick={() => pick(s.value)}
                      className={cn(
                        "group flex cursor-pointer flex-col items-center gap-2 rounded-xl border px-2 py-4 transition",
                        active ? "border-primary bg-primary-soft text-primary shadow-sm" : "border-border hover:border-primary/40 hover:bg-muted/60",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex size-9 items-center justify-center rounded-full text-subheading font-semibold tabular transition",
                          active ? "bg-primary text-white" : "bg-muted text-foreground group-hover:bg-card",
                        )}
                      >
                        {s.value}
                      </span>
                      <span className="text-body font-medium">{s.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 text-center text-body text-muted-foreground">Tip: press 1–5 on your keyboard · ← → to move</div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-3">
          <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
            <ArrowLeft /> Back
          </Button>
          {done ? (
            <Button variant="accent" size="sm" onClick={onFinish}>
              <Sparkles /> See my Money Profile
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={idx >= questions.length - 1} onClick={() => setIdx(idx + 1)}>
              Next <ArrowRight />
            </Button>
          )}
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="p-4">
          <div className="text-body font-semibold">Money Behaviour Diagnostic</div>
          <p className="mt-1 text-body text-muted-foreground">
            54 honest answers → your flow patterns, belief blocks and a Money Behaviour Score out of 100.
          </p>
          <div className="mt-4 space-y-3">
            {[
              { label: "Part A · Flow patterns", from: 1, to: 27 },
              { label: "Part B · Beliefs", from: 28, to: 54 },
            ].map((part) => (
              <div key={part.label}>
                <div className="mb-1.5 text-body font-medium uppercase tracking-wider text-muted-foreground">{part.label}</div>
                <div className="grid grid-cols-9 gap-1">
                  {questions
                    .filter((x) => x.n >= part.from && x.n <= part.to)
                    .map((x) => {
                      const a = answers[x.n];
                      return (
                        <Tooltip key={x.n} content={`Q${x.n}${typeof a === "number" ? ` · ${SCALE[a - 1].label}` : ""}`}>
                          <button
                            onClick={() => setIdx(x.n - 1)}
                            className={cn(
                              "h-5 cursor-pointer rounded-[5px] text-body font-medium transition tabular",
                              x.n === q.n ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : "",
                              typeof a === "number" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-input",
                            )}
                          >
                            {x.n}
                          </button>
                        </Tooltip>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-body font-semibold">Short on time?</div>
          <p className="mt-1 text-body text-muted-foreground">Load the workbook&apos;s sample answers and jump straight to the profile.</p>
          <div className="mt-3 flex flex-col gap-2">
            <Button
              variant="soft"
              size="sm"
              onClick={() => {
                applySample();
                toast.success("Sample answers loaded", { description: "Raw score 311 → Money Behaviour Score 61.8" });
                onFinish();
              }}
            >
              <Wand2 /> Jump to results with sample answers
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                resetQuiz();
                toast("Diagnostic cleared");
              }}
            >
              <RotateCcw /> Start over
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
