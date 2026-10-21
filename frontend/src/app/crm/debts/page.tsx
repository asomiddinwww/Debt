"use client";

import { useState } from "react";
import { api, downloadUrl, useApi } from "@/lib/api";
import { addDaysIso, dmy, money, statusBadge, statusText, todayIso } from "@/lib/format";
import type { Debt } from "@/lib/types";
import { useSession } from "@/components/session";
import { PageHead } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { ErrorBox, Loading, Modal, Pager, toast } from "@/components/ui";
import { DebtModal, PaymentForm } from "@/components/forms";

type Resp = {
  debts: Debt[];
  total: number;
  page: number;
  pages: number;
  summary: { give: number; giveOpen: number; take: number; takeParties: number; balance: number };
};

function periodRange(p: string): [string, string] | null {
  const t = todayIso();
  if (p === "month") return [`${t.slice(0, 7)}-01`, t];
  if (p === "last") {
    const d = new Date();
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const from = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`;
    return [from, addDaysIso(`${t.slice(0, 7)}-01`, -1)];
  }
  if (p === "90") return [addDaysIso(t, -90), t];
  return null;
}

export default function DebtsPage() {
  const { can } = useSession();
  const [direction, setDir] = useState("all");
  const [q, setQuery] = useState("");
  const [period, setPer] = useState("all");
  const [status, setStat] = useState("all");
  const [page, setPage] = useState(1);
  const withReset = <V,>(fn: (v: V) => void) => (v: V) => {
    fn(v);
    setPage(1);
  };
  const setDirection = withReset(setDir);
  const setQ = withReset(setQuery);
  const setPeriod = withReset(setPer);
  const setStatus = withReset(setStat);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Debt | null>(null);

  const range = periodRange(period);
  const qs = new URLSearchParams({ direction, status, q, page: String(page), limit: "8", ...(range ? { from: range[0], to: range[1] } : {}) });
  const { data, error, reload } = useApi<Resp>(`/debts?${qs}`);

  const s = data?.summary;
  const card = (key: string, title: string, value: string, sub: string, color?: string) => {
    const on = direction === key;
    return (
      <button
        onClick={() => setDirection(on ? "all" : key)}
        style={{
          textAlign: "left", background: on ? "var(--green)" : "#fff", color: on ? "#fff" : "var(--ink)", border: on ? "1px solid var(--green)" : "1px solid var(--line)",
          borderRadius: 18, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6,
        }}
      >
        <span style={{ fontSize: 13, color: on ? "var(--mint)" : "var(--muted)", fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 22, fontWeight: 800, color: on ? "#fff" : color }}>{value}</span>
        <span style={{ fontSize: 12, color: on ? "var(--mint)" : "var(--muted)" }}>{sub}</span>
      </button>
    );
  };

  return (
    <>
      <PageHead title="Qarzlar" sub="Berilgan va olingan barcha qarz yozuvlari">
        <a className="btn" href={downloadUrl("/export/debts.csv")}>
          Eksport
        </a>
        {can("add_debt") && (
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Icon name="plus" size={18} color="#fff" sw={2.4} />
            Yangi qarz
          </button>
        )}
      </PageHead>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {card("give", "Men bergan qarzlar", s ? `${money(s.give)} so'm` : "—", `${s?.giveOpen ?? 0} ta ochiq yozuv`)}
        {card("take", "Men olgan qarzlar", s ? `${money(s.take)} so'm` : "—", `${s?.takeParties ?? 0} ta yetkazib beruvchi`)}
        <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 18, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>Sof balans</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: (s?.balance ?? 0) >= 0 ? "var(--green)" : "var(--orange)" }}>
            {s ? `${s.balance >= 0 ? "+" : "−"} ${money(Math.abs(s.balance))} so'm` : "—"}
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{(s?.balance ?? 0) >= 0 ? "Sizning foydangizga" : "Siz qarzdorsiz"}</span>
        </div>
      </div>

      <section aria-label="Qarz yozuvlari" className="card" style={{ overflow: "hidden" }}>
        <div className="tbl-head" style={{ alignItems: "flex-end", gap: 12 }}>
          <div className="seg">
            {[
              ["all", "Barchasi"],
              ["give", "Berilgan"],
              ["take", "Olingan"],
            ].map(([k, label]) => (
              <button key={k} className={direction === k ? "on" : ""} onClick={() => setDirection(k)}>
                {label}
              </button>
            ))}
          </div>
          <label htmlFor="q-search" className="search" style={{ height: 42, flex: "1 1 220px" }}>
            <Icon name="search" size={18} color="var(--muted)" />
            <input id="q-search" placeholder="Mijoz yoki yozuv raqami…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="field" style={{ gap: 4 }}>
            <label htmlFor="q-period" style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
              Davr
            </label>
            <select id="q-period" className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="all">Barcha vaqt</option>
              <option value="month">Shu oy</option>
              <option value="last">O&apos;tgan oy</option>
              <option value="90">So&apos;nggi 90 kun</option>
            </select>
          </div>
          <div className="field" style={{ gap: 4 }}>
            <label htmlFor="q-status" style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)" }}>
              Holat
            </label>
            <select id="q-status" className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Barcha holatlar</option>
              <option value="ok">Faol</option>
              <option value="late">Muddati o&apos;tgan</option>
              <option value="paid">Yopilgan</option>
            </select>
          </div>
        </div>
        {error && (
          <div style={{ padding: 16 }}>
            <ErrorBox text={error} onRetry={reload} />
          </div>
        )}
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>Yozuv</th>
                <th>Mijoz</th>
                <th>Turi</th>
                <th className="r">Summa</th>
                <th className="r">To&apos;langan</th>
                <th className="r">Qoldiq</th>
                <th>Muddat</th>
                <th>Holat</th>
              </tr>
            </thead>
            <tbody>
              {data?.debts.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => setOpen(r)}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontWeight: 700 }}>{r.code}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>{dmy(r.date)}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{r.clientName}</td>
                  <td>
                    <span className={`badge ${r.direction === "give" ? "b-paid" : "b-blue"}`} style={{ borderRadius: 8, padding: "3px 10px" }}>
                      {r.direction === "give" ? "Berildi" : "Olindi"}
                    </span>
                  </td>
                  <td className="r num">{money(r.amount)}</td>
                  <td className="r num" style={{ color: "var(--muted)" }}>
                    {money(r.paid)}
                  </td>
                  <td className="r num" style={{ fontWeight: 800 }}>
                    {money(r.remaining)}
                  </td>
                  <td style={{ color: "var(--ink-2)" }}>{r.remaining > 0 ? dmy(r.dueDate) : "—"}</td>
                  <td>
                    <span className={`badge ${statusBadge(r.status)}`}>{statusText(r.status)}</span>
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
          {data?.debts.length === 0 && <div className="empty">Yozuv topilmadi</div>}
        </div>
        <div className="tbl-foot">
          <span>
            {data?.total ?? 0} tadan {data?.total ? `${(page - 1) * 8 + 1}–${Math.min(page * 8, data.total)}` : 0} ko&apos;rsatilmoqda
          </span>
          <Pager page={page} pages={data?.pages ?? 1} onPage={setPage} />
        </div>
      </section>

      {adding && <DebtModal onClose={() => setAdding(false)} onSaved={reload} />}
      {open && <DebtDetail debt={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

function DebtDetail({ debt, onClose, onChanged }: { debt: Debt; onClose: () => void; onChanged: () => void }) {
  const { can } = useSession();
  const { data, reload } = useApi<{ debt: Debt; payments: { id: number; amount: number; method: string; created_at: string; by_name: string | null }[] }>(`/debts/${debt.id}`);
  const d = data?.debt || debt;

  async function remove() {
    if (!confirm(`${d.code} yozuvi va unga tegishli to'lovlar o'chiriladi. Davom etasizmi?`)) return;
    try {
      await api(`/debts/${d.id}`, { method: "DELETE" });
      toast("Yozuv o'chirildi");
      onChanged();
      onClose();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <Modal title={`${d.code} · ${d.clientName}`} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          ["Summa", money(d.amount)],
          ["Qoldiq", money(d.remaining)],
          ["Sana", dmy(d.date)],
          ["Muddat", dmy(d.dueDate)],
        ].map(([k, v]) => (
          <div key={k} style={{ padding: 12, borderRadius: 12, background: "var(--soft)", display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{k}</span>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{v}</span>
          </div>
        ))}
      </div>
      {d.note && <div style={{ fontSize: 13, color: "var(--ink-2)" }}>Izoh: {d.note}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>To&apos;lovlar</span>
        {data?.payments.length === 0 && <span style={{ fontSize: 13, color: "var(--muted)" }}>Hali to&apos;lov yo&apos;q</span>}
        {data?.payments.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderTop: "1px solid var(--line-2)", paddingTop: 8 }}>
            <span>
              {dmy(p.created_at)} · {p.method}
              {p.by_name ? ` · ${p.by_name}` : ""}
            </span>
            <b style={{ color: "var(--green)" }}>+ {money(p.amount)}</b>
          </div>
        ))}
      </div>
      {d.direction === "give" && d.remaining > 0 && can("take_payment") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--line-2)", paddingTop: 12 }}>
          <PaymentForm
            debtId={d.id}
            compact
            onSaved={() => {
              reload();
              onChanged();
            }}
          />
        </div>
      )}
      {can("delete_debt") && (
        <button className="btn btn-danger" onClick={remove}>
          <Icon name="trash" size={16} /> Yozuvni o&apos;chirish
        </button>
      )}
    </Modal>
  );
}
