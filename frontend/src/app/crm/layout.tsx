"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { SessionProvider, useSession } from "@/components/session";
import { Shell } from "@/components/Shell";
import { StoreBottomNav, crmNav } from "@/components/StoreNav";
import { Icon } from "@/components/Icon";

function CrmShell({ children }: { children: React.ReactNode }) {
  const { me, logout } = useSession();
  const path = usePathname();
  const [debtors, setDebtors] = useState<number | null>(null);

  useEffect(() => {
    api<{ counts: { debtors: number } }>("/clients?filter=debtors")
      .then((r) => setDebtors(r.counts.debtors))
      .catch(() => {});
  }, [path]);

  const nav = crmNav(debtors);


  return (
    <Shell
      nav={nav}
      bottom={<StoreBottomNav debtors={debtors} />}
      footer={
        <div style={{ padding: 16, borderRadius: 16, background: "var(--soft)", display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Do&apos;kon: {me.store?.name}</span>
          {me.store?.branch && <span style={{ fontSize: 12, color: "var(--muted)" }}>{me.store.branch}</span>}
          <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "none", padding: 0, color: "var(--orange)", fontSize: 12, fontWeight: 700 }}>
            <Icon name="logout" size={14} color="var(--orange)" /> Chiqish
          </button>
        </div>
      }
    >
      {children}
    </Shell>
  );
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CrmShell>{children}</CrmShell>
    </SessionProvider>
  );
}
