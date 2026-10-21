"use client";

import { useState } from "react";
import { downloadUrl, useApi } from "@/lib/api";
import { money, todayIso } from "@/lib/format";
import type { Report } from "@/lib/types";
import { useSession } from "@/components/session";
import { PageHead } from "@/components/Shell";
import { ErrorBox, GroupedBars, Legend, Loading, Stat, Sum } from "@/components/ui";

export default function ReportsPage() {
  const { can } = useSession();
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const allowed = can("view_reports");
  const { data, error, reload } = useApi<Report>(allowed ? `/reports?month=${month}` : null);

  if (!allowed) {
    return (
      <>
        <PageHead title="Hisobotlar" />
        <div className="card empty">Hisobotlarni ko&apos;rish uchun ruxsatingiz yo&apos;q.</div>
      </>
    );
  }

  const aging = data?.aging;
  const agingTotal = aging ? aging.notDue + aging.d10 + aging.d30 + aging.older || 1 : 1;
  const topMax = Math.max(1, ...(data?.top || []).map((t) => t.remaining));

  return (
    <>
      <PageHead title="Hisobotlar" sub="Qarz aylanmasi, undirish va kechikishlar tahlili">
        <label htmlFor="r-period" className="label" style={{ color: "var(--muted)" }}>
          Davr
        </label>
        <select id="r-period" className="select" style={{ height: 44, fontSize: 14 }} value={month} onChange={(e) => setMonth(e.target.value)}>
          {(data?.months || [{ value: month, label: month }]).map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <button className="btn" onClick={() => window.print()}>
          PDF
        </button>
        <a className="btn btn-primary" href={downloadUrl("/reports/export")}>
          Excel yuklab olish
        </a>
      </PageHead>

      {error && <ErrorBox text={error} onRetry={reload} />}

      <section aria-label="Oy ko'rsatkichlari" className="grid-stats">
        <Stat k="Berilgan qarz" v={data ? <Sum n={data.given} unitSize={22} /> : "—"} />
        <Stat k="Undirilgan" v={data ? <Sum n={data.collected} unitSize={22} /> : "—"} color="var(--green)" />
        <Stat hero k="Undirish darajasi" v={data ? `${data.rate}%` : "—"} />
        <Stat k="Yangi mijozlar" v={`${data?.newClients ?? 0} ta`} />
      </section>

      <div className="row-wrap" style={{ alignItems: "stretch" }}>
        <section aria-label="Oylik dinamika" className="card card-pad" style={{ flex: "999 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h2 className="h2">Berilgan va undirilgan (mln so&apos;m)</h2>
            <Legend items={[["var(--green)", "Berilgan"], ["var(--mint-bar)", "Undirilgan"]]} />
          </div>
          {data ? <GroupedBars data={data.monthly} axis={false} values /> : <Loading h={240} />}
        </section>

        <section aria-label="Qarz yoshi" className="card card-pad" style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 className="h2">Qarz yoshi</h2>
          {aging && (
            <>
              <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", gap: 2, background: "var(--line-2)" }}>
                {[
                  [aging.notDue, "var(--green)"],
                  [aging.d10, "var(--amber)"],
                  [aging.d30, "var(--orange)"],
                  [aging.older, "var(--toggle-off)"],
                ].map(([v, c], i) => (
                  <div key={i} style={{ width: `${((v as number) / agingTotal) * 100}%`, background: c as string }} />
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                {[
                  ["var(--green)", "Muddati kelmagan", aging.notDue],
                  ["var(--amber)", "1–10 kun kechikkan", aging.d10],
                  ["var(--orange)", "11–30 kun kechikkan", aging.d30],
                  ["var(--toggle-off)", "30 kundan ortiq", aging.older],
                ].map(([c, label, v]) => (
                  <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: c as string }} />
                    <span style={{ flex: 1 }}>{label as string}</span>
                    <b>{money(v as number)}</b>
                  </div>
                ))}
              </div>
            </>
          )}
          {!aging && <Loading h={160} />}
        </section>
      </div>

      <section aria-label="Eng katta qarzdorlar" className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="h2">Eng katta qarzdorlar</h2>
        {data?.top.length === 0 && <div className="empty">Ochiq qarz yo&apos;q</div>}
        {data?.top.map((t, i) => (
          <div key={t.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <span style={{ width: 24, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>{i + 1}</span>
            <span style={{ flex: "0 0 170px", fontSize: 14, fontWeight: 700 }}>{t.name}</span>
            <div style={{ flex: "1 1 200px", height: 10, borderRadius: 999, background: "var(--line-2)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(t.remaining / topMax) * 100}%`, background: "var(--green)", borderRadius: 999 }} />
            </div>
            <span style={{ flex: "0 0 110px", textAlign: "right", fontSize: 14, fontWeight: 800 }}>{money(t.remaining)}</span>
          </div>
        ))}
      </section>
    </>
  );
}
