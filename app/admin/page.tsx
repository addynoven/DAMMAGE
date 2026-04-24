"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

interface Detection {
  label: string;
  confidence: number;
  box: { x1: number; y1: number; x2: number; y2: number };
}

interface AdminDetectionRecord {
  id: string;
  userId: string;
  userEmail: string;
  type: "road" | "waste";
  imageUrl: string | null;
  width: number;
  height: number;
  detections: Detection[];
  createdAt: string;
}

interface AdminDetectionsResponse {
  detections: AdminDetectionRecord[];
  total: number;
}

const fmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(iso: string): string {
  return fmt.format(new Date(iso));
}

function TypeBadge({ type }: { type: "road" | "waste" }) {
  const isRoad = type === "road";
  return (
    <span
      className={`inline-block border text-[10px] font-bold uppercase tracking-[1.5px] px-2 py-0.5 rounded-sm ${
        isRoad
          ? "text-mint-fg border-mint"
          : "text-amber-400 border-amber-400/50"
      }`}
    >
      {isRoad ? "Road" : "Waste"}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[1fr_80px_80px_160px_64px] gap-4 items-center px-6 py-4 border-b border-image-frame animate-pulse">
      <div className="h-4 w-48 bg-image-frame rounded-sm" />
      <div className="h-5 w-14 bg-image-frame rounded-sm" />
      <div className="h-4 w-8 bg-image-frame rounded-sm" />
      <div className="h-4 w-36 bg-image-frame rounded-sm" />
      <div className="h-7 w-12 bg-image-frame rounded-sm" />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-surface-slate border border-image-frame rounded-[20px] px-6 py-5">
      <div className="text-[11px] font-bold uppercase tracking-[1.5px] text-secondary-text mb-1">
        {label}
      </div>
      <div className="text-[32px] font-black text-foreground leading-none">
        {value}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [records, setRecords] = useState<AdminDetectionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    fetch("/api/admin/detections?limit=50")
      .then((res) => {
        if (res.status === 403) {
          setDenied(true);
          return null;
        }
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json() as Promise<AdminDetectionsResponse>;
      })
      .then((data) => {
        if (!data) return;
        setRecords(data.detections);
        setTotal(data.total);
      })
      .catch(() => {
        setRecords([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const roadCount = records.filter((r) => r.type === "road").length;
  const wasteCount = records.filter((r) => r.type === "waste").length;
  const uniqueUsers = new Set(records.map((r) => r.userId)).size;

  if (!loading && denied) {
    return (
      <main className="pt-[72px] min-h-screen bg-canvas flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <ShieldAlert className="h-14 w-14 text-secondary-text opacity-40" />
          <h1 className="text-[28px] font-black text-foreground uppercase tracking-tight">
            Access Denied
          </h1>
          <p className="text-[14px] text-secondary-text max-w-xs leading-relaxed">
            This page is restricted to administrators only.
          </p>
          <Link
            href="/"
            className="text-[11px] font-bold uppercase tracking-[1.5px] text-black bg-mint px-5 py-2.5 rounded-[24px] hover:bg-foreground hover:text-canvas transition-colors mt-2"
          >
            Go Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-[72px] min-h-screen bg-canvas">
      <div className="max-w-[1300px] mx-auto px-6 py-8">
        <h1 className="font-display text-[48px] font-black text-foreground uppercase leading-none tracking-tight mb-8">
          ADMIN
        </h1>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Total detections" value={loading ? "—" : total} />
          <StatCard label="Road scans" value={loading ? "—" : roadCount} />
          <StatCard label="Waste scans" value={loading ? "—" : wasteCount} />
          <StatCard label="Unique users" value={loading ? "—" : uniqueUsers} />
        </div>

        {/* Table */}
        <div className="bg-surface-slate border border-image-frame rounded-[20px] overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px_160px_64px] gap-4 items-center px-6 py-3 border-b border-image-frame">
            <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-secondary-text">
              User
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-secondary-text">
              Type
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-secondary-text">
              Finds
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-secondary-text">
              Date
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-secondary-text" />
          </div>

          {loading && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}

          {!loading && records.length === 0 && !denied && (
            <div className="py-20 text-center text-secondary-text text-[14px]">
              No detections found.
            </div>
          )}

          {!loading &&
            records.map((record, idx) => (
              <div
                key={record.id}
                className={`grid grid-cols-[1fr_80px_80px_160px_64px] gap-4 items-center px-6 py-4 hover:bg-surface-bright transition-colors ${
                  idx !== records.length - 1 ? "border-b border-image-frame" : ""
                }`}
              >
                {/* Email */}
                <span
                  className="text-[13px] text-foreground font-medium truncate max-w-[260px]"
                  title={record.userEmail}
                >
                  {record.userEmail}
                </span>

                {/* Type badge */}
                <TypeBadge type={record.type} />

                {/* Detection count */}
                <span className="text-[13px] text-secondary-text">
                  {record.detections.length}
                </span>

                {/* Date */}
                <span className="text-[12px] text-secondary-text whitespace-nowrap">
                  {formatDate(record.createdAt)}
                </span>

                {/* View link */}
                <Link
                  href={`/history/${record.id}`}
                  className="text-[10px] font-bold uppercase tracking-[1.5px] text-mint-fg hover:text-foreground transition-colors border border-mint/30 rounded-[24px] px-3 py-1 text-center"
                >
                  View
                </Link>
              </div>
            ))}
        </div>

        {!loading && total > records.length && (
          <p className="text-[12px] text-secondary-text mt-4 text-center">
            Showing {records.length} of {total} total detections
          </p>
        )}
      </div>
    </main>
  );
}
