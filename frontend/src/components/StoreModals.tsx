"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/format";
import type { Store, User } from "@/lib/types";
import { Icon } from "./Icon";
import { Avatar, Field, Modal, toast } from "./ui";

export function StoreModal({ store, editable, onClose, onSaved }: { store: Store; editable: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: store.name, branch: store.branch, phone: store.phone, address: store.address });
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal title="Do'kon ma'lumotlari" onClose={onClose}>
      {(["name", "branch", "phone", "address"] as const).map((k) => (
        <Field key={k} label={{ name: "Do'kon nomi", branch: "Filial", phone: "Telefon", address: "Manzil" }[k]} id={`st-${k}`}>
          <input id={`st-${k}`} className="input" disabled={!editable} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        </Field>
      ))}
      {err && <div className="err">{err}</div>}
      {editable && (
        <button
          className="btn btn-primary"
          style={{ height: 48 }}
          onClick={async () => {
            try {
              await api("/settings/store", { method: "PUT", body: f });
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
      )}
    </Modal>
  );
}

export function StaffModal({ staff, editable, onClose, onSaved }: { staff: (User & { initials: string })[]; editable: boolean; onClose: () => void; onSaved: () => void }) {
  return (
    <Modal title="Xodimlar" onClose={onClose}>
      {staff.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar text={s.initials} size={38} radius={12} fontSize={13} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{s.name}</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>{s.phone}</span>
          </div>
          <span className="tag">{ROLE_LABEL[s.role]}</span>
          {editable && s.role !== "owner" && (
            <button
              className="icon-btn icon-btn-sm"
              aria-label={`${s.name}ni o'chirish`}
              onClick={async () => {
                if (!confirm(`${s.name} o'chirilsinmi?`)) return;
                await api(`/staff/${s.id}`, { method: "DELETE" });
                onSaved();
              }}
            >
              <Icon name="trash" size={16} color="var(--orange)" />
            </button>
          )}
        </div>
      ))}
      <span style={{ fontSize: 12, color: "var(--muted)", borderTop: "1px solid var(--line-2)", paddingTop: 12 }}>
        Yangi xodim uchun login va parolni platforma administratori yaratadi.
      </span>
    </Modal>
  );
}
