"use client";

import Link from "next/link";
import { useState } from "react";
import { api, useApi } from "@/lib/api";
import { dm, money } from "@/lib/format";
import { PageHead } from "@/components/Shell";
import { ErrorBox, Field, Legend, Loading, Modal, Toggle, toast } from "@/components/ui";
import { useAdmin } from "@/components/adminCtx";

type Resp = {
  enabled: boolean;
  balance: number;
  capacity: number;
  pct: number;
  daysLeft: number;
  provider: string;
  sender: string;
  connected: boolean;
  days: { date: string; ok: number; fail: number }[];
  sent: number;
  deliveredPct: number;
  failed: number;
  recent: { id: number; time: string; store: string; to: string; type: string; status: "sent" | "wait" | "fail" | "phone" }[];
};

const ST = { sent: ["Yetkazildi", "b-ok"], wait: ["Yuborilmoqda", "b-blue"], fail: ["Xato", "b-late"], phone: ["Telefondan", "b-paid"] } as const;

export default function SmsPage() {
  const { data, error, reload } = useApi<Resp>("/admin/sms");
  const [buy, setBuy] = useState(false);
  const isSuper = useAdmin().user.role === "superadmin";

  async function setEnabled(enabled: boolean) {
    if (!enabled && !confirm("SMS yuborish barcha do'konlar uchun o'chirilsinmi? Eslatmalar ishlashda davom etadi.")) return;
    try {
      await api("/admin/sms/enabled", { method: "PUT", body: { enabled } });
      toast(enabled ? "SMS yuborish yoqildi" : "SMS yuborish o'chirildi");
      reload();
    } catch (e) {
      toast((e as Error).message);
    }
  }
  const max = Math.max(1, ...(data?.days || []).map((d) => d.ok + d.fail));

  return (
    <>
      <PageHead title="SMS xizmati" sub="Balans, yetkazish statistikasi va yuborilgan xabarlar">
        <button className="btn btn-primary" onClick={() => setBuy(true)}>
          SMS paket sotib olish
        </button>
      </PageHead>

      {error && <ErrorBox text={error} onRetry={reload} />}

      {data && (
        <section
          aria-label="SMS yuborish holati"
          className="card"
          style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, borderColor: data.enabled ? "var(--green-border)" : "var(--orange-line)", background: data.enabled ? "var(--green-softer)" : "var(--orange-bg)" }}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>SMS yuborish: {data.enabled ? "yoqilgan" : "o'chirilgan"}</span>
            <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
              {data.enabled
                ? "Do'konlar mijozlarga SMS eslatma va to'lov cheki yubora oladi. Har bir do'kon uchun alohida o'chirish — Do'konlar bo'limida."
                : "Do'konlarda SMS tugmalari ko'rinmaydi. Muddat eslatmalari va bildirishnomalar ishlashda davom etadi."}
            </span>
          </div>
          {isSuper ? (
            <Toggle on={data.enabled} onChange={setEnabled} label="SMS yuborish" />
          ) : (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Faqat super admin o&apos;zgartiradi</span>
          )}
        </section>
      )}

      <div className="row-wrap" style={{ alignItems: "stretch" }}>
        <section aria-label="SMS balans" style={{ flex: "1 1 320px", background: "var(--green)", color: "#fff", borderRadius: 20, padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <span style={{ fontSize: 13, color: "var(--mint)", fontWeight: 600 }}>Joriy balans</span>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: -0.6 }}>
            {data ? money(data.balance) : "—"} <span style={{ fontSize: 16 }}>SMS</span>
          </span>
          <div style={{ height: 10, borderRadius: 999, background: "var(--green-dark)", overflow: "hidden" }}>
            <div style={{ width: `${data?.pct ?? 0}%`, height: "100%", background: "#fff", borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: 13, color: "var(--mint)" }}>
            {data ? `${money(data.capacity)} dan ${data.pct}% qoldi · Taxminan ${data.daysLeft} kunga yetadi` : ""}
          </span>
          <div style={{ marginTop: "auto", padding: 12, borderRadius: 12, background: "var(--green-dark)", display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: "var(--mint)" }}>Provayder</span>
              <b>{data?.provider}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: "var(--mint)" }}>Jo&apos;natuvchi nomi</span>
              <b>{data?.sender}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--mint)" }}>API holati</span>
              <b style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: data?.connected ? "var(--mint-bar)" : "var(--amber)" }} />
                {data?.connected ? "Ulangan" : "Ulanmagan"}
              </b>
            </div>
          </div>
        </section>

        <section aria-label="Kunlik yuborish" className="card" style={{ flex: "999 1 520px", minWidth: 0, borderRadius: 20, padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
            <h2 className="h2">So&apos;nggi 14 kun</h2>
            <div style={{ display: "flex", gap: 20, fontSize: 13, flexWrap: "wrap" }}>
              <span style={{ color: "var(--muted)" }}>
                Yuborildi: <b style={{ color: "var(--ink)" }}>{money(data?.sent)}</b>
              </span>
              <span style={{ color: "var(--muted)" }}>
                Yetkazildi: <b style={{ color: "var(--green)" }}>{data?.deliveredPct ?? 0}%</b>
              </span>
              <span style={{ color: "var(--muted)" }}>
                Xato: <b style={{ color: "var(--orange)" }}>{money(data?.failed)}</b>
              </span>
            </div>
          </div>
          {!data && <Loading h={180} />}
          {data && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(14, minmax(0, 1fr))", gap: 8, alignItems: "end", height: 180, borderBottom: "1px solid var(--line)" }}>
                {data.days.map((d, i) => (
                  <div key={d.date} title={`${dm(d.date)}: ${d.ok} yetkazildi, ${d.fail} xato`} style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                    <div style={{ height: Math.max(d.fail ? 3 : 0, Math.round((d.fail / max) * 170)), background: "var(--amber)", borderRadius: "4px 4px 0 0" }} />
                    <div style={{ height: Math.round((d.ok / max) * 170), background: i === data.days.length - 1 ? "var(--green)" : "#6DBB91" }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                <span>{dm(data.days[0]?.date)}</span>
                <span>{dm(data.days[6]?.date)}</span>
                <span>{dm(data.days[13]?.date)}</span>
              </div>
              <Legend items={[["var(--green)", "Yetkazildi"], ["var(--amber)", "Xato"]]} />
            </>
          )}
        </section>
      </div>

      <section aria-label="SMS jurnali" className="card" style={{ overflow: "hidden" }}>
        <div className="tbl-head" style={{ justifyContent: "space-between" }}>
          <h2 className="h2">Oxirgi xabarlar</h2>
          <Link href="/admin/logs" style={{ fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
            To&apos;liq jurnal
          </Link>
        </div>
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Vaqt</th>
                <th>Do&apos;kon</th>
                <th>Qabul qiluvchi</th>
                <th>Turi</th>
                <th>Holat</th>
              </tr>
            </thead>
            <tbody>
              {data?.recent.map((l) => (
                <tr key={l.id}>
                  <td style={{ color: "var(--ink-2)" }}>{l.time}</td>
                  <td style={{ fontWeight: 600 }}>{l.store}</td>
                  <td className="num" style={{ color: "var(--ink-2)" }}>
                    {l.to}
                  </td>
                  <td style={{ color: "var(--ink-2)" }}>{l.type}</td>
                  <td>
                    <span className={`badge ${ST[l.status][1]}`}>{ST[l.status][0]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {buy && <TopupModal onClose={() => setBuy(false)} onSaved={reload} />}
    </>
  );
}

function TopupModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("10 000");
  return (
    <Modal title="SMS paket" onClose={onClose}>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>Provayderdan sotib olingan paket hajmini balansga qo&apos;shing.</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["5 000", "10 000", "20 000"].map((v) => (
          <button key={v} className={`chip${amount === v ? " on" : ""}`} onClick={() => setAmount(v)}>
            {v} ta
          </button>
        ))}
      </div>
      <Field label="Miqdor" id="sms-amount">
        <input id="sms-amount" className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d ]/g, ""))} />
      </Field>
      <button
        className="btn btn-primary"
        style={{ height: 48 }}
        onClick={async () => {
          try {
            await api("/admin/sms/topup", { body: { amount: amount.replace(/\D/g, "") } });
            toast("Balans to'ldirildi");
            onSaved();
            onClose();
          } catch (e) {
            toast((e as Error).message);
          }
        }}
      >
        Balansga qo&apos;shish
      </button>
    </Modal>
  );
}
