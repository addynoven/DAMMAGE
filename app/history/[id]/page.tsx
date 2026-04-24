"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { labelColor, wasteColor } from "@/lib/colors";

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
  location?: { lat: number; lng: number } | null;
}

const fmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
});

function formatDate(iso: string): string {
  return fmt.format(new Date(iso));
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

export default function DetectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<DetectionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzed, setReanalyzed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/detections/" + id, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Not found" : `Error ${res.status}`);
        return res.json() as Promise<DetectionRecord>;
      })
      .then(setRecord)
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load detection");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
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

  async function handleReanalyze() {
    if (!record?.imageUrl) return;
    setReanalyzing(true);
    try {
      const imgRes = await fetch(record.imageUrl);
      const blob = await imgRes.blob();
      const fd = new FormData();
      fd.append("file", blob, "image.jpg");
      const endpoint = record.type === "road" ? "/detect/road" : "/detect/waste";
      const mlRes = await fetch(`http://127.0.0.1:8000${endpoint}`, { method: "POST", body: fd });
      if (!mlRes.ok) throw new Error("ML failed");
      const data = await mlRes.json() as { width: number; height: number; detections: Detection[] };
      await fetch("/api/detections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: record.type, imageUrl: record.imageUrl, width: data.width, height: data.height, detections: data.detections }),
      });
      setReanalyzed(true);
    } catch (err) {
      console.error(err);
    } finally {
      setReanalyzing(false);
    }
  }

  async function handleExportPdf() {
    if (!record) return;
    setExporting(true);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 14;
      let y = margin;

      // Title
      pdf.setFontSize(22);
      pdf.setFont("helvetica", "bold");
      pdf.text("DAMMAGE — Detection Report", margin, y);
      y += 10;

      // Subtitle
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100);
      pdf.text(`Type: ${record.type.toUpperCase()} | Date: ${formatDate(record.createdAt)} | ID: ${record.id}`, margin, y);
      y += 8;

      // Image with bounding boxes (capture canvas overlay)
      if (containerRef.current) {
        const canvas = await html2canvas(containerRef.current, { useCORS: true, scale: 1 });
        const imgData = canvas.toDataURL("image/jpeg", 0.85);
        const imgW = pageW - margin * 2;
        const imgH = (canvas.height / canvas.width) * imgW;
        const cappedH = Math.min(imgH, pageH * 0.45);
        pdf.addImage(imgData, "JPEG", margin, y, imgW, cappedH);
        y += cappedH + 8;
      }

      // Detection table header
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(0);
      pdf.text("Detections", margin, y);
      y += 6;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setFillColor(230, 230, 230);
      pdf.rect(margin, y, pageW - margin * 2, 7, "F");
      pdf.text("Label", margin + 2, y + 5);
      pdf.text("Confidence", margin + 70, y + 5);
      pdf.text("Box (x1,y1 → x2,y2)", margin + 110, y + 5);
      y += 7;

      pdf.setFont("helvetica", "normal");
      record.detections.forEach((d, i) => {
        if (y > pageH - margin) { pdf.addPage(); y = margin; }
        if (i % 2 === 0) { pdf.setFillColor(245, 245, 245); pdf.rect(margin, y, pageW - margin * 2, 7, "F"); }
        pdf.setTextColor(0);
        pdf.text(d.label, margin + 2, y + 5);
        pdf.text(`${Math.round(d.confidence * 100)}%`, margin + 70, y + 5);
        pdf.text(`${d.box.x1.toFixed(0)},${d.box.y1.toFixed(0)} → ${d.box.x2.toFixed(0)},${d.box.y2.toFixed(0)}`, margin + 110, y + 5);
        y += 7;
      });

      if (record.detections.length === 0) {
        pdf.setTextColor(150);
        pdf.text("No detections", margin + 2, y + 5);
        y += 7;
      }

      y += 6;
      pdf.setFontSize(9);
      pdf.setTextColor(150);
      pdf.text(`Generated by DAMMAGE · ${new Date().toISOString()}`, margin, y);

      pdf.save(`dammage-${record.type}-${record.id.slice(-6)}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <SkeletonPage />;

  if (error || !record) {
    return (
      <main className="pt-[72px] min-h-screen bg-canvas">
        <div className="max-w-[1300px] mx-auto px-6 py-8">
          <Link
            href="/history"
            className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text hover:text-mint-fg transition-colors"
          >
            ← Back to History
          </Link>
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="text-[16px] font-bold text-foreground mb-2">
              {error ?? "Detection not found"}
            </div>
            <Link
              href="/history"
              className="mt-6 text-[11px] font-bold uppercase tracking-[1.5px] text-black bg-mint px-5 py-2.5 rounded-[24px] hover:bg-foreground hover:text-canvas transition-colors"
            >
              Back to History
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isRoad = record.type === "road";

  return (
    <main className="pt-[72px] min-h-screen bg-canvas">
      <div className="max-w-[1300px] mx-auto px-6 py-8">

        {/* Header row */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <Link
            href="/history"
            className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text hover:text-mint-fg transition-colors mr-auto"
          >
            ← Back to History
          </Link>
          <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-mint-fg">
            {isRoad ? "Road Scan" : "Waste Scan"}
          </span>
          <span className="text-[11px] text-secondary-text uppercase tracking-[1.1px]">
            {formatDate(record.createdAt)}
          </span>
          <button
            onClick={() => {
              const url = window.location.origin + "/report/" + record.id;
              navigator.clipboard.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="text-[11px] font-bold uppercase tracking-[1.5px] border border-image-frame px-3 py-1.5 rounded-[24px] hover:border-mint hover:text-mint-fg transition-colors"
          >
            {copied ? "Copied!" : "Share"}
          </button>
          {record.imageUrl && (
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="text-[11px] font-bold uppercase tracking-[1.5px] border border-image-frame px-3 py-1.5 rounded-[24px] hover:border-mint hover:text-mint-fg transition-colors disabled:opacity-50"
            >
              {reanalyzing ? "Re-analyzing…" : reanalyzed ? "Saved!" : "Re-analyze"}
            </button>
          )}
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="text-[11px] font-bold uppercase tracking-[1.5px] border border-image-frame px-3 py-1.5 rounded-[24px] hover:border-mint hover:text-mint-fg transition-colors disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

          {/* Image viewer */}
          <div className="bg-surface-slate rounded-[20px] border border-image-frame overflow-hidden flex items-center justify-center min-h-[400px]">
            {record.imageUrl ? (
              <div ref={containerRef} className="relative w-full">
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
                <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-mint-fg border border-mint px-2 py-0.5 rounded-sm">
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
                  { label: "Location", value: record.location ? `${record.location.lat.toFixed(4)}, ${record.location.lng.toFixed(4)}` : "—" },
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
      </div>
    </main>
  );
}
