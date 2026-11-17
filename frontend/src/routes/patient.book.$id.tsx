import React, { useState } from "react";
import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/store/auth";
import { useDoctors } from "@/hooks/useDoctors";
import { normalizeDoctor } from "@/lib/doctors";
import { fetchApi } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/patient/book/$id")({ component: Book });

function Book() {
  const { id } = useParams({ from: "/patient/book/$id" });
  const user = useAuth((s) => s.user);
  const { data: apiDoctors, isLoading } = useDoctors();

  const d = React.useMemo(() => {
    if (!apiDoctors) return null;
    const found = apiDoctors.find((x) => x.id === id);
    if (!found) return null;
    return normalizeDoctor(found);
  }, [apiDoctors, id]);

  const navigate = useNavigate();
  const [dateTime, setDateTime] = useState("");
  const [reason, setReason] = useState("");

  const confirm = async () => {
    if (!d || !dateTime || !user) return;

    try {
      await fetchApi("/Appointments", {
        method: "POST",
        body: JSON.stringify({
          patientId: user.id,
          doctorProfileId: d.id,
          appointmentDate: new Date(dateTime).toISOString(),
          reason: reason || "Consultation",
        }),
      });

      toast.success(`Appointment booked with ${d.name}!`);
      navigate({ to: "/patient/appointments" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to book appointment");
    }
  };

  if (isLoading || !d) {
    return <div className="p-8 text-center text-muted-foreground">Loading doctor details...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        to="/patient/doctors/$id"
        params={{ id: d.id }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to profile
      </Link>

      <Card className="p-6">
        <div className="flex items-center gap-4 pb-5 border-b">
          <div className="h-14 w-14 rounded-full bg-gradient-hero grid place-items-center text-primary-foreground font-bold text-xl shrink-0">
            {d.name[0]}
          </div>
          <div>
            <p className="font-semibold">{d.name}</p>
            <p className="text-sm text-muted-foreground">
              {d.specialty} · {d.city} · €{d.price}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <Label className="text-sm font-medium flex items-center gap-1">
              <CalendarDays className="h-4 w-4" /> Date and time
            </Label>
            <Input
              type="datetime-local"
              value={dateTime}
              min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16)}
              onChange={(e) => setDateTime(e.target.value)}
              className="mt-2"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Reason for visit (optional)</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly describe your symptoms or reason..."
              className="mt-2"
            />
          </div>

          <div className="flex items-center justify-between pt-5 border-t">
            <div>
              {dateTime && (
                <Badge variant="secondary">
                  {new Date(dateTime).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </Badge>
              )}
            </div>
            <Button
              disabled={!dateTime}
              onClick={confirm}
              size="lg"
              className="bg-gradient-hero border-0 shadow-glow"
            >
              <Check className="h-4 w-4 mr-1" /> Confirm booking
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
