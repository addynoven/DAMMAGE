import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DAMMAGE — Sign In",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
