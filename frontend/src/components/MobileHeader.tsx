import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** Orqaga tugmasi, sarlavha va o'ng tomondagi amal */
export function MobileHeader({ title, back = "/m", right, icon = "back" }: { title: ReactNode; back?: string; right?: ReactNode; icon?: "back" | "close" }) {
  return (
    <div style={{ padding: "28px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Link href={back} aria-label={icon === "close" ? "Yopish" : "Orqaga"} className="icon-btn">
        <Icon name={icon} size={icon === "close" ? 20 : 22} />
      </Link>
      <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
      {right ?? <span style={{ width: 44 }} />}
    </div>
  );
}
