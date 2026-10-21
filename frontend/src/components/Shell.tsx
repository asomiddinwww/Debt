"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Logo } from "./ui";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number | null };

/** CRM va admin panel qobig'i: kompyuterda yon menyu, telefonda pastki navigatsiya (bottom) */
export function Shell({
  nav,
  footer,
  children,
  variant = "crm",
  subtitle,
  bottom,
}: {
  nav: NavItem[];
  footer: ReactNode;
  children: ReactNode;
  variant?: "crm" | "admin";
  subtitle?: string;
  bottom?: ReactNode;
}) {
  const path = usePathname();
  const admin = variant === "admin";

  return (
    <div className={`crm${admin ? " admin" : ""}`}>
      <aside className="crm-aside">
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px" }}>
          <Logo inverted={admin} />
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <span style={{ fontSize: admin ? 17 : 18, fontWeight: 800, letterSpacing: -0.3 }}>Qarz Daftar</span>
            {subtitle && <span style={{ fontSize: 12, color: "var(--mint-2)", fontWeight: 600 }}>{subtitle}</span>}
          </div>
        </div>
        <nav aria-label={admin ? "Admin menyu" : "CRM menyu"} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {nav.map((n) => {
            const on = path === n.href || (n.href !== "/admin" && path.startsWith(n.href + "/"));
            return (
              <Link key={n.href} href={n.href} className={`nav-link${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>
                <Icon name={n.icon} size={20} />
                {n.label}
                {!!n.badge && (
                  <span style={{ marginLeft: "auto", fontSize: 12, background: "var(--green)", color: "#fff", padding: "2px 8px", borderRadius: 999 }}>{n.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div style={{ marginTop: "auto" }}>{footer}</div>
      </aside>
      <main className="crm-main">
        <div className="mobile-bar">
          <Logo size={32} inverted={false} />
          <span style={{ fontWeight: 800 }}>Qarz Daftar</span>
          {subtitle && <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>· {subtitle}</span>}
        </div>
        {children}
      </main>
      {bottom}
    </div>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="t">
        <h1>{title}</h1>
        {sub && <span className="sub">{sub}</span>}
      </div>
      {children}
    </header>
  );
}
