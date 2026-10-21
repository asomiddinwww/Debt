"use client";

import { useEffect, useState } from "react";
import { Modal, toast } from "./ui";

type Msg = { phone: string; text: string; name?: string };

/** Telefonning SMS ilovasini raqam va tayyor matn bilan ochadigan havola */
export function smsHref(phone: string, text: string) {
  const to = phone.replace(/[^\d+]/g, "");
  // iOS / macOS "&body=", Android "?body=" formatini kutadi
  const apple = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent);
  return `sms:${to}${apple ? "&" : "?"}body=${encodeURIComponent(text)}`;
}

const isPhone = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

let setter: ((m: Msg | null) => void) | null = null;

/**
 * SMSni do'kon egasining o'z telefonidan yuborish.
 * Telefonda SMS ilovasi darhol ochiladi; kompyuterda matnni nusxalash oynasi chiqadi.
 */
export function openSms(msg: Msg) {
  if (isPhone()) {
    window.location.href = smsHref(msg.phone, msg.text);
    return;
  }
  setter?.(msg);
}

export function SmsHost() {
  const [msg, setMsg] = useState<Msg | null>(null);
  useEffect(() => {
    setter = setMsg;
    return () => {
      setter = null;
    };
  }, []);
  if (!msg) return null;

  return (
    <Modal title="SMS yuborish" onClose={() => setMsg(null)}>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>
        SMS o&apos;z telefoningizdan ketadi. Matnni nusxalab telefoningizdan yuboring yoki Mac&apos;da &laquo;Messages&raquo; orqali oching.
      </span>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
        <span style={{ color: "var(--muted)" }}>Kimga</span>
        <b>
          {msg.name ? `${msg.name} · ` : ""}
          {msg.phone}
        </b>
      </div>
      <div style={{ padding: "12px 14px", borderRadius: "14px 14px 14px 4px", background: "var(--green-soft)", fontSize: 14, lineHeight: 1.5, color: "var(--green-deep)" }}>{msg.text}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          className="btn"
          onClick={() =>
            navigator.clipboard?.writeText(msg.text).then(
              () => toast("Matn nusxalandi"),
              () => toast("Nusxalab bo'lmadi"),
            )
          }
        >
          Matnni nusxalash
        </button>
        <a className="btn btn-primary" href={smsHref(msg.phone, msg.text)}>
          Messages&apos;da ochish
        </a>
      </div>
    </Modal>
  );
}
