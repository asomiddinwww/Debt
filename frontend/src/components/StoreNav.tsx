"use client";

import { useState } from "react";
import { notifyDataChanged } from "@/lib/api";
import { useSession } from "./session";
import { BottomNav } from "./BottomNav";
import { DebtModal } from "./forms";
import { Icon } from "./Icon";
import type { NavItem } from "./Shell";

export function crmNav(debtors?: number | null): NavItem[] {
  return [
    { href: "/dashboard", label: "Boshqaruv paneli", icon: "grid" },
    { href: "/crm/clients", label: "Mijozlar", icon: "users", badge: debtors },
    { href: "/crm/debts", label: "Qarzlar", icon: "ledger" },
    { href: "/crm/payments", label: "To'lovlar", icon: "cash" },
    { href: "/crm/reminders", label: "Eslatmalar", icon: "msg" },
    { href: "/crm/reports", label: "Hisobotlar", icon: "chart" },
    { href: "/crm/settings", label: "Sozlamalar", icon: "settings" },
  ];
}

/** Do'kon xodimlari uchun telefondagi pastki navigatsiya: Asosiy · Mijozlar · + · Hisobot · Menyu */
export function StoreBottomNav({ debtors }: { debtors?: number | null }) {
  const { me, logout, can } = useSession();
  const [adding, setAdding] = useState(false);
  return (
    <>
      <BottomNav
        items={[
          { href: "/dashboard", label: "Asosiy", icon: "home" },
          { href: "/crm/clients", label: "Mijozlar", icon: "users" },
          { href: "/crm/reports", label: "Hisobot", icon: "chart" },
        ]}
        fab={can("add_debt") ? { label: "Yangi qarz qo'shish", onClick: () => setAdding(true) } : undefined}
        menu={crmNav(debtors)}
        footer={
          <div style={{ padding: 16, borderRadius: 16, background: "var(--soft)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Do&apos;kon: {me.store?.name}</span>
              {me.store?.branch && <span style={{ fontSize: 12, color: "var(--muted)" }}>{me.store.branch}</span>}
            </div>
            <button onClick={logout} className="btn btn-danger btn-sm">
              <Icon name="logout" size={14} /> Chiqish
            </button>
          </div>
        }
      />
      {adding && <DebtModal onClose={() => setAdding(false)} onSaved={notifyDataChanged} />}
    </>
  );
}
