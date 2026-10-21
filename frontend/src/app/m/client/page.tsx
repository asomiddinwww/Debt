"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, useApi } from "@/lib/api";
import { dayMonthShort, longDate, money } from "@/lib/format";
import type { Client, Debt, HistoryItem } from "@/lib/types";
import { useSession } from "@/components/session";
import { MobileHeader } from "@/components/MobileHeader";
import { Icon } from "@/components/Icon";
import { Avatar, ErrorBox, Loading, Modal, toast } from "@/components/ui";
import { ClientModal, PaymentForm } from "@/components/forms";
import { openSms } from "@/components/sms";

type Resp = { client: Client; debts: Debt[]; history: HistoryItem[] };

function ClientCard() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { can, sms } = useSession();
  const { data, error, reload } = useApi<Resp>(id ? `/clients/${id}` : null);
  const [pay, setPay] = useState(false);
  const [menu, setMenu] = useState(false);
  const [edit, setEdit] = useState(false);
  const [sending, setSending] = useState(false);

  async function remind() {
    setSending(true);
    try {
      const r = await api<{ phone: string; text: string }>(`/clients/${id}/remind`, { method: "POST" });
      openSms({ phone: r.phone, text: r.text, name: data?.client.name });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function remove() {
    if (!confirm("Mijoz va uning barcha qarz yozuvlari o'chiriladi. Davom etasizmi?")) return;
    try {
      await api(`/clients/${id}`, { method: "DELETE" });
      toast("Mijoz o'chirildi");
      router.replace("/m/clients");
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const c = data?.client;
  const pct = c && c.given ? Math.min(100, (c.paid / c.given) * 100) : 0;

  return (
    <div className="m-shell no-nav">
      <MobileHeader
        title="Mijoz"
        right={
          <button aria-label="Ko'proq" className="icon-btn" onClick={() => setMenu(true)}>
            <Icon name="dots" size={22} color="var(--ink)" />
          </button>
        }
      />
      {error && (
        <div className="m-pad" style={{ marginTop: 18 }}>
          <ErrorBox text={error} onRetry={reload} />
        </div>
      )}
      {!c && !error && (
        <div className="m-pad" style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <Loading h={60} />
          <Loading h={170} />
        </div>
      )}
      {c && (
        <>
          <div style={{ margin: "18px 20px 0", display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar text={c.initials} size={60} radius={20} status={c.status} fontSize={20} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 20, fontWeight: 800 }}>{c.name}</span>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>{c.phone || "Telefon kiritilmagan"}</span>
            </div>
            {c.phone && (
              <a href={`tel:${c.phone.replace(/\s/g, "")}`} aria-label="Qo'ng'iroq qilish" style={{ width: 44, height: 44, borderRadius: 14, background: "var(--green-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="phone" size={20} color="var(--green)" />
              </a>
            )}
          </div>

          <div className="m-card" style={{ margin: "18px 20px 0", padding: 18, borderRadius: 22, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>{c.kind === "supplier" ? "Mening qarzim" : "Qolgan qarz"}</span>
                <span style={{ fontSize: 28, fontWeight: 800, color: c.status === "late" ? "var(--orange)" : "var(--green)", letterSpacing: -0.4 }}>
                  {money(c.remaining)} <span style={{ fontSize: 16 }}>so&apos;m</span>
                </span>
              </div>
              <span className={`badge ${c.status === "late" ? "b-late" : c.status === "ok" ? "b-ok" : "b-paid"}`} style={{ padding: "5px 10px" }}>
                {c.dueLabel}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ height: 10, borderRadius: 999, background: "#E9F0EC", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "var(--green)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)" }}>
                <span>
                  To&apos;landi: <b style={{ color: "var(--ink)" }}>{money(c.paid)}</b>
                </span>
                <span>
                  Jami: <b style={{ color: "var(--ink)" }}>{money(c.given)}</b>
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12, borderTop: "1px dashed var(--line-3)", fontSize: 13, color: "var(--muted)" }}>
              <Icon name="calendar" size={18} color="var(--muted)" sw={1.8} />
              Qaytarish muddati: <b style={{ color: "var(--ink)" }}>{longDate(c.nextDue)}</b>
            </div>
          </div>

          <div style={{ margin: "14px 20px 0", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            <button
              disabled={c.remaining <= 0 || c.kind === "supplier"}
              onClick={() => setPay(true)}
              style={{ height: 50, borderRadius: 16, border: "none", background: "var(--green)", color: "#fff", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Icon name="check" size={18} color="#fff" sw={2.2} />
              To&apos;lov qabul
            </button>
            <Link
              href={`/m/add?client=${c.id}`}
              style={{ height: 50, borderRadius: 16, border: "1.5px solid var(--green)", background: "#fff", color: "var(--green)", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none" }}
            >
              <Icon name="plus" size={18} color="var(--green)" sw={2.2} />
              Qarz qo&apos;shish
            </Link>
          </div>
          {sms && can("send_sms") && (
            <button
              onClick={remind}
              disabled={sending || c.remaining <= 0 || !c.phone}
              style={{ margin: "10px 20px 0", height: 46, borderRadius: 16, border: "1px solid var(--line)", background: "#fff", color: "var(--ink)", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <Icon name="msg" size={18} sw={1.8} />
              {sending ? "Yuborilmoqda…" : "SMS eslatma yuborish"}
            </button>
          )}

          <div style={{ margin: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Tarix</h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{data.history.length} ta amal</span>
          </div>
          <div className="m-card" style={{ margin: "10px 20px 0", display: "flex", flexDirection: "column" }}>
            {data.history.length === 0 && <div className="empty">Hali amal yo&apos;q</div>}
            {data.history.map((h, i) => {
              const isPay = h.kind === "payment";
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid var(--line-2)" : "none" }}>
                  <span style={{ width: 36, height: 36, borderRadius: 12, background: isPay ? "var(--green-soft)" : "#F1F4F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name={isPay ? "take" : "give"} size={18} color={isPay ? "var(--green)" : "var(--ink)"} sw={2.2} />
                  </span>
                  <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{h.title}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {dayMonthShort(h.date)} · {h.method}
                    </span>
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: isPay ? "var(--green)" : "var(--ink)" }}>
                    {isPay ? "−" : "+"} {money(h.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {pay && c && (
        <Modal title="To'lov qabul qilish" onClose={() => setPay(false)}>
          <PaymentForm
            clientId={c.id}
            onSaved={() => {
              setPay(false);
              reload();
            }}
          />
        </Modal>
      )}
      {menu && c && (
        <Modal title={c.name} onClose={() => setMenu(false)}>
          <button
            className="btn"
            style={{ justifyContent: "flex-start" }}
            onClick={() => {
              setMenu(false);
              setEdit(true);
            }}
          >
            <Icon name="edit" size={18} /> Tahrirlash
          </button>
          {can("delete_debt") && (
            <button className="btn btn-danger" style={{ justifyContent: "flex-start" }} onClick={remove}>
              <Icon name="trash" size={18} /> Mijozni o&apos;chirish
            </button>
          )}
        </Modal>
      )}
      {edit && c && <ClientModal client={c} onClose={() => setEdit(false)} onSaved={reload} />}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="m-shell" />}>
      <ClientCard />
    </Suspense>
  );
}
