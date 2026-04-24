"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Flag, AlertCircle, CheckCircle2 } from "lucide-react";
import { labelColor } from "@/lib/colors";

const API = process.env.NEXT_PUBLIC_ML_API ?? "http://127.0.0.1:8000";

interface Detection {
  label: string;
  confidence: number;
  box: { x1: number; y1: number; x2: number; y2: number };
}
interface DetectionResult {
  width: number;
  height: number;
  detections: Detection[];
}

export default function RoadsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.5);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saved" | "error">("idle");

  const filteredDetections = result?.detections.filter((d) => d.confidence >= threshold) ?? [];

  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleGetLocation = () => {
    if (!navigator.geolocation) return;
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocLoading(false); },
      () => setLocLoading(false)
    );
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED.includes(f.type)) {
      setError("Only JPG, PNG, and WEBP images are supported.");
      e.target.value = "";
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("Image must be under 10 MB.");
      e.target.value = "";
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(f));
  };

  const onDetect = async () => {
    if (!file) return;
    setLoading(true);
    setWarmingUp(true);
    setError(null);
    setResult(null);
    const warmTimer = setTimeout(() => setWarmingUp(false), 3000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    try {
      const mlFd = new FormData();
      mlFd.append("file", file);
      const uploadFd = new FormData();
      uploadFd.append("file", file);

      const [mlRes, uploadRes] = await Promise.all([
        fetch(`${API}/detect/road`, { method: "POST", body: mlFd, signal: controller.signal }),
        fetch("/api/upload", { method: "POST", body: uploadFd, signal: controller.signal }),
      ]);

      if (!mlRes.ok) throw new Error(`${mlRes.status} ${mlRes.statusText}`);
      const data: DetectionResult = await mlRes.json();
      setResult(data);

      const storedImageUrl = uploadRes.ok ? ((await uploadRes.json()) as { url: string }).url : null;

      fetch("/api/detections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "road",
          imageUrl: storedImageUrl,
          width: data.width,
          height: data.height,
          detections: data.detections,
          location,
        }),
      })
        .then(() => { setSaved("saved"); setTimeout(() => setSaved("idle"), 3000); })
        .catch(() => { setSaved("error"); setTimeout(() => setSaved("idle"), 3000); });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Request timed out. Please try again.");
      } else {
        setError(err instanceof Error ? err.message : "Detection failed");
      }
    } finally {
      clearTimeout(timeoutId);
      clearTimeout(warmTimer);
      setWarmingUp(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!result || !imgRef.current || !canvasRef.current) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const filtered = result.detections.filter((d) => d.confidence >= threshold);
    const draw = () => {
      canvas.width = img.clientWidth;
      canvas.height = img.clientHeight;
      const sx = img.clientWidth / result.width;
      const sy = img.clientHeight / result.height;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.font = "bold 11px monospace";
      filtered.forEach((d) => {
        const color = labelColor(d.label);
        const x = d.box.x1 * sx, y = d.box.y1 * sy;
        const w = (d.box.x2 - d.box.x1) * sx, h = (d.box.y2 - d.box.y1) * sy;
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
    if (img.complete) draw(); else img.onload = draw;
    const ro = new ResizeObserver(draw);
    ro.observe(img);
    return () => ro.disconnect();
  }, [result, threshold]);

  const scanId = file
    ? `SCAN_${file.name.replace(/\.[^.]+$/, "").toUpperCase().slice(0, 12)}`
    : "SCAN_READY";

  return (
    <main className="pt-[72px] min-h-screen bg-canvas">
      <div className="max-w-[1300px] mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <h1 className="font-display text-[48px] md:text-[64px] font-black text-foreground uppercase leading-none tracking-tight">
              {scanId}
            </h1>
            {file && (
              <div className="text-[11px] text-secondary-text uppercase tracking-[1.5px] mt-1">
                Captured: {new Date().toISOString().replace("T", " ").slice(0, 19)}
              </div>
            )}
          </div>
          {file && !result && !loading && (
            <button
              onClick={onDetect}
              className="bg-mint text-black text-[11px] font-bold uppercase tracking-[0.15em] px-6 py-2.5 rounded-[24px] hover:bg-foreground hover:text-canvas transition-colors"
            >
              Run Detection
            </button>
          )}
          {loading && (
            <div className="text-[11px] text-mint-fg uppercase tracking-[1.5px] animate-pulse">
              {warmingUp ? "Warming up models…" : "Analysing image…"}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/50 text-destructive text-[13px] px-4 py-3 rounded-[12px] mb-6">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

          {/* Image / Upload area */}
          <div className="flex flex-col gap-4">
            {result && (
              <div className="flex items-center gap-2">
                {filteredDetections.length === 0 ? (
                  <span className="flex items-center gap-1.5 text-[12px] text-secondary-text uppercase tracking-[1.1px]">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    No damage detected
                  </span>
                ) : (
                  <span className="text-[12px] font-bold uppercase tracking-[1.1px] text-mint-fg">
                    {filteredDetections.length} detection{filteredDetections.length !== 1 ? "s" : ""} found
                    {" · "}
                    {Object.entries(
                      filteredDetections.reduce<Record<string, number>>((acc, d) => {
                        acc[d.label] = (acc[d.label] || 0) + 1;
                        return acc;
                      }, {})
                    )
                      .map(([label, count]) => `${count} × ${label}`)
                      .join(" · ")}
                  </span>
                )}
              </div>
            )}
            <div className="relative bg-surface-slate rounded-[20px] border border-image-frame overflow-hidden min-h-[400px] flex items-center justify-center">
              {imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={imageUrl}
                    alt="Road scan"
                    className="block w-full h-auto"
                  />
                  <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
                </>
              ) : (
                <label className="flex flex-col items-center gap-4 cursor-pointer p-12 text-center">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-image-frame flex items-center justify-center">
                    <Upload className="h-6 w-6 text-secondary-text" />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-foreground uppercase tracking-[1.5px] mb-1">
                      Upload a road scan
                    </div>
                    <div className="text-[11px] text-secondary-text">
                      JPG, PNG, WEBP supported
                    </div>
                  </div>
                  <input type="file" accept="image/*" className="sr-only" onChange={onPick} />
                </label>
              )}
            </div>

            {/* Bottom actions */}
            <div className="flex gap-3">
              <label className="bg-mint text-black text-[11px] font-bold uppercase tracking-[0.15em] px-5 py-2.5 rounded-[24px] hover:bg-foreground hover:text-canvas transition-colors cursor-pointer flex items-center gap-2">
                <Upload className="h-3.5 w-3.5" />
                Upload New Scan
                <input type="file" accept="image/*" className="sr-only" onChange={onPick} />
              </label>
              <button
                disabled={!result}
                className="border border-image-frame text-secondary-text text-[11px] font-bold uppercase tracking-[0.15em] px-5 py-2.5 rounded-[24px] hover:border-mint hover:text-mint-fg transition-colors disabled:opacity-30 flex items-center gap-2"
              >
                <Flag className="h-3.5 w-3.5" />
                Flag for Review
              </button>
              {saved === "saved" && <span className="text-[10px] text-mint-fg uppercase tracking-[1.1px]">Saved</span>}
              {saved === "error" && <span className="text-[10px] text-destructive uppercase tracking-[1.1px]">Save failed</span>}
            </div>
          </div>

          {/* Right panel */}
          <div className="flex flex-col gap-4">

            {/* Detections */}
            <div className="bg-surface-slate rounded-[20px] p-5 border border-image-frame">
              <div className="flex items-center justify-between border-b border-image-frame pb-4 mb-4">
                <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-foreground">Detections</span>
                {result && (
                  <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-mint-fg border border-console-mint px-2 py-0.5 rounded-sm">
                    {filteredDetections.length} Found
                  </span>
                )}
              </div>

              {result && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-secondary-text uppercase tracking-[1.1px]">Min. confidence</span>
                    <span className="text-[10px] font-bold text-mint-fg">{Math.round(threshold * 100)}%</span>
                  </div>
                  <input
                    type="range" min={0} max={100} step={1}
                    value={Math.round(threshold * 100)}
                    onChange={(e) => setThreshold(Number(e.target.value) / 100)}
                    className="w-full mb-4 accent-[#3CFFD0]"
                  />
                </>
              )}

              {!result && !loading && (
                <p className="text-[12px] text-secondary-text uppercase tracking-[1.1px]">
                  No scan loaded
                </p>
              )}
              {loading && (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-14 bg-canvas rounded-[12px] border border-image-frame animate-pulse" />
                  ))}
                </div>
              )}
              {result && filteredDetections.length === 0 && (
                <p className="text-[12px] text-secondary-text uppercase tracking-[1.1px]">
                  No damage detected
                </p>
              )}
              {result && filteredDetections.map((d, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between py-3 border-b border-image-frame last:border-0"
                >
                  <div>
                    <div
                      className="text-[11px] font-bold uppercase tracking-[1.5px] mb-1"
                      style={{ color: labelColor(d.label) }}
                    >
                      {d.label}
                    </div>
                    <div className="text-[10px] text-secondary-text uppercase tracking-[1.1px]">
                      Conf: {d.confidence.toFixed(2)}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-secondary-text border border-image-frame px-2 py-0.5 rounded-sm">
                    {Math.round(d.confidence * 100)}%
                  </span>
                </div>
              ))}
            </div>

            {/* Scan metadata */}
            <div className="bg-surface-slate rounded-[20px] p-5 border border-image-frame">
              <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text mb-4">
                Scan Metadata
              </div>
              <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text mb-4">Location</div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locLoading}
                  className="w-full text-[11px] font-bold uppercase tracking-[0.12em] border border-image-frame px-4 py-2.5 rounded-[12px] hover:border-mint hover:text-mint-fg transition-colors disabled:opacity-50"
                >
                  {locLoading ? "Getting location…" : location ? "Update Location" : "Use My Location"}
                </button>
                {location && (
                  <div className="text-[11px] text-mint-fg font-mono">
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </div>
                )}
                {!location && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number" step="any" placeholder="Latitude"
                      className="bg-canvas border border-image-frame rounded-[8px] px-3 py-2 text-[12px] text-foreground placeholder:text-secondary-text focus:outline-none focus:border-mint"
                      onChange={(e) => setLocation(prev => ({ lat: parseFloat(e.target.value) || 0, lng: prev?.lng ?? 0 }))}
                    />
                    <input
                      type="number" step="any" placeholder="Longitude"
                      className="bg-canvas border border-image-frame rounded-[8px] px-3 py-2 text-[12px] text-foreground placeholder:text-secondary-text focus:outline-none focus:border-mint"
                      onChange={(e) => setLocation(prev => ({ lat: prev?.lat ?? 0, lng: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}
