"use client";

import { useState, type ReactNode } from "react";
import { api, downloadUrl, useApi } from "@/lib/api";
import { initials, ROLE_LABEL } from "@/lib/format";
import type { Store, User } from "@/lib/types";
import { useSession } from "@/components/session";
import { MobileNav } from "@/components/MobileNav";
import { Icon, type IconName } from "@/components/Icon";
import { Avatar, Field, Modal, Toggle, toast } from "@/components/ui";
import { StaffModal, StoreModal } from "@/components/StoreModals";

type Prefs = { dailyReport: boolean; overdueAlert: boolean; bigDebt: boolean; sms: boolean; pin: boolean };
type Resp = { store: Store; prefs: Prefs; staff: (User & { initials: string })[]; lastBackup: string };

function Row({ icon, label, first, children, onClick, href }: { icon: IconName; label: string; first?: boolean; children: ReactNode; onClick?: () => void; href?: string }) {
  const style: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "0 14px", height: 52, width: "100%", background: "#fff", borderLeft: "none", borderRight: "none", borderBottom: "none", borderTop: first ? "none" : "1px solid var(--line-2)", textAlign: "left", color: "var(--ink)", textDecoration: "none" };
  const inner = (
    <>
      <span style={{ width: 32, height: 32, borderRadius: 10, background: "var(--green-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={icon} size={17} color="var(--green)" />
      </span>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{label}</span>
      {children}
    </>
  );
  if (href) return <a href={href} style={style}>{inner}</a>;
  if (onClick) return <button onClick={onClick} style={style}>{inner}</button>;
  return <label style={{ ...style, cursor: "pointer" }}>{inner}</label>;
}

const Chevron = ({ value }: { value: string }) => (
  <>
    <span style={{ fontSize: 13, color: "var(--muted)" }}>{value}</span>
    <Icon name="chevronRight" size={18} color="var(--gray-dot)" />
  </>
);

export default function MobileSettings() {
  const { me, logout, can, reload: reloadMe, sms } = useSession();
  const { data, reload } = useApi<Resp>("/settings");
  const [modal, setModal] = useState<null | "profile" | "store" | "staff" | "currency">(null);

  async function setPref(key: keyof Prefs, v: boolean) {
    await api("/settings/prefs", { method: "PUT", body: { [key]: v } });
    reload();
  }

  const prefs = data?.prefs;
  return (
    <div className="m-shell">
      <div style={{ padding: "28px 20px 0" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: -0.3 }}>Sozlamalar</h1>
      </div>

      <button
        onClick={() => setModal("profile")}
        className="m-card"
        style={{ margin: "16px 20px 0", padding: 14, borderRadius: 20, display: "flex", alignItems: "center", gap: 12, textAlign: "left", color: "var(--ink)" }}
      >
        <Avatar text={initials(me.user.name)} size={52} radius={16} fontSize={18} style={{ background: "var(--green)", color: "#fff" }} />
        <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{me.user.name}</span>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {me.store?.name} · {ROLE_LABEL[me.user.role] || me.user.role}
          </span>
        </span>
        <Icon name="chevronRight" size={20} color="var(--muted)" />
      </button>

      <div style={{ margin: "18px 20px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="m-section-title">Do&apos;kon</span>
        <div className="m-card" style={{ overflow: "hidden" }}>
          <Row icon="store" label="Do'kon ma'lumotlari" first onClick={() => setModal("store")}>
            <Chevron value={data?.store.name || me.store?.name || ""} />
          </Row>
          <Row icon="user" label="Xodimlar" onClick={() => setModal("staff")}>
            <Chevron value={data ? `${data.staff.length} kishi` : ""} />
          </Row>
          <Row icon="dollar" label="Valyuta" onClick={() => can("manage_staff") && setModal("currency")}>
            <Chevron value={data?.store.currency || "UZS"} />
          </Row>
        </div>
      </div>

      <div style={{ margin: "18px 20px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="m-section-title">Ilova</span>
        <div className="m-card" style={{ overflow: "hidden" }}>
          {sms && (
            <Row icon="msg" label="SMS eslatmalar" first>
              <Toggle on={!!prefs?.sms} onChange={(v) => setPref("sms", v)} label="SMS eslatmalar" />
            </Row>
          )}
          <Row icon="lock" label="PIN-kod bilan kirish" first={!sms}>
            <Toggle on={!!prefs?.pin} onChange={(v) => setPref("pin", v)} label="PIN-kod bilan kirish" />
          </Row>
          <Row icon="globe" label="Til" onClick={() => toast("Hozircha faqat o'zbek tili mavjud")}>
            <Chevron value="O'zbekcha" />
          </Row>
          <Row icon="cloud" label="Zaxira nusxa" href={downloadUrl("/export/debts.csv")}>
            <Chevron value="Yuklab olish" />
          </Row>
        </div>
      </div>

      <button
        onClick={logout}
        style={{ margin: "18px 20px 0", height: 52, borderRadius: 18, background: "#fff", border: "1px solid var(--orange-line)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--orange)", fontSize: 15, fontWeight: 700 }}
      >
        <Icon name="logout" size={18} color="var(--orange)" />
        Chiqish
      </button>

      <MobileNav />

      {modal === "profile" && <ProfileModal name={me.user.name} onClose={() => setModal(null)} onSaved={reloadMe} />}
      {modal === "store" && data && <StoreModal store={data.store} editable={can("manage_staff")} onClose={() => setModal(null)} onSaved={reload} />}
      {modal === "staff" && data && <StaffModal staff={data.staff} editable={can("manage_staff")} onClose={() => setModal(null)} onSaved={reload} />}
      {modal === "currency" && data && <CurrencyModal store={data.store} onClose={() => setModal(null)} onSaved={reload} />}
    </div>
  );
}

function ProfileModal({ name, onClose, onSaved }: { name: string; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState(name);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title="Profil" onClose={onClose}>
      <Field label="Ismingiz" id="pf-name">
        <input id="pf-name" className="input" value={v} onChange={(e) => setV(e.target.value)} />
      </Field>
      {err && <div className="err">{err}</div>}
      <button
        className="btn btn-primary"
        style={{ height: 48 }}
        onClick={async () => {
          try {
            await api("/settings/profile", { method: "PUT", body: { name: v } });
            toast("Saqlandi");
            onSaved();
            onClose();
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        Saqlash
      </button>
    </Modal>
  );
}

function CurrencyModal({ store, onClose, onSaved }: { store: Store; onClose: () => void; onSaved: () => void }) {
  return (
    <Modal title="Asosiy valyuta" onClose={onClose}>
      {[
        ["UZS", "O'zbek so'mi (UZS)"],
        ["USD", "AQSh dollari (USD)"],
      ].map(([k, label]) => (
        <button
          key={k}
          className={`btn${store.currency === k ? " btn-outline" : ""}`}
          style={{ justifyContent: "flex-start" }}
          onClick={async () => {
            await api("/settings/store", { method: "PUT", body: { currency: k } });
            onSaved();
            onClose();
          }}
        >
          {label}
        </button>
      ))}
    </Modal>
  );
}
