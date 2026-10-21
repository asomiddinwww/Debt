import { SessionProvider } from "@/components/session";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <SessionProvider>{children}</SessionProvider>;
}
