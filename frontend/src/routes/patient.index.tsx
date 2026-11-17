import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Calendar, Clock, MapPin, Sparkles, MessageSquare, Search, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/store/auth";
import { useDoctors } from "@/hooks/useDoctors";
import { appointmentStatusLabel, usePatientAppointments } from "@/hooks/useAppointments";

export const Route = createFileRoute("/patient/")({ component: PatientHome });

function PatientHome() {
  const user = useAuth((s) => s.user);

  const { data: apiDoctors } = useDoctors();
  const recommended = React.useMemo(() => {
    if (!apiDoctors) return [];
    return apiDoctors.slice(0, 3).map((d) => ({
      id: d.id,
      userId: d.userId,
      name: d.fullName ?? d.user?.fullName ?? "Doctor",
      specialty: d.specialty || "General",
    }));
  }, [apiDoctors]);

  const { data: apiAppointments } = usePatientAppointments(user?.id);
  const next = React.useMemo(() => {
    const upcoming = apiAppointments?.filter((a) => a.status === 0 || a.status === 1) ?? [];
    if (upcoming.length === 0) return null;
    const a = upcoming[0];
    return {
      doctorName: a.doctorProfile?.user?.fullName || a.doctorProfile?.fullName || "Doctor",
      doctorSpecialty: a.doctorProfile?.specialty || "Specialist",
      reason: a.reason,
      status: appointmentStatusLabel[a.status] ?? "pending",
      date: new Date(a.appointmentDate).toLocaleDateString(),
      time: new Date(a.appointmentDate).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  }, [apiAppointments]);

  const upcomingAppointmentsLength =
    apiAppointments?.filter((a) => a.status === 0 || a.status === 1).length || 0;

  return (
    <div className="space-y-6">
      {/* Hero card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative overflow-hidden p-8 bg-gradient-hero text-primary-foreground border-0 shadow-elegant">
          <div className="absolute inset-0 bg-gradient-mesh opacity-30" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-sm opacity-80">Welcome back,</p>
              <h1 className="text-3xl font-bold mt-1">{user?.name?.split(" ")[0]} 👋</h1>
              <p className="mt-2 text-primary-foreground/80 max-w-md">
                You have <strong>{upcomingAppointmentsLength}</strong> upcoming appointments. Stay
                on top of your health.
              </p>
            </div>
            <Link to="/patient/doctors">
              <Button size="lg" variant="secondary" className="shadow-elegant">
                Find a doctor <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left col */}
        <div className="lg:col-span-2 space-y-6">
          {/* Next appointment */}
          {next && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Your next appointment</h2>
                <Link to="/patient/appointments" className="text-xs text-primary hover:underline">
                  View all →
                </Link>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-gradient-soft border">
                <div className="h-14 w-14 rounded-full bg-gradient-hero grid place-items-center text-primary-foreground font-bold text-xl shrink-0">
                  {next.doctorName[0]}
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{next.doctorName}</p>
                  <p className="text-sm text-muted-foreground">
                    {next.doctorSpecialty} · {next.reason}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {next.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {next.time}
                    </span>
                  </div>
                </div>
                <Badge variant="secondary">{next.status}</Badge>
              </div>
            </Card>
          )}

          {/* Recommended doctors */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Recommended for you</h2>
              <Link to="/patient/doctors" className="text-xs text-primary hover:underline">
                See all →
              </Link>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {recommended.map((d) => (
                <Link key={d.id} to="/patient/doctors/$id" params={{ id: d.id }} className="group">
                  <div className="rounded-xl border p-4 hover:shadow-elegant hover:border-primary/40 transition">
                    <div className="h-12 w-12 rounded-full bg-gradient-hero grid place-items-center text-primary-foreground font-bold mb-3">
                      {d.name[0]}
                    </div>
                    <p className="font-medium text-sm">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.specialty}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* Right col */}
        <div className="space-y-6">
          {/* AI shortcut */}
          <Link to="/patient/assistant">
            <Card className="p-6 bg-gradient-soft border-primary/20 hover:shadow-elegant transition cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-hero grid place-items-center shadow-glow">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">AI Medical Assistant</p>
                  <p className="text-xs text-muted-foreground">Ask anything, anytime</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition" />
              </div>
            </Card>
          </Link>

          {/* Quick actions */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Quick actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <QuickAction icon={Search} label="Find doctor" to="/patient/doctors" />
              <QuickAction icon={MessageSquare} label="Messages" to="/patient/messages" />
              <QuickAction icon={Calendar} label="Schedule" to="/patient/appointments" />
              <QuickAction icon={MapPin} label="Near me" to="/patient/doctors" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1 py-4 rounded-lg border hover:border-primary hover:bg-accent transition"
    >
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
