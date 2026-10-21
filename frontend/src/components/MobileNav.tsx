"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/m", label: "Asosiy", icon: "home" },
  { href: "/m/clients", label: "Mijozlar", icon: "users" },
  { href: "/m/reports", label: "Hisobot", icon: "chart" },
  { href: "/m/settings", label: "Sozlamalar", icon: "settings" },
];

export function MobileNav() {
  const path = usePathname();
  const link = (i: (typeof ITEMS)[number]) => {
    const on = path === i.href;
    return (
      <Link key={i.href} href={i.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
        <Icon name={i.icon} size={22} sw={on ? 2 : 1.8} />
        {i.label}
      </Link>
    );
  };
  return (
    <nav aria-label="Asosiy menyu" className="m-nav">
      {ITEMS.slice(0, 2).map(link)}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Link href="/m/add" aria-label="Yangi qarz qo'shish" className="m-fab">
          <Icon name="plus" size={26} color="#fff" sw={2.4} />
        </Link>
      </div>
      {ITEMS.slice(2).map(link)}
    </nav>
  );
}
