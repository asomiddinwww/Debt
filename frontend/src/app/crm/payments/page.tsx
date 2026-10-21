"use client";

import { useState } from "react";
import { downloadUrl, useApi } from "@/lib/api";
import { dmy, money } from "@/lib/format";
import type { Payment } from "@/lib/types";
import { useSession } from "@/components/session";
import { PageHead } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { ErrorBox, Loading, Stat, Sum } from "@/components/ui";
import { PaymentForm, PaymentModal } from "@/components/forms";

type Resp = {
  month: string;
  monthLabel: string;
  payments: Payment[];
  stats: { today: { sum: number; count: number }; week: { sum: number; count: number }; month: { sum: number; count: number }; average: number };
  methods: { name: string; sum: number; pct: number }[];
};

const METHOD_FILTERS = [
  ["", "Barcha usullar"],
  ["Naqd", "Naqd"],
  ["Karta", "Karta"],
  ["Click/Payme", "Click / Payme"],
] as const;

export default function PaymentsPage() {
  const { can } = useSession();
  const [method, setMethod] = useState("");
  const [month, setMonth] = useState("");
  const [modal, setModal] = useState(false);
  const { data, error, reload } = useApi<Resp>(`/payments?method=${encodeURIComponent(method)}&month=${month}`);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  });

  return (
    <>
      <PageHead title="To'lovlar" sub="Mijozlardan qabul qilingan barcha to'lovlar">
        <a className="btn" href={downloadUrl("/export/payments.csv")}>
          Eksport
        </a>
        {can("take_payment") && (
          <button className="btn btn-primary" onClick={() => setModal(true)}>
            <Icon name="plus" size={18} color="#fff" sw={2.4} />
            To&apos;lov qabul qilish
          </button>
        )}
      </PageHead>

      <section aria-label="To'lov ko'rsatkichlari" className="grid-stats">
        <Stat k="Bugun" v={data ? <>{money(data.stats.today.sum)} so&apos;m</> : "—"} s={`${data?.stats.today.count ?? 0} ta to'lov`} />
        <Stat k="Oxirgi 7 kun" v={data ? <>{money(data.stats.week.sum)} so&apos;m</> : "—"} s={`${data?.stats.week.count ?? 0} ta to'lov`} />
        <Stat hero k={data ? `${data.monthLabel.split(",")[0]} oyi` : "Shu oy"} v={data ? <>{money(data.stats.month.sum)} so&apos;m</> : "—"} s={`${data?.stats.month.count ?? 0} ta to'lov`} />
        <Stat k="O'rtacha to'lov" v={data ? <Sum n={data.stats.average} unitSize={22} /> : "—"} s="Shu oy bo'yicha" />
      </section>

      <div className="row-wrap">
        <section aria-label="To'lovlar ro'yxati" className="card" style={{ flex: "999 1 560px", minWidth: 0, overflow: "hidden" }}>
          <div className="tbl-head">
            <select aria-label="Oy" className="select" value={month || data?.month || ""} onChange={(e) => setMonth(e.target.value)} style={{ marginRight: "auto", border: "none", fontSize: 17, fontWeight: 800, padding: 0, height: 32 }}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m === data?.month ? data.monthLabel : `${m.slice(5)}.${m.slice(0, 4)}`}
                </option>
              ))}
            </select>
            {METHOD_FILTERS.map(([k, label]) => (
              <button key={k} className={`chip${method === k ? " on" : ""}`} onClick={() => setMethod(k)}>
                {label}
              </button>
            ))}
          </div>
          {error && (
            <div style={{ padding: 16 }}>
              <ErrorBox text={error} onRetry={reload} />
            </div>
          )}
          <div className="tbl-wrap">
            <table className="tbl" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>Sana / vaqt</th>
                  <th>Mijoz</th>
                  <th>Qarz yozuvi</th>
                  <th>Usul</th>
                  <th>Qabul qildi</th>
                  <th className="r">Summa</th>
                </tr>
              </thead>
              <tbody>
                {data?.payments.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 700 }}>{dmy(r.date)}</span>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>{r.time}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.clientName}</td>
                    <td style={{ color: "var(--green)", fontWeight: 700 }}>{r.debtCode}</td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)", border: "1px solid var(--line-3)", padding: "3px 10px", borderRadius: 8 }}>{r.method}</span>
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>{r.by}</td>
                    <td className="r num" style={{ fontWeight: 800, color: "var(--green)" }}>
                      + {money(r.amount)}
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
            {data?.payments.length === 0 && <div className="empty">Bu davrda to&apos;lov yo&apos;q</div>}
          </div>
        </section>

        <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: 18 }}>
          <section aria-label="To'lov usullari" className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 className="h2">To&apos;lov usullari</h2>
            {data?.methods.map((m) => (
              <div key={m.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ fontWeight: 700 }}>{m.name}</span>
                  <span style={{ color: "var(--muted)" }}>
                    {money(m.sum)} · <b style={{ color: "var(--ink)" }}>{m.pct}%</b>
                  </span>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: "var(--line-2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${m.pct}%`, borderRadius: 999, background: "var(--green)" }} />
                </div>
              </div>
            ))}
          </section>

          {can("take_payment") && (
            <section aria-label="Tezkor to'lov" className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <h2 className="h2">Tezkor to&apos;lov</h2>
              <PaymentForm compact onSaved={reload} />
            </section>
          )}
        </div>
      </div>

      {modal && <PaymentModal onClose={() => setModal(false)} onSaved={reload} />}
    </>
  );
}
