import { SessionProvider } from "@/components/session";

export default function MobileLayout({ children }: LayoutProps<"/m">) {
  return <SessionProvider fallback={<div className="m-shell" />}>{children}</SessionProvider>;
}
