"use client";

import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import Link from "next/link";

interface Detection {
  label: string;
  confidence: number;
  box: { x1: number; y1: number; x2: number; y2: number };
}

interface DetectionRecord {
  id: string;
  userId: string;
  type: "road" | "waste";
  imageUrl: string | null;
  width: number;
  height: number;
  detections: Detection[];
  createdAt: string;
}

const fmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(iso: string): string {
  return fmt.format(new Date(iso));
}

function SkeletonCard() {
  return (
    <div className="bg-surface-slate rounded-[20px] p-6 border border-image-frame animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="h-5 w-16 bg-image-frame rounded-sm" />
        <div className="h-4 w-24 bg-image-frame rounded-sm" />
      </div>
      <div className="h-4 w-32 bg-image-frame rounded-sm mb-3" />
      <div className="h-3 w-48 bg-image-frame rounded-sm" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <History className="h-12 w-12 text-secondary-text mb-5 opacity-40" />
      <h2 className="text-[22px] font-bold text-foreground mb-2">No inspections yet</h2>
      <p className="text-[14px] text-secondary-text mb-8 max-w-sm leading-relaxed">
        Run a road or waste detection to get started
      </p>
      <Link
        href="/roads"
        className="text-[11px] font-bold uppercase tracking-[1.5px] text-black bg-mint px-5 py-2.5 rounded-[24px] hover:bg-foreground hover:text-canvas transition-colors"
      >
        Start Detection
      </Link>
    </div>
  );
}

export default function HistoryPage() {
  const [records, setRecords] = useState<DetectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/detections?limit=20")
      .then((res) => res.json())
      .then((data: { detections: DetectionRecord[]; total: number }) => {
        setRecords(data.detections);
      })
      .catch(() => {
        setError("Failed to load inspection history.");
        setRecords([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <main className="pt-[72px] min-h-screen bg-canvas">
      <div className="max-w-[1300px] mx-auto px-6 py-12">

        <div className="flex items-baseline gap-3 mb-10">
          <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text">Inspection Feed</span>
          <span className="text-secondary-text/30">/</span>
          <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-mint-fg">Storystream</span>
        </div>

        {error && !loading && (
          <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 text-destructive text-[12px] px-4 py-3 rounded-[12px] mb-6">
            <span>{error}</span>
            <button
              onClick={loadData}
              className="text-[11px] font-bold uppercase tracking-[1.1px] ml-4 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {!loading && records.length === 0 && <EmptyState />}

        {!loading && records.length > 0 && (
          <div className="relative">
            {/* Vertical rail */}
            <div className="absolute left-[76px] top-0 bottom-0 w-px bg-purple-rule/40" />

            <div className="flex flex-col gap-4">
              {records.map((record) => {
                const topLabels = record.detections
                  .slice(0, 2)
                  .map((d) => d.label)
                  .join(", ");

                const isRoad = record.type === "road";

                return (
                  <div key={record.id} className="flex gap-6 items-start group">
                    {/* Timestamp */}
                    <div className="w-20 shrink-0 text-right pt-5 bg-canvas z-10">
                      <div className="text-[11px] font-bold text-secondary-text uppercase tracking-[1.1px]">
                        {new Date(record.createdAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </div>
                      <div className="text-[10px] text-secondary-text/40 uppercase tracking-[1.1px]">
                        {new Date(record.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>

                    {/* Card */}
                    <Link
                      href={`/history/${record.id}`}
                      className="bg-surface-slate rounded-[20px] p-6 border border-image-frame w-full hover:bg-surface-bright transition-colors flex gap-6 no-underline"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-4">
                          <span
                            className={`inline-block border text-[10px] font-bold uppercase tracking-[1.5px] px-2 py-0.5 rounded-sm ${
                              isRoad
                                ? "text-mint-fg border-mint"
                                : "text-amber-400 border-amber-400/50"
                            }`}
                          >
                            {isRoad ? "Road" : "Waste"}
                          </span>
                          <span className="text-[11px] text-secondary-text">
                            {record.detections.length} detection{record.detections.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        <h3 className="text-[16px] font-bold text-foreground mb-1 group-hover:text-deep-link transition-colors">
                          {formatDate(record.createdAt)}
                        </h3>

                        {topLabels && (
                          <p className="text-[13px] text-secondary-text leading-relaxed">
                            {topLabels}
                          </p>
                        )}
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
