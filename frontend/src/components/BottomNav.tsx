"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import type { NavItem } from "./Shell";

const isOn = (path: string, href: string) => path === href || (href !== "/admin" && path.startsWith(href + "/"));

/**
 * Telefon uchun pastki navigatsiya (faqat 860px dan tor ekranda ko'rinadi).
 * Oxirgi tugma "Menyu" — to'liq menyuni pastdan chiqadigan oynada ochadi.
 */
export function BottomNav({ items, menu, footer, fab }: { items: NavItem[]; menu: NavItem[]; footer?: ReactNode; fab?: { label: string; onClick: () => void } }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const link = (n: NavItem) => {
    const on = isOn(path, n.href);
    return (
      <Link key={n.href} href={n.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
        <Icon name={n.icon} size={22} sw={on ? 2 : 1.8} />
        {n.label}
      </Link>
    );
  };
  // Pastki panelda ko'rinmagan sahifa ochiq bo'lsa, "Menyu" faol ko'rinadi
  const menuOn = !items.some((n) => isOn(path, n.href));
  const half = fab ? Math.ceil(items.length / 2) : items.length;
  const cols = items.length + 1 + (fab ? 1 : 0);

  return (
    <>
      <nav aria-label="Asosiy menyu" className="bnav" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {items.slice(0, half).map(link)}
        {fab && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button aria-label={fab.label} className="m-fab" style={{ border: "none" }} onClick={fab.onClick}>
              <Icon name="plus" size={26} color="#fff" sw={2.4} />
            </button>
          </div>
        )}
        {items.slice(half).map(link)}
        <button className={`bnav-btn${menuOn ? " on" : ""}`} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
          <Icon name="menu" size={22} sw={menuOn ? 2 : 1.8} />
          Menyu
        </button>
      </nav>

      {open && (
        <div className="sheet-back" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Menyu">
            <div className="sheet-grip" />
            {menu.map((n) => {
              const on = isOn(path, n.href);
              return (
                <Link key={n.href} href={n.href} className={`nav-link${on ? " on" : ""}`} aria-current={on ? "page" : undefined} onClick={() => setOpen(false)}>
                  <Icon name={n.icon} size={20} />
                  {n.label}
                  {!!n.badge && (
                    <span style={{ marginLeft: "auto", fontSize: 12, background: "var(--green)", color: "#fff", padding: "2px 8px", borderRadius: 999 }}>{n.badge}</span>
                  )}
                </Link>
              );
            })}
            {footer && <div style={{ marginTop: 10 }}>{footer}</div>}
          </div>
        </div>
      )}
    </>
  );
}
