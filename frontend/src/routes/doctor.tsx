import { createFileRoute, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, Users, MessageCircle, UserCircle } from "lucide-react";
import { DashboardShell, type NavItem } from "@/components/layout/DashboardShell";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export const Route = createFileRoute("/doctor")({ component: DoctorLayout });

const nav: NavItem[] = [
  { label: "Overview", to: "/doctor", icon: LayoutDashboard },
  { label: "Appointments", to: "/doctor/appointments", icon: Users },
  { label: "Conversations", to: "/doctor/conversations", icon: MessageCircle },
  { label: "Profile", to: "/doctor/profile", icon: UserCircle },
];

function DoctorLayout() {
  useAuthGuard("doctor");
  return (
    <DashboardShell nav={nav} variant="doctor">
      <Outlet />
    </DashboardShell>
  );
}
