"use client";

import { useState } from "react";
import { api, useApi } from "@/lib/api";
import { dmy, initials, ROLE_LABEL } from "@/lib/format";
import type { Store, User } from "@/lib/types";
import { useSession } from "@/components/session";
import { PageHead } from "@/components/Shell";
import { Avatar, Loading, Toggle, toast } from "@/components/ui";
import { StaffModal } from "@/components/StoreModals";

type Prefs = { dailyReport: boolean; overdueAlert: boolean; bigDebt: boolean; sms: boolean; pin: boolean };
type Resp = { store: Store; prefs: Prefs; staff: (User & { initials: string })[] };

const TABS = ["Umumiy", "Xodimlar", "Bildirishnomalar", "Xavfsizlik", "Obuna"] as const;
const FIELDS: [keyof Store, string, string][] = [
  ["name", "Do'kon nomi", ""],
  ["branch", "Filial", "Masalan: Chilonzor filiali"],
  ["phone", "Telefon", "+998 71 ___ __ __"],
  ["address", "Manzil", "Ko'cha, uy raqami"],
  ["inn", "STIR (INN)", "ixtiyoriy"],
  ["telegram", "Telegram", "@dokon_username"],
];
const PREFS: [keyof Prefs, string][] = [
  ["dailyReport", "Har kuni kechqurun hisobot"],
  ["overdueAlert", "Muddat o'tganda ogohlantirish"],
  ["bigDebt", "Katta qarz qo'shilganda"],
];

export default function SettingsPage() {
  const { can, reload: reloadMe, logout, sms } = useSession();
  const { data, reload } = useApi<Resp>("/settings");
  const [tab, setTab] = useState<(typeof TABS)[number]>("Umumiy");
  const [draft, setForm] = useState<Partial<Store> | null>(null);
  const form: Partial<Store> = draft ?? data?.store ?? {};
  const [staffOpen, setStaffOpen] = useState(false);
  const editable = can("manage_staff");

  async function save() {
    try {
      await api("/settings/store", { method: "PUT", body: form });
      toast("O'zgarishlar saqlandi");
      setForm(null);
      reload();
      reloadMe();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function setPref(k: keyof Prefs, v: boolean) {
    await api("/settings/prefs", { method: "PUT", body: { [k]: v } });
    reload();
  }

  if (!data) return <Loading h={400} />;

  const staffCard = (
    <section aria-label="Xodimlar" className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 className="h2">Xodimlar</h2>
        {editable && (
          <button className="btn btn-outline btn-sm" onClick={() => setStaffOpen(true)}>
            Boshqarish
          </button>
        )}
      </div>
      {data.staff.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 10, borderTop: "1px solid var(--line-2)" }}>
          <Avatar text={s.initials} size={38} radius={12} fontSize={13} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{s.name}</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{s.phone}</span>
          </div>
          <span className="tag">{ROLE_LABEL[s.role]}</span>
        </div>
      ))}
    </section>
  );

  const prefsCard = (
    <section aria-label="Bildirishnomalar" className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <h2 className="h2" style={{ marginBottom: 8 }}>
        Menga xabar berish
      </h2>
      {PREFS.map(([k, title]) => (
        <label key={k} className="toggle-row">
          <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
          <Toggle on={!!data.prefs[k]} onChange={(v) => setPref(k, v)} label={title} />
        </label>
      ))}
    </section>
  );

  return (
    <>
      <PageHead title="Sozlamalar" sub="Do'kon, xodimlar va ilova sozlamalari">
        {tab === "Umumiy" && editable && (
          <>
            <button className="btn" onClick={() => setForm(null)}>
              Bekor qilish
            </button>
            <button className="btn btn-primary" onClick={save}>
              O&apos;zgarishlarni saqlash
            </button>
          </>
        )}
      </PageHead>

      <div role="tablist" aria-label="Sozlamalar bo'limlari" style={{ display: "flex", flexWrap: "wrap", gap: 4, borderBottom: "1px solid var(--line)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            style={{ height: 42, padding: "0 14px", border: "none", borderBottom: `2.5px solid ${tab === t ? "var(--green)" : "transparent"}`, background: "transparent", color: tab === t ? "var(--green)" : "var(--muted)", fontSize: 14, fontWeight: tab === t ? 700 : 600 }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Umumiy" && (
        <div className="row-wrap">
          <section aria-label="Do'kon ma'lumotlari" className="card card-pad" style={{ flex: "999 1 480px", minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 className="h2">Do&apos;kon ma&apos;lumotlari</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar text={initials(form.name || "")} size={64} radius={18} fontSize={22} />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{data.store.name}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  ID: {data.store.code} · {data.store.plan?.name} tarifi
                </span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              {FIELDS.map(([k, label, ph]) => (
                <div key={k} className="field">
                  <label htmlFor={`f-${k}`} className="label">
                    {label}
                  </label>
                  <input id={`f-${k}`} className="input" disabled={!editable} placeholder={ph} value={(form[k] as string) ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <div className="field">
                <label htmlFor="s-cur" className="label">
                  Asosiy valyuta
                </label>
                <select id="s-cur" className="input" disabled={!editable} value={form.currency || "UZS"} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option value="UZS">O&apos;zbek so&apos;mi (UZS)</option>
                  <option value="USD">AQSh dollari (USD)</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="s-lang" className="label">
                  Tizim tili
                </label>
                <select id="s-lang" className="input" disabled value="uz">
                  <option value="uz">O&apos;zbekcha (lotin)</option>
                </select>
              </div>
            </div>
          </section>
          <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 18 }}>
            {staffCard}
            {prefsCard}
          </div>
        </div>
      )}

      {tab === "Xodimlar" && <div style={{ maxWidth: 640 }}>{staffCard}</div>}
      {tab === "Bildirishnomalar" && <div style={{ maxWidth: 640 }}>{prefsCard}</div>}

      {tab === "Xavfsizlik" && (
        <section className="card card-pad" style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 className="h2" style={{ marginBottom: 8 }}>
            Xavfsizlik
          </h2>
          {sms && (
          <label className="toggle-row">
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>SMS eslatmalar</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Muddat kelganda SMS yuborishni eslatish</span>
            </span>
            <Toggle on={data.prefs.sms} onChange={(v) => setPref("sms", v)} label="SMS eslatmalar" />
          </label>
          )}
          <label className="toggle-row">
            <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>PIN-kod bilan kirish</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Mobil ilovada qo&apos;shimcha himoya</span>
            </span>
            <Toggle on={data.prefs.pin} onChange={(v) => setPref("pin", v)} label="PIN-kod" />
          </label>
          <div style={{ paddingTop: 12, borderTop: "1px solid var(--line-2)" }}>
            <button className="btn btn-danger" onClick={logout}>
              Tizimdan chiqish
            </button>
          </div>
        </section>
      )}

      {tab === "Obuna" && (
        <section className="card card-pad" style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 className="h2">Obuna</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
            {[
              ["Tarif", data.store.plan?.name || "—"],
              ["Holat", data.store.status === "active" ? "Faol" : data.store.status === "trial" ? "Sinov" : "Bloklangan"],
              ["Obuna tugashi", dmy(data.store.subUntil)],
              ["SMS limiti (oy)", data.store.plan ? `${data.store.plan.smsLimit} ta` : "—"],
            ].map(([k, v]) => (
              <div key={k} style={{ padding: 12, borderRadius: 12, background: "var(--soft)", display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{k}</span>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{v}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Tarifni o&apos;zgartirish yoki uzaytirish uchun platforma administratoriga murojaat qiling.</span>
        </section>
      )}

      {staffOpen && <StaffModal staff={data.staff} editable={editable} onClose={() => setStaffOpen(false)} onSaved={reload} />}
    </>
  );
}
