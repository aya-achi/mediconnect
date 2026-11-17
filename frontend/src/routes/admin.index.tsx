import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Stethoscope, FileCheck, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDoctorApplications } from "@/hooks/useDoctorApplications";
import { useAdminStats } from "@/hooks/useStats";

export const Route = createFileRoute("/admin/")({ component: AdminOverview });

function AdminOverview() {
  const { data: stats } = useAdminStats();
  const { data: applications } = useDoctorApplications();
  const pending = applications?.filter((a) => a.status === 0) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform overview</h1>
        <p className="text-sm text-muted-foreground">Stats across MediConnect</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={Users} label="Total patients" value={stats?.totalPatients ?? "—"} />
        <KPI
          icon={Stethoscope}
          label="Approved doctors"
          value={stats?.approvedDoctors ?? "—"}
          sub={`${stats?.totalDoctors ?? "—"} registered`}
        />
        <KPI
          icon={FileCheck}
          label="Pending applications"
          value={stats?.pendingApplications ?? "—"}
          sub="Action required"
          tone="warning"
        />
        <KPI
          icon={Calendar}
          label="Appointments today"
          value={stats?.appointmentsToday ?? "—"}
          sub={`${stats?.totalAppointments ?? "—"} total`}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Pending review</h3>
            <Link to="/admin/applications">
              <Button variant="outline" size="sm">
                View all
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending applications.</p>
            ) : (
              pending.slice(0, 4).map((a) => (
                <div key={a.id} className="p-3 rounded-lg border">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{a.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.specialty} · {a.city}
                      </p>
                    </div>
                    <Badge className="bg-warning/15 text-warning-foreground border-0">
                      pending
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Platform</h3>
          <div className="space-y-3 text-sm">
            <Row label="Total users" value={stats?.totalUsers} />
            <Row label="Total appointments" value={stats?.totalAppointments} />
            <Row label="Appointments today" value={stats?.appointmentsToday} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: number }) {
  return (
    <div className="flex justify-between py-1.5 border-b last:border-0 border-border/60">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? "—"}</span>
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
  value: string | number;
  sub?: string;
  tone?: "warning";
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
      {sub && (
        <p
          className={`text-xs mt-1 ${tone === "warning" ? "text-warning-foreground" : "text-muted-foreground"}`}
        >
          {sub}
        </p>
      )}
    </Card>
  );
}
