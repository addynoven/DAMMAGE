"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Trash2, Construction } from "lucide-react";
import Link from "next/link";

const DetectionMap = dynamic(() => import("@/components/DetectionMap"), {
  ssr: false,
});

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
  location?: { lat: number; lng: number } | null;
}

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const fullFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function DashboardPage() {
  const [records, setRecords] = useState<DetectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/detections?limit=100")
      .then((res) => res.json())
      .then((data: { detections: DetectionRecord[]; total: number }) => {
        setRecords(data.detections);
      })
      .catch(() => {
        setError("Failed to load detection data.");
        setRecords([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalRoad = records
    .filter((r) => r.type === "road")
    .reduce((sum, r) => sum + r.detections.length, 0);

  const totalWaste = records
    .filter((r) => r.type === "waste")
    .reduce((sum, r) => sum + r.detections.length, 0);

  const recentActivity = records.slice(0, 5);

  const pins = records
    .filter(
      (r): r is typeof r & { location: { lat: number; lng: number } } =>
        r.location != null && typeof r.location.lat === "number"
    )
    .map((r) => ({
      lat: r.location.lat,
      lng: r.location.lng,
      type: r.type,
      id: r.id,
      count: r.detections.length,
    }));

  return (
    <main className="pt-[72px] min-h-screen bg-canvas">
      <div className="max-w-[1300px] mx-auto px-6 py-16">

        {/* Hero */}
        <header className="mb-16">
          <h1 className="font-display text-[72px] md:text-[107px] font-black italic text-foreground uppercase leading-none tracking-tight mb-3">
            DAMMAGE
          </h1>
          <p className="text-[11px] font-light text-secondary-text uppercase tracking-[1.9px]">
            Project Overview &amp; Live Telemetry
          </p>
        </header>

        {error && (
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

        {/* Stats bento */}
        <section className={`grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 transition-opacity duration-300 ${loading ? "opacity-50" : "opacity-100"}`}>
          {/* Primary — mint */}
          <div className="bg-mint text-black rounded-[20px] p-10 md:col-span-2 min-h-[280px] flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[1.5px] mb-4 opacity-70 border-b border-black/20 pb-2 inline-block">
                Total Potholes Detected
              </div>
              <div className="font-display text-[60px] font-black leading-none">
                {totalRoad.toLocaleString()}
              </div>
            </div>
            <div className="flex items-end justify-between gap-4">
              <p className="text-[14px] opacity-80 max-w-sm leading-relaxed">
                Significant structural anomalies recorded across major arterials in the last 72 hours.
                Immediate remediation recommended for Sector 7.
              </p>
              <AlertTriangle className="h-8 w-8 shrink-0 opacity-60" />
            </div>
          </div>

          {/* Secondary — surface */}
          <div className="bg-surface-slate rounded-[20px] p-6 border border-image-frame min-h-[280px] flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-mint-fg mb-4">
                Waste Items Detected
              </div>
              <div className="text-[34px] font-bold text-foreground">
                {totalWaste.toLocaleString()}
              </div>
            </div>
            <div className="border-t border-image-frame pt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] text-secondary-text uppercase tracking-[1.1px]">Zone Alpha</span>
                <span className="text-[11px] text-mint-fg tracking-[1.1px]">45%</span>
              </div>
              <div className="w-full bg-canvas h-1 rounded-full">
                <div className="bg-mint h-1 rounded-full w-[45%]" />
              </div>
            </div>
          </div>
        </section>

        {/* Detection Map */}
        {pins.length > 0 && (
          <section className="mb-16">
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="text-[28px] font-bold text-foreground uppercase tracking-tight">
                Detection Map
              </h2>
              <span className="text-[11px] text-secondary-text uppercase tracking-[1.5px]">
                {pins.length} location{pins.length !== 1 ? "s" : ""} plotted
              </span>
            </div>
            <div className="bg-surface-slate rounded-[20px] border border-image-frame overflow-hidden">
              <DetectionMap pins={pins} />
            </div>
            <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-2 text-[11px] text-secondary-text uppercase tracking-[1.1px]">
                <div className="w-2.5 h-2.5 rounded-full bg-mint" /> Road
              </div>
              <div className="flex items-center gap-2 text-[11px] text-secondary-text uppercase tracking-[1.1px]">
                <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> Waste
              </div>
            </div>
          </section>
        )}

        {/* Live Feed */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">

          {/* Left rail */}
          <div className="hidden md:block md:col-span-3 border-r border-image-frame pr-8">
            <div className="sticky top-24">
              <h2 className="text-[28px] font-bold text-foreground mb-6 leading-tight">LIVE FEED</h2>
              <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-mint-fg mb-4">
                System Status: Active
              </div>
              <p className="text-[14px] text-secondary-text leading-relaxed">
                Continuous ingestion of telemetry data from mobile edge units. Confidence threshold &gt; 94%.
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="md:col-span-9 relative">
            <div className="absolute left-[59px] top-0 bottom-0 w-px bg-image-frame" />

            <div className="flex flex-col gap-3 relative">
              {loading && (
                <div className="flex gap-8 items-start">
                  <div className="w-28 shrink-0" />
                  <div className="bg-surface-slate rounded-[20px] p-6 border border-image-frame w-full animate-pulse">
                    <div className="h-4 w-32 bg-image-frame rounded-sm mb-4" />
                    <div className="h-5 w-48 bg-image-frame rounded-sm mb-3" />
                    <div className="h-3 w-full bg-image-frame rounded-sm" />
                  </div>
                </div>
              )}

              {!loading && recentActivity.length === 0 && (
                <div className="flex gap-8 items-start">
                  <div className="w-28 shrink-0" />
                  <div className="bg-surface-slate rounded-[20px] p-6 border border-image-frame w-full text-center py-12">
                    <p className="text-[14px] text-secondary-text">No recent activity yet.</p>
                    <Link
                      href="/roads"
                      className="inline-block mt-4 text-[11px] font-bold uppercase tracking-[1.5px] text-black bg-mint px-4 py-2 rounded-[24px] hover:bg-foreground hover:text-canvas transition-colors"
                    >
                      Run a Detection
                    </Link>
                  </div>
                </div>
              )}

              {!loading && recentActivity.map((record) => {
                const isRoad = record.type === "road";
                const topLabel = record.detections[0]?.label ?? "Unknown";
                const count = record.detections.length;

                return (
                  <div key={record.id} className="flex gap-8 items-start group">
                    <div className="w-28 shrink-0 text-right pt-4 bg-canvas z-10 pr-4">
                      <div className={`text-[11px] uppercase tracking-[1.1px] ${isRoad ? "text-mint-fg" : "text-secondary-text"}`}>
                        {timeFmt.format(new Date(record.createdAt))}
                      </div>
                      <div className="text-[10px] text-secondary-text/50 uppercase tracking-[1.1px]">
                        {dateFmt.format(new Date(record.createdAt))}
                      </div>
                    </div>

                    <div className={`rounded-[20px] p-6 border w-full hover:bg-surface-bright transition-colors ${isRoad ? "bg-surface-container border-mint" : "bg-surface-slate border-image-frame"}`}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                          {isRoad ? (
                            <AlertTriangle className={`h-3.5 w-3.5 text-mint-fg`} />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5 text-secondary-text" />
                          )}
                          <span className={`text-[11px] font-bold uppercase tracking-[1.5px] ${isRoad ? "text-mint-fg" : "text-secondary-text"}`}>
                            {isRoad ? "Road Detection" : "Waste Detection"}
                          </span>
                        </div>
                        <span className="text-[10px] text-secondary-text border border-image-frame px-2 py-0.5 rounded-sm">
                          {count} item{count !== 1 ? "s" : ""}
                        </span>
                      </div>

                      <h3 className="text-[18px] font-bold text-foreground mb-2 group-hover:text-deep-link transition-colors">
                        {count > 0 ? `${topLabel} and ${count - 1} other${count - 1 !== 1 ? "s" : ""} detected` : "Scan complete — no detections"}
                      </h3>

                      <p className="text-[13px] text-secondary-text leading-relaxed mb-4">
                        {fullFmt.format(new Date(record.createdAt))}
                      </p>

                      <Link
                        href={`/history/${record.id}`}
                        className="text-[11px] font-bold uppercase tracking-[1.5px] text-foreground border border-image-frame px-4 py-2 rounded-[40px] hover:border-mint transition-colors inline-block"
                      >
                        View Scan
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
