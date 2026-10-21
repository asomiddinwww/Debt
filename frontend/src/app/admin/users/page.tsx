"use client";

import { useState } from "react";
import { api, useApi } from "@/lib/api";
import { PageHead } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { ErrorBox, Field, Loading, Modal, Stat, Toggle, toast } from "@/components/ui";
import { useAdmin } from "@/components/adminCtx";
import { genPassword } from "@/components/adminParts";

type U = { id: number; name: string; phone: string; initials: string; store: string; roleLabel: string; role: string; device: string; lastLabel: string; status: string; hasPassword: boolean };
type Matrix = Record<string, { owner: boolean; manager: boolean; cashier: boolean }>;
type Resp = {
  users: U[];
  stats: { total: number; owners: number; staff: number; activeToday: number };
  permissions: { key: string; name: string }[];
  matrix: Matrix;
};

const ROLES = [
  ["all", "Barchasi"],
  ["owner", "Egalari"],
  ["manager", "Menejerlar"],
  ["cashier", "Kassirlar"],
] as const;
const STATUS: Record<string, [string, string]> = { active: ["Faol", "b-ok"], inactive: ["Nofaol", "b-paid"], blocked: ["Bloklangan", "b-late"] };

export default function UsersPage() {
  const [role, setRole] = useState("all");
  const [q, setQ] = useState("");
  const [editPerms, setEditPerms] = useState(false);
  const [user, setUser] = useState<U | null>(null);
  const [creating, setCreating] = useState(false);
  const [newPass, setNewPass] = useState("");
  const isSuper = useAdmin().user.role === "superadmin";
  const { data, error, reload } = useApi<Resp>(`/admin/users?role=${role}&q=${encodeURIComponent(q)}`);

  const mark = (v: boolean) => <span style={{ color: v ? "var(--green)" : "var(--gray-dot)", fontWeight: 800 }}>{v ? "✓" : "—"}</span>;

  async function setPassword(u: U) {
    try {
      await api(`/admin/users/${u.id}/password`, { method: "PUT", body: { password: newPass } });
      toast("Parol o'zgartirildi. Yangi parolni foydalanuvchiga yetkazing");
      setNewPass("");
      setUser(null);
      reload();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function removeUser(u: U) {
    if (!confirm(`${u.name} logini o'chirilsinmi? U tizimga kira olmaydi.`)) return;
    try {
      await api(`/admin/users/${u.id}`, { method: "DELETE" });
      toast("Login o'chirildi");
      setUser(null);
      reload();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function setStatus(u: U, status: string) {
    try {
      await api(`/admin/users/${u.id}`, { method: "PATCH", body: { status } });
      toast("Holat yangilandi");
      setUser(null);
      reload();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <>
      <PageHead title="Foydalanuvchilar" sub="Do'kon egalari va xodimlar hisoblari">
        <label htmlFor="au-search" className="search" style={{ width: 280, maxWidth: "100%" }}>
          <Icon name="search" size={18} color="var(--muted)" />
          <input id="au-search" placeholder="Ism yoki telefon…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {isSuper && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={18} color="#fff" sw={2.4} />
            Login yaratish
          </button>
        )}
      </PageHead>

      <section aria-label="Foydalanuvchi ko'rsatkichlari" className="grid-stats">
        <Stat k="Jami" v={<span style={{ fontSize: 24 }}>{data?.stats.total ?? "—"}</span>} />
        <Stat k="Do'kon egalari" v={<span style={{ fontSize: 24 }}>{data?.stats.owners ?? "—"}</span>} />
        <Stat k="Xodimlar" v={<span style={{ fontSize: 24 }}>{data?.stats.staff ?? "—"}</span>} />
        <Stat hero k="Bugun faol" v={<span style={{ fontSize: 24 }}>{data?.stats.activeToday ?? "—"}</span>} />
      </section>

      {error && <ErrorBox text={error} onRetry={reload} />}

      <div className="row-wrap">
        <section aria-label="Foydalanuvchilar jadvali" className="card" style={{ flex: "999 1 620px", minWidth: 0, overflow: "hidden" }}>
          <div className="tbl-head">
            {ROLES.map(([k, label]) => (
              <button key={k} className={`chip${role === k ? " on" : ""}`} onClick={() => setRole(k)}>
                {label}
              </button>
            ))}
          </div>
          <div className="tbl-wrap">
            <table className="tbl" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Foydalanuvchi</th>
                  <th>Do&apos;kon</th>
                  <th>Rol</th>
                  <th>Qurilma</th>
                  <th>Oxirgi kirish</th>
                  <th>Holat</th>
                </tr>
              </thead>
              <tbody>
                {data?.users.map((u) => (
                  <tr key={u.id} className="clickable" onClick={() => setUser(u)}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="av" style={{ width: 36, height: 36, borderRadius: "50%", fontSize: 12 }}>
                          {u.initials}
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ fontWeight: 700 }}>{u.name}</span>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>{u.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>{u.store}</td>
                    <td>
                      <span className="tag">{u.roleLabel}</span>
                    </td>
                    <td style={{ color: "var(--ink-2)" }}>{u.device || "—"}</td>
                    <td style={{ color: "var(--ink-2)" }}>{u.lastLabel}</td>
                    <td>
                      <span className={`badge ${STATUS[u.status]?.[1]}`}>{STATUS[u.status]?.[0]}</span>
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
            {data?.users.length === 0 && <div className="empty">Foydalanuvchi topilmadi</div>}
          </div>
        </section>

        <section aria-label="Rollar va ruxsatlar" className="card card-pad" style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="h2">Rollar va ruxsatlar</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--muted)", fontSize: 12, textAlign: "center" }}>
                <th style={{ padding: "8px 4px", textAlign: "left", fontWeight: 700 }}>Ruxsat</th>
                <th style={{ padding: "8px 4px", fontWeight: 700 }}>Egasi</th>
                <th style={{ padding: "8px 4px", fontWeight: 700 }}>Menejer</th>
                <th style={{ padding: "8px 4px", fontWeight: 700 }}>Kassir</th>
              </tr>
            </thead>
            <tbody>
              {data?.permissions.map((p) => (
                <tr key={p.key} style={{ borderTop: "1px solid var(--line-2)", textAlign: "center" }}>
                  <td style={{ padding: "10px 4px", textAlign: "left", fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: "10px 4px" }}>{mark(!!data.matrix[p.key]?.owner)}</td>
                  <td style={{ padding: "10px 4px" }}>{mark(!!data.matrix[p.key]?.manager)}</td>
                  <td style={{ padding: "10px 4px" }}>{mark(!!data.matrix[p.key]?.cashier)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn" style={{ height: 42, fontSize: 13, fontWeight: 700 }} onClick={() => setEditPerms(true)}>
            Ruxsatlarni tahrirlash
          </button>
        </section>
      </div>

      {editPerms && data && <PermsModal perms={data.permissions} matrix={data.matrix} onClose={() => setEditPerms(false)} onSaved={reload} />}
      {creating && <CreateLoginModal onClose={() => setCreating(false)} onSaved={reload} />}
      {user && (
        <Modal
          title={user.name}
          onClose={() => {
            setUser(null);
            setNewPass("");
          }}
        >
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            {user.store} · {user.roleLabel} · {user.phone}
          </div>
          {!isSuper && <span style={{ fontSize: 13, color: "var(--muted)" }}>Loginlarni faqat super admin boshqaradi.</span>}
          {isSuper && (
            <>
              {!user.hasPassword && <div className="err">Bu foydalanuvchiga parol berilmagan — u kira olmaydi.</div>}
              <Field label="Yangi parol" id="u-pass">
                <input id="u-pass" className="input" autoComplete="new-password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="kamida 6 belgi" />
              </Field>
              <button className="btn btn-primary" disabled={newPass.length < 6} onClick={() => setPassword(user)}>
                Parolni o&apos;rnatish
              </button>
          {user.status !== "active" && (
            <button className="btn btn-outline" onClick={() => setStatus(user, "active")}>
              Faollashtirish
            </button>
          )}
          {user.status === "active" && (
            <button className="btn" onClick={() => setStatus(user, "inactive")}>
              Nofaol qilish
            </button>
          )}
          {user.status !== "blocked" && (
            <button className="btn btn-danger" onClick={() => setStatus(user, "blocked")}>
              Bloklash
            </button>
          )}
          <button className="btn btn-danger" onClick={() => removeUser(user)}>
            <Icon name="trash" size={16} /> Loginni o&apos;chirish
          </button>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

function PermsModal({ perms, matrix, onClose, onSaved }: { perms: { key: string; name: string }[]; matrix: Matrix; onClose: () => void; onSaved: () => void }) {
  const [m, setM] = useState<Matrix>(structuredClone(matrix));
  return (
    <Modal title="Ruxsatlarni tahrirlash" onClose={onClose}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>Do&apos;kon egasi barcha ruxsatlarga ega.</span>
      {perms.map((p) => (
        <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--line-2)", paddingTop: 10 }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{p.name}</span>
          {(["manager", "cashier"] as const).map((r) => (
            <label key={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
              {r === "manager" ? "Menejer" : "Kassir"}
              <Toggle on={!!m[p.key]?.[r]} onChange={(v) => setM({ ...m, [p.key]: { ...m[p.key], owner: true, [r]: v } })} label={`${p.name} — ${r}`} />
            </label>
          ))}
        </div>
      ))}
      <button
        className="btn btn-primary"
        style={{ height: 48 }}
        onClick={async () => {
          await api("/admin/permissions", { method: "PUT", body: { matrix: m } });
          toast("Ruxsatlar saqlandi");
          onSaved();
          onClose();
        }}
      >
        Saqlash
      </button>
    </Modal>
  );
}

function CreateLoginModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { data } = useApi<{ stores: { id: number; name: string; city: string }[] }>("/admin/stores");
  const [f, setF] = useState({ storeId: "", name: "", phone: "", role: "cashier", password: "" });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setErr(null);
    try {
      await api("/admin/users", { body: f });
      toast("Login yaratildi. Telefon va parolni foydalanuvchiga yetkazing");
      onSaved();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <Modal title="Login yaratish" onClose={onClose}>
      <Field label="Do'kon" id="cl-store">
        <select id="cl-store" className="input" value={f.storeId} onChange={set("storeId")}>
          <option value="">— Do&apos;konni tanlang —</option>
          {data?.stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.city}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Ism" id="cl-name">
        <input id="cl-name" className="input" value={f.name} onChange={set("name")} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <Field label="Login (telefon raqam)" id="cl-phone">
          <input id="cl-phone" className="input" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="90 123 45 67" />
        </Field>
        <Field label="Rol" id="cl-role">
          <select id="cl-role" className="input" value={f.role} onChange={set("role")}>
            <option value="cashier">Kassir</option>
            <option value="manager">Menejer</option>
            <option value="owner">Egasi</option>
          </select>
        </Field>
      </div>
      <Field label="Parol (kamida 6 belgi)" id="cl-pass">
        <div style={{ display: "flex", gap: 8 }}>
          <input id="cl-pass" className="input" autoComplete="new-password" value={f.password} onChange={set("password")} />
          <button type="button" className="btn" style={{ height: 46, flexShrink: 0 }} onClick={() => setF({ ...f, password: genPassword() })}>
            Yaratish
          </button>
        </div>
      </Field>
      {err && <div className="err">{err}</div>}
      <button className="btn btn-primary" style={{ height: 48 }} onClick={save}>
        Yaratish
      </button>
    </Modal>
  );
}
