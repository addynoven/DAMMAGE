"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, LogIn, Menu, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSession, signOut } from "next-auth/react";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/roads", label: "Roads" },
  { href: "/waste", label: "Waste" },
  { href: "/history", label: "History" },
  { href: "/admin", label: "Admin" },
];

const AUTH_PATHS = ["/login", "/register"];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (AUTH_PATHS.includes(pathname)) return null;

  return (
    <>
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-[72px] bg-canvas border-b border-border">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="font-display text-3xl font-black italic tracking-tighter text-mint-fg"
          >
            DAMMAGE
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`font-sans text-[11px] font-bold uppercase tracking-[0.15em] transition-colors pb-1 ${
                    active
                      ? "text-mint-fg border-b border-mint"
                      : "text-foreground/50 hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="md:hidden text-foreground/50 hover:text-foreground p-2 rounded-full hover:bg-foreground/5 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link
            href="/roads"
            className="bg-mint text-black font-sans text-[11px] font-bold uppercase tracking-[0.15em] px-5 py-2 rounded-[24px] hover:bg-foreground hover:text-canvas transition-colors"
          >
            New Inspection
          </Link>
          <ThemeToggle />

          {session?.user ? (
            <div className="flex items-center gap-2 ml-1 pl-3 border-l border-image-frame">
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name ?? "User"}
                  width={30}
                  height={30}
                  className="rounded-full"
                />
              ) : (
                <div className="w-[30px] h-[30px] rounded-full bg-mint flex items-center justify-center text-black text-[11px] font-bold uppercase">
                  {session.user.name?.[0] ?? session.user.email?.[0] ?? "U"}
                </div>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-foreground/50 hover:text-foreground p-2 rounded-full hover:bg-foreground/5 transition-colors"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="flex items-center gap-1.5 ml-1 pl-3 border-l border-image-frame text-foreground/50 hover:text-foreground text-[11px] font-bold uppercase tracking-[0.12em] transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </button>
          )}
        </div>
      </nav>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-[72px] bg-canvas z-40 flex flex-col p-6 gap-2 border-t border-border">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center px-4 py-3 rounded-full text-[13px] font-bold uppercase tracking-[0.15em] transition-colors ${
                  active
                    ? "bg-mint text-black"
                    : "text-foreground/50 hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/roads"
            onClick={() => setMobileOpen(false)}
            className="mt-4 bg-mint text-black font-sans text-[13px] font-bold uppercase tracking-[0.15em] px-5 py-3 rounded-[24px] text-center hover:bg-foreground hover:text-canvas transition-colors"
          >
            New Inspection
          </Link>
        </div>
      )}
    </>
  );
}
