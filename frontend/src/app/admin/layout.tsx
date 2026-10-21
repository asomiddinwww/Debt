"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, getToken, setToken } from "@/lib/api";
import type { User } from "@/lib/types";
import { Shell, type NavItem } from "@/components/Shell";
import { BottomNav } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { ToastHost } from "@/components/ui";
import { AdminCtx } from "@/components/adminCtx";


const NAV: NavItem[] = [
  { href: "/admin", label: "Umumiy ko'rinish", icon: "grid" },
  { href: "/admin/stores", label: "Do'konlar", icon: "store" },
  { href: "/admin/users", label: "Foydalanuvchilar", icon: "users" },
  { href: "/admin/billing", label: "Tariflar va to'lovlar", icon: "card" },
  { href: "/admin/sms", label: "SMS xizmati", icon: "msg" },
  { href: "/admin/logs", label: "Tizim jurnali", icon: "file" },
  { href: "/admin/settings", label: "Sozlamalar", icon: "settings" },
];

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!getToken("admin")) {
      router.replace("/admin/login");
      return;
    }
    api<{ user: User }>("/admin/me")
      .then((r) => setUser(r.user))
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  const logout = () => {
    setToken(null, "admin");
    router.replace("/admin/login");
  };

  if (!user) return null;
  return (
    <AdminCtx.Provider value={{ user, logout }}>
      <Shell
        variant="admin"
        subtitle="Admin panel"
        nav={NAV}
        bottom={
          <BottomNav
            items={[
              { href: "/admin", label: "Umumiy", icon: "grid" },
              { href: "/admin/stores", label: "Do'konlar", icon: "store" },
              { href: "/admin/users", label: "Loginlar", icon: "users" },
              { href: "/admin/sms", label: "SMS", icon: "msg" },
            ]}
            menu={NAV}
            footer={
              <div style={{ padding: 14, borderRadius: 14, background: "var(--soft)", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{user.name}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{user.email}</span>
                </div>
                <button onClick={logout} className="btn btn-danger btn-sm">
                  <Icon name="logout" size={14} /> Chiqish
                </button>
              </div>
            }
          />
        }
        footer={
          <div style={{ padding: 14, borderRadius: 14, background: "var(--green-dark)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 11, background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
              {user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{user.name}</span>
              <span style={{ fontSize: 12, color: "var(--mint-2)", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</span>
            </div>
            <button onClick={logout} aria-label="Chiqish" style={{ border: "none", background: "none", padding: 4, color: "var(--mint-2)" }}>
              <Icon name="logout" size={18} />
            </button>
          </div>
        }
      >
        {children}
      </Shell>
      <ToastHost />
    </AdminCtx.Provider>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/admin/login") return <>{children}</>;
  return <AdminShell>{children}</AdminShell>;
}
