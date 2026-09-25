"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Film, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemo } from "@/lib/store";
import { publishTimes } from "@/lib/mock/portal";
import { fmtDate } from "@/lib/utils";
import { portalVideos } from "./lib";
import { Poster } from "./poster";

export function PortalLibrary() {
  const videos = useDemo((s) => s.videos);
  const [tab, setTab] = useState("all");
  const done = portalVideos(videos).filter((v) => v.stage === "Approved" || v.stage === "Published");
  const shown = done.filter((v) => tab === "all" || (tab === "published" ? v.stage === "Published" : v.stage === "Approved"));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-heading font-semibold tracking-tight">Library</h1>
          <p className="mt-1 text-body text-muted-foreground">Every approved video, the exact version you approved, and where it went live.</p>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All · {done.length}</TabsTrigger>
            <TabsTrigger value="published">Live</TabsTrigger>
            <TabsTrigger value="approved">Scheduled</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={Film}
          title={tab === "published" ? "Nothing live yet" : tab === "approved" ? "Nothing scheduled" : "Your library is empty"}
          description="Videos appear here as soon as you approve them, with the exact version and where they went live."
          action={
            <Button variant="outline" asChild>
              <Link href="/portal">Back to overview</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((v) => {
            const ver = v.versions.find((x) => x.status === "approved") ?? v.versions.at(-1);
            return (
              <Card key={v.id} className="group overflow-hidden">
                <Link href={`/portal/review/${v.id}`} aria-label={`Open ${v.title}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-inset">
                  <Poster video={v} className="aspect-video" />
                </Link>
                <div className="space-y-3 p-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-body text-muted-foreground">{v.code}</span>
                      {v.stage === "Published" ? (
                        <Badge tone="success" dot>
                          Live
                        </Badge>
                      ) : (
                        <Badge tone="info" dot>
                          Goes live {fmtDate(v.publishDate)} · {publishTimes[v.id] ?? "18:30"}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-body font-semibold leading-snug">{v.title}</div>
                    <div className="mt-1 text-body text-muted-foreground">
                      {ver?.label} approved · {ver?.duration} · {v.platform.join(", ")}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {v.publishedUrl ? (
                      <Button size="xs" variant="outline" asChild>
                        <a href={v.publishedUrl} target="_blank" rel="noreferrer">
                          <ExternalLink /> View post
                        </a>
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => toast("Link copied", { description: `Private preview link for ${v.code} copied to clipboard` })}
                      >
                        <Link2 /> Copy preview link
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => toast.success("Download started", { description: `${v.code}_${ver?.label}_master.mp4 · ${v.format === "Long-form" ? "1.2 GB" : "86 MB"}` })}
                    >
                      <Download /> Master file
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
