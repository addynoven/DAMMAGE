"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Detection {
  label: string;
  confidence: number;
  box: { x1: number; y1: number; x2: number; y2: number };
}

interface DetectionRecord {
  id: string;
  type: "road" | "waste";
  imageUrl: string | null;
  width: number;
  height: number;
  detections: Detection[];
  createdAt: string;
}

const fmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
});

function formatDate(iso: string): string {
  return fmt.format(new Date(iso));
}

function labelColor(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("pothole")) return "#f59e0b";
  if (l.includes("crack")) return "#3CFFD0";
  if (l.includes("wear") || l.includes("surface")) return "#a855f7";
  return "#ef4444";
}

const WASTE_COLORS: Record<string, string> = {
  garbage: "#FF0000",
  pile: "#FF0000",
  cardboard: "#FF8C00",
  bottle: "#FF8C00",
  plastic: "#FF8C00",
  metal: "#22c55e",
  organic: "#84cc16",
};

function wasteColor(label: string): string {
  const l = label.toLowerCase();
  for (const [key, color] of Object.entries(WASTE_COLORS)) {
    if (l.includes(key)) return color;
  }
  return "#f59e0b";
}

function detectionColor(type: "road" | "waste", label: string): string {
  return type === "road" ? labelColor(label) : wasteColor(label);
}

function SkeletonPage() {
  return (
    <main className="pt-[72px] min-h-screen bg-canvas">
      <div className="max-w-[1300px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8 animate-pulse">
          <div className="h-4 w-36 bg-surface-slate rounded-sm" />
          <div className="h-4 w-24 bg-surface-slate rounded-sm" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div className="bg-surface-slate rounded-[20px] border border-image-frame min-h-[480px] animate-pulse" />
          <div className="flex flex-col gap-4">
            <div className="bg-surface-slate rounded-[20px] border border-image-frame h-64 animate-pulse" />
            <div className="bg-surface-slate rounded-[20px] border border-image-frame h-48 animate-pulse" />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function PublicReportPage() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<DetectionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch("/api/report/" + id)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Not found" : `Error ${res.status}`);
        return res.json() as Promise<DetectionRecord>;
      })
      .then(setRecord)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load report");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!record?.imageUrl || !imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const draw = () => {
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
      const sx = img.clientWidth / record.width;
      const sy = img.clientHeight / record.height;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.font = "bold 11px monospace";
      record.detections.forEach((d) => {
        const color = detectionColor(record.type, d.label);
        const x = d.box.x1 * sx;
        const y = d.box.y1 * sy;
        const w = (d.box.x2 - d.box.x1) * sx;
        const h = (d.box.y2 - d.box.y1) * sy;
        ctx.strokeStyle = color;
        ctx.strokeRect(x, y, w, h);
        const text = `${d.label.toUpperCase()} ${Math.round(d.confidence * 100)}%`;
        const tw = ctx.measureText(text).width + 8;
        ctx.fillStyle = color;
        ctx.fillRect(x, y - 18, tw, 18);
        ctx.fillStyle = "#000";
        ctx.fillText(text, x + 4, y - 5);
      });
    };
    if (img.complete) draw();
    else img.onload = draw;
    const ro = new ResizeObserver(draw);
    ro.observe(img);
    return () => ro.disconnect();
  }, [record]);

  if (loading) return <SkeletonPage />;

  if (error || !record) {
    return (
      <main className="pt-[72px] min-h-screen bg-canvas flex flex-col items-center justify-center">
        <div className="text-[22px] font-black uppercase tracking-[3px] text-foreground mb-2">
          DAMMAGE
        </div>
        <div className="text-[10px] text-secondary-text uppercase tracking-[2px] mb-12">
          AI Urban Inspection
        </div>
        <div className="text-[16px] font-bold text-foreground mb-2">
          {error ?? "Report not found"}
        </div>
        <Link
          href="/"
          className="mt-6 text-[11px] font-bold uppercase tracking-[1.5px] text-black bg-[#3CFFD0] px-5 py-2.5 rounded-[24px] hover:bg-foreground hover:text-canvas transition-colors"
        >
          Go to Homepage
        </Link>
      </main>
    );
  }

  const isRoad = record.type === "road";

  return (
    <main className="pt-[72px] min-h-screen bg-canvas">
      <div className="max-w-[1300px] mx-auto px-6 py-8">

        {/* DAMMAGE branding header */}
        <div className="flex flex-col items-center mb-10">
          <div className="text-[22px] font-black uppercase tracking-[3px] text-foreground">
            DAMMAGE
          </div>
          <div className="text-[10px] text-secondary-text uppercase tracking-[2px] mt-0.5">
            AI Urban Inspection Report
          </div>
        </div>

        {/* Scan info row */}
        <div className="flex flex-wrap items-center justify-end gap-4 mb-8">
          <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-mint-fg mr-auto">
            {isRoad ? "Road Scan" : "Waste Scan"}
          </span>
          <span className="text-[11px] text-secondary-text uppercase tracking-[1.1px]">
            {formatDate(record.createdAt)}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

          {/* Image viewer */}
          <div className="bg-surface-slate rounded-[20px] border border-image-frame overflow-hidden flex items-center justify-center min-h-[400px]">
            {record.imageUrl ? (
              <div className="relative w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={record.imageUrl}
                  alt={isRoad ? "Road scan" : "Waste scan"}
                  className="block w-full h-auto"
                />
                <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 p-12 text-center">
                <div className="text-[13px] font-bold text-secondary-text uppercase tracking-[1.5px]">
                  Image not available
                </div>
                <div className="text-[11px] text-secondary-text/50">
                  The original image was not stored with this detection
                </div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="flex flex-col gap-4">

            {/* Detections card */}
            <div className="bg-surface-slate rounded-[20px] p-5 border border-image-frame">
              <div className="flex items-center justify-between border-b border-image-frame pb-4 mb-4">
                <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-foreground">
                  Detections
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-mint-fg border border-[#3CFFD0] px-2 py-0.5 rounded-sm">
                  {record.detections.length} Found
                </span>
              </div>

              {record.detections.length === 0 ? (
                <p className="text-[12px] text-secondary-text uppercase tracking-[1.1px]">
                  No detections
                </p>
              ) : (
                <div className="flex flex-col">
                  {record.detections.map((d, i) => (
                    <div
                      key={i}
                      className="py-3 border-b border-image-frame last:border-0"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="text-[11px] font-bold uppercase tracking-[1.5px]"
                          style={{ color: detectionColor(record.type, d.label) }}
                        >
                          {d.label}
                        </span>
                        <span className="text-[10px] font-bold text-secondary-text border border-image-frame px-2 py-0.5 rounded-sm">
                          {Math.round(d.confidence * 100)}%
                        </span>
                      </div>
                      <div className="text-[10px] text-secondary-text uppercase tracking-[1.1px]">
                        {d.box.x1.toFixed(0)},{d.box.y1.toFixed(0)} → {d.box.x2.toFixed(0)},{d.box.y2.toFixed(0)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scan metadata card */}
            <div className="bg-surface-slate rounded-[20px] p-5 border border-image-frame">
              <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text mb-4">
                Scan Metadata
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { label: "Type", value: record.type },
                  { label: "Date", value: formatDate(record.createdAt) },
                  { label: "Dimensions", value: `${record.width} × ${record.height}` },
                  { label: "Detections", value: String(record.detections.length) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-baseline gap-4">
                    <span className="text-[10px] text-secondary-text uppercase tracking-[1.1px] shrink-0">
                      {label}
                    </span>
                    <span className="text-[13px] font-medium text-foreground text-right">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-12 flex flex-col items-center gap-3 border-t border-image-frame pt-10">
          <p className="text-[11px] text-secondary-text uppercase tracking-[1.5px]">
            Powered by DAMMAGE
          </p>
          <Link
            href="/"
            className="text-[11px] font-bold uppercase tracking-[1.5px] text-black bg-[#3CFFD0] px-5 py-2.5 rounded-[24px] hover:bg-foreground hover:text-canvas transition-colors"
          >
            Try it yourself
          </Link>
        </div>

      </div>
    </main>
  );
}
