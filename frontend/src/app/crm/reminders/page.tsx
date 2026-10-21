"use client";

import { useRef, useState } from "react";
import { api, useApi } from "@/lib/api";
import { dm, money, todayIso } from "@/lib/format";
import { useSession } from "@/components/session";
import { PageHead } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { Avatar, ErrorBox, Loading, Modal, Stat, Toggle, toast } from "@/components/ui";
import { openSms } from "@/components/sms";

type Item = { id: string; clientId: number | null; name: string; initials: string; note: string; amount: number; at: string; status: "plan" | "sent" | "fail" | "phone"; phone?: string; text?: string };
type Overdue = { clientId: number; name: string; initials: string; phone: string; amount: number; dueLabel: string; text: string };
type Rules = { before: boolean; due: boolean; after: boolean };
type Resp = {
  items: Item[];
  stats: { sent: number; planned: number; dueToday: number; overdue: number };
  template: string;
  rules: Rules;
  preview: string;
};

const ST = {
  plan: ["Rejada", "b-blue"],
  sent: ["Yetkazildi", "b-ok"],
  phone: ["Telefondan yuborildi", "b-ok"],
  fail: ["Yetkazilmadi", "b-late"],
} as const;

const RULES: [keyof Rules, string, string][] = [
  ["before", "Muddatdan 1 kun oldin", "Soat 10:00 da eslatiladi"],
  ["due", "Muddat kuni", "Ertalab 09:00 da eslatiladi"],
  ["after", "Muddat o'tgach", "Har 3 kunda eslatiladi"],
];

export default function RemindersPage() {
  const { can, sms } = useSession();
  const [tab, setTab] = useState("all");
  const { data, error, reload } = useApi<Resp>(`/reminders?status=${tab}`);
  const [draft, setDraft] = useState<string | null>(null);
  const tpl = draft ?? data?.template ?? "";
  const setTpl = (fn: string | ((t: string) => string)) => setDraft(typeof fn === "function" ? fn(tpl) : fn);
  const [overdue, setOverdue] = useState<Overdue[] | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(10);
  const area = useRef<HTMLTextAreaElement>(null);
  const editable = can("send_sms");
  const canSend = sms && editable;

  async function sendOverdue() {
    setBusy(true);
    try {
      const r = await api<{ items: Overdue[] }>("/reminders/overdue");
      if (!r.items.length) toast("Kechikkan mijoz yo'q");
      else {
        setDone([]);
        setOverdue(r.items);
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Bitta mijozga eslatma: jurnalga yoziladi va telefonning SMS ilovasi ochiladi
  async function sendTo(clientId: number, name: string) {
    try {
      const r = await api<{ phone: string; text: string }>(`/clients/${clientId}/remind`, { method: "POST" });
      setDone((d) => [...d, clientId]);
      openSms({ phone: r.phone, text: r.text, name });
      reload();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function saveTemplate() {
    try {
      await api("/reminders/settings", { method: "PUT", body: { template: tpl } });
      toast("Shablon saqlandi");
      setDraft(null);
      reload();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function setRule(k: keyof Rules, v: boolean) {
    await api("/reminders/settings", { method: "PUT", body: { rules: { [k]: v } } });
    reload();
  }

  function insert(token: string) {
    const el = area.current;
    if (!el) return setTpl((t) => t + token);
    const { selectionStart: a, selectionEnd: b } = el;
    setTpl((t) => t.slice(0, a) + token + t.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + token.length, a + token.length);
    });
  }

  return (
    <>
      <PageHead title="Eslatmalar" sub={sms ? "Qarz muddati haqida mijozlarga SMS eslatmalar" : "Qarz muddati yaqinlashgan va kechikkan mijozlar"}>
        {canSend && (
          <button className="btn btn-primary" onClick={sendOverdue} disabled={busy}>
            <Icon name="send" size={18} color="#fff" />
            {busy ? "Kuting…" : "Kechikkanlarga yuborish"}
          </button>
        )}
      </PageHead>

      <section aria-label="Eslatma ko'rsatkichlari" className="grid-stats">
        <Stat k="Bu oy yuborildi" v={`${data?.stats.sent ?? 0} ta`} s="Telefoningizdan" />
        <Stat k="Bugun yuborish kerak" v={`${data?.stats.dueToday ?? 0} ta`} color="var(--green)" />
        <Stat k="Rejalashtirilgan" v={`${data?.stats.planned ?? 0} ta`} />
        <Stat k="Kechikkan mijozlar" v={`${data?.stats.overdue ?? 0} ta`} color="var(--orange)" />
      </section>

      <div className="row-wrap">
        <section aria-label="Eslatmalar navbati" className="card" style={{ flex: "999 1 520px", minWidth: 0, overflow: "hidden" }}>
          <div className="tbl-head">
            <h2 className="h2" style={{ marginRight: "auto" }}>
              Navbat va tarix
            </h2>
            <div className="seg">
              {[
                ["all", "Barchasi"],
                ["plan", "Rejada"],
                ["sent", "Yuborilgan"],
              ].map(([k, label]) => (
                <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)} style={{ height: 32 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div style={{ padding: 16 }}>
              <ErrorBox text={error} onRetry={reload} />
            </div>
          )}
          {!data && !error && (
            <div style={{ padding: 16 }}>
              <Loading h={300} />
            </div>
          )}
          {data?.items.length === 0 && <div className="empty">Eslatma yo&apos;q</div>}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {data?.items.slice(0, limit).map((it, i) => (
              <div key={it.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "14px 16px", borderTop: i ? "1px solid var(--line-2)" : "none" }}>
                <Avatar text={it.initials} size={40} radius={12} fontSize={13} />
                <div style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{it.name}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{it.note}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, minWidth: 96, textAlign: "right" }}>{money(it.amount)}</span>
                <span style={{ fontSize: 13, color: "var(--ink-2)", minWidth: 92 }}>
                  {dm(it.at)} · {it.at.slice(11, 16)}
                </span>
                {it.status === "plan" && canSend && it.clientId && it.phone && it.at.slice(0, 10) <= todayIso() ? (
                  <button className="btn btn-primary btn-sm" onClick={() => sendTo(it.clientId!, it.name)}>
                    <Icon name="send" size={14} color="#fff" /> Yuborish
                  </button>
                ) : (
                  <span className={`badge ${ST[it.status][1]}`}>{ST[it.status][0]}</span>
                )}
              </div>
            ))}
          </div>
          {data && data.items.length > limit && (
            <div className="tbl-foot" style={{ justifyContent: "center" }}>
              <button className="btn btn-sm" onClick={() => setLimit((l) => l + 20)}>
                Ko&apos;proq ko&apos;rsatish ({data.items.length - limit})
              </button>
            </div>
          )}
        </section>

        <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 18 }}>
          {sms && (
          <section aria-label="SMS shabloni" className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 className="h2">SMS shabloni</h2>
            <label htmlFor="tpl" className="label">
              Xabar matni
            </label>
            <textarea id="tpl" ref={area} className="input" rows={5} value={tpl} disabled={!editable} onChange={(e) => setTpl(e.target.value.slice(0, 320))} style={{ fontSize: 13 }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {["{ism}", "{summa}", "{muddat}", "{dokon}"].map((t) => (
                <button key={t} disabled={!editable} onClick={() => insert(t)} style={{ height: 30, padding: "0 10px", borderRadius: 8, border: "1px dashed var(--green)", background: "#fff", color: "var(--green)", fontSize: 12, fontWeight: 700 }}>
                  {t}
                </button>
              ))}
              <span style={{ marginLeft: "auto", fontSize: 12, color: tpl.length > 160 ? "var(--orange)" : "var(--muted)" }}>{tpl.length} / 160 belgi</span>
            </div>
            {data?.preview && (
              <div style={{ padding: "12px 14px", borderRadius: "14px 14px 14px 4px", background: "var(--green-soft)", fontSize: 13, lineHeight: 1.5, color: "var(--green-deep)" }}>{data.preview}</div>
            )}
            {editable && tpl !== data?.template && (
              <button className="btn btn-primary" onClick={saveTemplate}>
                Shablonni saqlash
              </button>
            )}
          </section>
          )}

          <section aria-label="Avtomatik qoidalar" className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            <h2 className="h2" style={{ marginBottom: 8 }}>
              Avtomatik eslatish
            </h2>
            {RULES.map(([k, title, sub]) => (
              <label key={k} className="toggle-row">
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{sub}</span>
                </span>
                <Toggle on={!!data?.rules[k]} onChange={(v) => editable && setRule(k, v)} label={title} />
              </label>
            ))}
          </section>
        </div>
      </div>
      {overdue && (
        <Modal title="Kechikkanlarga eslatma" onClose={() => setOverdue(null)}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Har bir mijoz uchun &laquo;Yuborish&raquo;ni bosing — SMS o&apos;z telefoningizdan, tayyor matn bilan ketadi.
          </span>
          {overdue.map((o) => {
            const sent = done.includes(o.clientId);
            return (
              <div key={o.clientId} style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--line-2)", paddingTop: 10 }}>
                <Avatar text={o.initials} size={38} radius={12} status="late" fontSize={13} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{o.name}</span>
                  <span style={{ fontSize: 12, color: "var(--orange)", fontWeight: 600 }}>
                    {money(o.amount)} · {o.dueLabel}
                  </span>
                </div>
                {!o.phone ? (
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Raqam yo&apos;q</span>
                ) : (
                  <button className={`btn btn-sm${sent ? "" : " btn-primary"}`} onClick={() => sendTo(o.clientId, o.name)}>
                    {sent ? "Yana yuborish" : "Yuborish"}
                  </button>
                )}
              </div>
            );
          })}
        </Modal>
      )}
    </>
  );
}
