"use client";

import { useState } from "react";
import { downloadUrl, useApi } from "@/lib/api";
import { dm, money } from "@/lib/format";
import { PageHead } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { ErrorBox, Loading, Stat } from "@/components/ui";

type Row = { id: number; level: "info" | "warn" | "err" | "ok"; module: string; message: string; user_label: string; ip: string; created_at: string };
type Resp = { rows: Row[]; stats: { today: number; warn: number; err: number; uptime: number }; modules: string[] };

const LV = {
  info: ["INFO", "b-blue"],
  warn: ["OGOHLANTIRISH", "b-warn"],
  err: ["XATO", "b-late"],
  ok: ["MUVAFFAQIYAT", "b-ok"],
} as const;

export default function LogsPage() {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [mod, setMod] = useState("all");
  const [date, setDate] = useState("today");
  const qs = new URLSearchParams({ q, level, module: mod, date }).toString();
  const { data, error, reload } = useApi<Resp>(`/admin/logs?${qs}`);

  return (
    <>
      <PageHead title="Tizim jurnali" sub="Platformadagi barcha muhim hodisalar va xatolar">
        <a className="btn" href={downloadUrl(`/admin/logs.csv?${qs}`)}>
          CSV yuklab olish
        </a>
      </PageHead>

      <section aria-label="Hodisalar soni" className="grid-stats">
        <Stat k="Bugungi hodisalar" v={<span style={{ fontSize: 24 }}>{money(data?.stats.today)}</span>} />
        <Stat k="Ogohlantirishlar" v={<span style={{ fontSize: 24 }}>{data?.stats.warn ?? 0}</span>} color="#9A5B00" />
        <Stat k="Xatolar" v={<span style={{ fontSize: 24 }}>{data?.stats.err ?? 0}</span>} color="var(--orange)" />
        <Stat
          k="Server holati"
          v={
            <span style={{ fontSize: 24, color: data ? "var(--green)" : "var(--orange)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: data ? "var(--green)" : "var(--orange)" }} />
              {data ? "Ishlamoqda" : error ? "Javob yo'q" : "…"}
            </span>
          }
        />
      </section>

      {error && <ErrorBox text={error} onRetry={reload} />}

      <section aria-label="Jurnal yozuvlari" className="card" style={{ overflow: "hidden" }}>
        <div className="tbl-head" style={{ alignItems: "flex-end", gap: 10 }}>
          <label htmlFor="lg-search" className="search" style={{ height: 42, flex: "1 1 260px" }}>
            <Icon name="search" size={18} color="var(--muted)" />
            <input id="lg-search" placeholder="Hodisa, foydalanuvchi yoki IP" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="field" style={{ gap: 4 }}>
            <label htmlFor="lg-level" style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
              Daraja
            </label>
            <select id="lg-level" className="select" style={{ minWidth: 150 }} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Barcha darajalar</option>
              <option value="info">Info</option>
              <option value="ok">Muvaffaqiyat</option>
              <option value="warn">Ogohlantirish</option>
              <option value="err">Xato</option>
            </select>
          </div>
          <div className="field" style={{ gap: 4 }}>
            <label htmlFor="lg-mod" style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
              Modul
            </label>
            <select id="lg-mod" className="select" style={{ minWidth: 150 }} value={mod} onChange={(e) => setMod(e.target.value)}>
              <option value="all">Barcha modullar</option>
              {data?.modules.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ gap: 4 }}>
            <label htmlFor="lg-date" style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
              Sana
            </label>
            <select id="lg-date" className="select" style={{ minWidth: 150 }} value={date} onChange={(e) => setDate(e.target.value)}>
              <option value="today">Bugun</option>
              <option value="7d">So&apos;nggi 7 kun</option>
              <option value="all">Barchasi</option>
            </select>
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 900, fontSize: 13 }}>
            <thead>
              <tr>
                <th>Vaqt</th>
                <th>Daraja</th>
                <th>Modul</th>
                <th>Hodisa</th>
                <th>Foydalanuvchi</th>
                <th>IP manzil</th>
              </tr>
            </thead>
            <tbody>
              {data?.rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ color: "var(--ink-2)", whiteSpace: "nowrap", padding: "11px 16px" }}>
                    {date === "today" ? r.created_at.slice(11) : `${dm(r.created_at)} ${r.created_at.slice(11, 16)}`}
                  </td>
                  <td style={{ padding: "11px 12px" }}>
                    <span className={`badge ${LV[r.level][1]}`} style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.4, padding: "3px 8px", borderRadius: 6 }}>
                      {LV[r.level][0]}
                    </span>
                  </td>
                  <td style={{ color: "var(--ink-2)", padding: "11px 12px" }}>{r.module}</td>
                  <td style={{ fontWeight: 600, padding: "11px 12px" }}>{r.message}</td>
                  <td style={{ color: "var(--ink-2)", padding: "11px 12px" }}>{r.user_label}</td>
                  <td className="mono" style={{ color: "var(--muted)", padding: "11px 16px" }}>
                    {r.ip}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data && !error && (
            <div style={{ padding: 16 }}>
              <Loading h={300} />
            </div>
          )}
          {data?.rows.length === 0 && <div className="empty">Hodisa topilmadi</div>}
        </div>
      </section>
    </>
  );
}
