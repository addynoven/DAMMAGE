"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarChart3, FlaskConical, Users, Package,
  Upload, Flag, Download, Cpu, AlertCircle, User, CheckCircle2,
} from "lucide-react";
import { wasteColor } from "@/lib/colors";

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

const SIDEBAR_NAV = [
  { icon: BarChart3, label: "Activity", active: true },
  { icon: FlaskConical, label: "Models", active: false },
  { icon: Users, label: "Team", active: false },
  { icon: Package, label: "Archive", active: false },
];

export default function WastePage() {
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
        fetch(`${API}/detect/waste`, { method: "POST", body: mlFd, signal: controller.signal, credentials: "omit" }),
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
          type: "waste",
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
      ctx.font = "bold 10px monospace";
      filtered.forEach((d) => {
        const color = wasteColor(d.label);
        const x = d.box.x1 * sx, y = d.box.y1 * sy;
        const w = (d.box.x2 - d.box.x1) * sx, h = (d.box.y2 - d.box.y1) * sy;
        ctx.strokeStyle = color;
        ctx.strokeRect(x, y, w, h);
        const text = `${d.label.toUpperCase()} ${Math.round(d.confidence * 100)}%`;
        const tw = ctx.measureText(text).width + 8;
        ctx.fillStyle = color;
        ctx.fillRect(x, y - 16, tw, 16);
        ctx.fillStyle = d.label.toLowerCase().includes("garbage") ? "#fff" : "#000";
        ctx.fillText(text, x + 4, y - 4);
      });
    };
    if (img.complete) draw(); else img.onload = draw;
    const ro = new ResizeObserver(draw);
    ro.observe(img);
    return () => ro.disconnect();
  }, [result, threshold]);

  const scanId = file
    ? `WASTE SCAN ${Math.floor(Math.random() * 9000) + 1000}`
    : "WASTE SCAN ----";

  const counts = filteredDetections.reduce<Record<string, number>>((acc, d) => {
    acc[d.label] = (acc[d.label] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-screen pt-[72px] bg-canvas overflow-hidden">

      {/* Left sidebar */}
      <aside className="hidden md:flex w-[260px] shrink-0 flex-col py-6 bg-canvas border-r border-border">
        <div className="px-5 mb-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-mint-fg mb-1">Storystream</div>
          <div className="text-[10px] text-secondary-text uppercase tracking-[1.1px]">Live Detection Feed</div>
        </div>

        <nav className="flex flex-col gap-1 flex-grow px-3">
          {SIDEBAR_NAV.map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              className={`flex items-center gap-3 px-4 py-3 rounded-full text-[11px] font-bold uppercase tracking-[0.15em] transition-all ${
                active
                  ? "bg-mint text-black"
                  : "text-foreground/50 hover:text-mint-fg hover:bg-foreground/5"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* System status */}
        <div className="px-5 pt-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-7 h-7 rounded-full bg-ultraviolet/20 border border-ultraviolet/40 flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-foreground" />
            </div>
            <span className="text-[10px] text-secondary-text uppercase tracking-[1.1px]">System Status</span>
          </div>
          <div className="mb-3">
            <div className="flex justify-between text-[10px] text-secondary-text uppercase mb-1">
              <span>Edge Load</span>
              <span className="text-mint-fg">73%</span>
            </div>
            <div className="h-1 bg-image-frame rounded-full">
              <div className="h-1 bg-mint rounded-full w-[73%]" />
            </div>
          </div>
          <button className="w-full border border-ultraviolet text-ultraviolet text-[11px] font-bold uppercase tracking-[0.15em] px-4 py-2 rounded-[20px] hover:bg-ultraviolet hover:text-white transition-colors">
            Upgrade Node
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-5">
        <div className="h-full max-w-[1100px] mx-auto flex flex-col lg:flex-row gap-5">

          {/* Image viewer */}
          <div className="flex-1 bg-surface-slate rounded-[20px] border border-image-frame overflow-hidden flex flex-col">

            {/* Viewer header */}
            <div className="px-5 py-3.5 border-b border-image-frame flex justify-between items-center bg-surface-low">
              <h1 className="text-[20px] font-bold text-foreground uppercase tracking-tight">{scanId}</h1>
              <div className="flex items-center gap-3">
                {location && (
                  <span className="text-[10px] text-mint-fg font-mono bg-canvas px-3 py-1 rounded-[20px] border border-image-frame">
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </span>
                )}
                {imageUrl && !result && !loading && (
                  <button
                    onClick={onDetect}
                    className="bg-ultraviolet text-white text-[11px] font-bold uppercase tracking-[0.15em] px-4 py-2 rounded-[20px] hover:bg-foreground hover:text-canvas transition-colors"
                  >
                    Run Detection
                  </button>
                )}
                {loading && (
                  <div className="text-[11px] text-mint-fg uppercase tracking-[1.5px] flex items-center gap-2 animate-pulse">
                    <Cpu className="h-3.5 w-3.5" />
                    {warmingUp ? "Warming up…" : "Analysing…"}
                  </div>
                )}
              </div>
            </div>

            {/* Detection summary badge */}
            {result && (
              <div className="px-5 py-2.5 border-b border-image-frame bg-canvas flex items-center gap-2">
                {filteredDetections.length === 0 ? (
                  <span className="flex items-center gap-1.5 text-[12px] text-secondary-text uppercase tracking-[1.1px]">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    No waste detected
                  </span>
                ) : (
                  <span className="text-[12px] font-bold uppercase tracking-[1.1px] text-mint-fg">
                    {filteredDetections.length} detection{filteredDetections.length !== 1 ? "s" : ""} found
                    {" · "}
                    {Object.entries(counts)
                      .map(([label, count]) => `${count} × ${label}`)
                      .join(" · ")}
                  </span>
                )}
              </div>
            )}

            {/* Image area */}
            <div className="flex-1 relative bg-canvas flex items-center justify-center p-4">
              {imageUrl ? (
                <div className="relative w-full max-w-3xl border border-ultraviolet/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={imageUrl}
                    alt="Waste scan"
                    className="block w-full h-auto opacity-90"
                  />
                  <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
                  <div className="absolute inset-0 border border-ultraviolet/30 pointer-events-none" />
                </div>
              ) : (
                <label className="flex flex-col items-center gap-5 cursor-pointer p-12 text-center border-2 border-dashed border-image-frame rounded-[20px] hover:border-ultraviolet/50 transition-colors group">
                  <div className="w-16 h-16 rounded-full bg-ultraviolet/10 border border-ultraviolet/30 flex items-center justify-center group-hover:bg-ultraviolet/20 transition-colors">
                    <Upload className="h-7 w-7 text-ultraviolet" />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-foreground uppercase tracking-[1.5px] mb-1">
                      Upload waste scan image
                    </div>
                    <div className="text-[11px] text-secondary-text mb-4">JPG, PNG, WEBP · Max 10 MB</div>
                    <span className="bg-ultraviolet text-white text-[11px] font-bold uppercase tracking-[0.15em] px-5 py-2.5 rounded-[20px] group-hover:bg-foreground transition-colors">
                      Choose File
                    </span>
                  </div>
                  <input type="file" accept="image/*" className="sr-only" onChange={onPick} />
                </label>
              )}
            </div>

            {/* Bottom toolbar */}
            <div className="px-5 py-3 bg-surface-lowest border-t border-ultraviolet/20 flex justify-between items-center">
              <div className="flex gap-3">
                {imageUrl && !result && !loading && (
                  <button
                    onClick={onDetect}
                    className="bg-ultraviolet text-white text-[11px] font-bold uppercase tracking-[0.15em] px-4 py-2 rounded-[20px] hover:bg-foreground hover:text-canvas transition-colors"
                  >
                    Run Detection
                  </button>
                )}
                {loading && (
                  <div className="text-[11px] text-mint-fg uppercase tracking-[1.5px] flex items-center gap-2 animate-pulse">
                    <Cpu className="h-3.5 w-3.5" />
                    {warmingUp ? "Warming up models…" : "Analysing image…"}
                  </div>
                )}
                {result && (
                  <>
                    <button className="bg-ultraviolet text-white text-[11px] font-bold uppercase tracking-[0.15em] px-4 py-2 rounded-[20px] hover:bg-foreground hover:text-canvas transition-colors flex items-center gap-2">
                      <Flag className="h-3.5 w-3.5" />
                      Flag Issues
                    </button>
                    <label className="border border-image-frame text-secondary-text text-[11px] font-bold uppercase tracking-[0.15em] px-4 py-2 rounded-[20px] hover:border-mint hover:text-mint-fg transition-colors cursor-pointer flex items-center gap-2">
                      <Upload className="h-3.5 w-3.5" />
                      New Scan
                      <input type="file" accept="image/*" className="sr-only" onChange={onPick} />
                    </label>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-ultraviolet uppercase tracking-[1.1px]">
                <Cpu className="h-3 w-3" />
                Confidence threshold &gt; 50%
                {saved === "saved" && <span className="text-mint-fg">Saved</span>}
                {saved === "error" && <span className="text-destructive">Save failed</span>}
              </div>
            </div>
          </div>

          {/* Right inventory panel */}
          <div className="w-full lg:w-72 flex flex-col gap-4">
            {/* Location card */}
            <div className="bg-surface-high rounded-[20px] p-5 border border-image-frame">
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

            <div className="bg-surface-high rounded-[20px] p-5 border border-image-frame flex-1 flex flex-col">
              <div className="flex items-center justify-between border-b border-image-frame pb-4 mb-4">
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-ultraviolet">
                  Waste Inventory
                </span>
                {result && (
                  <span className="text-[10px] font-bold uppercase tracking-[1.1px] bg-surface-slate px-2 py-0.5 rounded border border-ultraviolet/50 text-foreground">
                    {filteredDetections.length} Detected
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

              {error && (
                <div className="flex items-center gap-2 text-destructive text-[11px] mb-4">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex-1 flex flex-col gap-2 overflow-auto">
                {!result && !loading && (
                  <p className="text-[11px] text-secondary-text uppercase tracking-[1.1px]">
                    No scan loaded
                  </p>
                )}
                {loading && [1, 2, 3].map((n) => (
                  <div key={n} className="h-12 bg-canvas rounded-[20px] border border-image-frame animate-pulse" />
                ))}
                {result && Object.entries(counts).map(([label, count]) => (
                  <div
                    key={label}
                    className="bg-canvas border border-image-frame rounded-[20px] px-4 py-3 flex justify-between items-center hover:border-opacity-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: wasteColor(label) }}
                      />
                      <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-foreground">
                        {label}
                      </span>
                    </div>
                    <span className="text-[10px] text-secondary-text uppercase tracking-[1.1px]">
                      {count} Count
                    </span>
                  </div>
                ))}
                {result && filteredDetections.length === 0 && (
                  <p className="text-[11px] text-secondary-text uppercase tracking-[1.1px]">
                    No waste detected
                  </p>
                )}
              </div>

              {result && (
                <div className="mt-4 pt-4 border-t border-image-frame">
                  <button className="w-full bg-ultraviolet text-white text-[11px] font-bold uppercase tracking-[0.15em] px-4 py-3 rounded-[20px] hover:bg-foreground hover:text-canvas transition-colors flex items-center justify-center gap-2">
                    <Download className="h-3.5 w-3.5" />
                    Export Log
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
