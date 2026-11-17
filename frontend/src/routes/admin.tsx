import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Gauge, FileCheck, Users } from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/layout/DashboardShell";
import { useAuth } from "@/store/auth";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

const nav: NavItem[] = [
  { label: "Overview", to: "/admin", icon: Gauge },
  { label: "Applications", to: "/admin/applications", icon: FileCheck },
  { label: "Users", to: "/admin/users", icon: Users },
];

function AdminLayout() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) navigate({ to: "/login" });
    else if (user.role !== "admin")
      navigate({ to: user.role === "doctor" ? "/doctor" : "/patient" });
  }, [user, navigate]);
  return (
    <DashboardShell nav={nav} variant="admin">
      <Outlet />
    </DashboardShell>
  );
}
