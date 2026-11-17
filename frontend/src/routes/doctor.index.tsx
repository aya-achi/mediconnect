import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, Users, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BarChart, Bar, XAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { useAuth } from "@/store/auth";
import { appointmentStatusLabel, useDoctorAppointments } from "@/hooks/useAppointments";
import { initials } from "@/lib/utils";

export const Route = createFileRoute("/doctor/")({ component: DoctorOverview });

function DoctorOverview() {
  const user = useAuth((s) => s.user);
  const { data: appointments, isLoading } = useDoctorAppointments();

  const today =
    appointments?.filter((a) => {
      const appointmentDate = new Date(a.appointmentDate);
      const todayDate = new Date();
      return appointmentDate.toDateString() === todayDate.toDateString();
    }) || [];

  const upcoming = appointments?.filter((a) => a.status === 0 || a.status === 1).length ?? 0;

  const weeklyAppointments = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => ({
    day,
    count: appointments?.filter((a) => new Date(a.appointmentDate).getDay() === i).length ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {user?.name}</h1>
        <p className="text-sm text-muted-foreground">
          Here's your clinic at a glance ·{" "}
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI
          icon={Calendar}
          label="Today's appointments"
          value={today.length.toString()}
          sub={`${today.filter((a) => a.status === 0).length} pending`}
          tone="text-primary"
        />
        <KPI
          icon={Users}
          label="Total patients"
          value={new Set(appointments?.map((a) => a.patientId)).size.toString()}
          sub="All time"
          tone="text-secondary"
        />
        <KPI
          icon={Clock}
          label="Upcoming"
          value={upcoming.toString()}
          sub="Pending or confirmed"
          tone="text-warning"
        />
        <KPI
          icon={Calendar}
          label="Total appointments"
          value={(appointments?.length ?? 0).toString()}
          sub="All time"
          tone="text-success"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold">Today's schedule</h3>
            <Badge variant="outline">{today.length} appointments</Badge>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : today.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments scheduled for today.</p>
            ) : (
              today.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-4 p-3 rounded-xl border hover:border-primary/40 transition"
                >
                  <div className="text-center w-14 shrink-0">
                    <p className="font-bold">
                      {new Date(a.appointmentDate).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Avatar>
                    <AvatarFallback>{initials(a.patient?.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {a.patient?.fullName || "Unknown Patient"}
                    </p>
                    <p className="text-xs text-muted-foreground">{a.reason || "Consultation"}</p>
                  </div>
                  <Badge variant="secondary">{appointmentStatusLabel[a.status] ?? a.status}</Badge>
                  <Link to="/doctor/appointments">
                    <Button size="sm" variant="outline">
                      Open
                    </Button>
                  </Link>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Appointments by weekday</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyAppointments}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="var(--primary)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </Card>
  );
}
