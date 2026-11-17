import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { MapPin, Calendar, MessageSquare, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/store/auth";

import React from "react";
import { useDoctors } from "@/hooks/useDoctors";
import { normalizeDoctor } from "@/lib/doctors";
import { fetchApi } from "@/lib/api";

export const Route = createFileRoute("/patient/doctors/$id")({ component: DoctorDetails });

function DoctorDetails() {
  const { id } = useParams({ from: "/patient/doctors/$id" });
  const { data: apiDoctors, isLoading } = useDoctors();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  const d = React.useMemo(() => {
    if (!apiDoctors) return null;
    const found = apiDoctors.find((x) => x.id === id);
    if (!found) return null;
    return normalizeDoctor(found);
  }, [apiDoctors, id]);

  const startChat = async () => {
    if (!user || !d) return;
    try {
      await fetchApi("/Conversations/initiate", {
        method: "POST",
        body: JSON.stringify({ patientId: user.id, doctorId: d.userId }),
      });
      navigate({ to: "/patient/messages" });
    } catch (e: unknown) {
      console.error("Failed to initiate conversation", e);
      navigate({ to: "/patient/messages" });
    }
  };

  if (isLoading || !d) {
    return <div className="p-8 text-center text-muted-foreground">Loading doctor details...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-8 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-mesh opacity-40" />
        <div className="relative flex flex-col md:flex-row gap-6">
          <div className="h-28 w-28 rounded-full bg-gradient-hero grid place-items-center text-primary-foreground font-bold text-3xl shadow-elegant shrink-0">
            {d.name[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{d.name}</h1>
              <Badge className="bg-success text-success-foreground">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {d.specialty} · {d.experience} years experience
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" /> {d.city}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                Consultation fee: €{d.price}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Link to="/patient/book/$id" params={{ id: d.id }}>
              <Button className="w-full bg-gradient-hero border-0 shadow-glow">
                <Calendar className="h-4 w-4 mr-1" /> Book appointment
              </Button>
            </Link>
            <Button variant="outline" onClick={startChat} className="w-full">
              <MessageSquare className="h-4 w-4 mr-1" /> Message
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold mb-3">About {d.name}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {d.bio || "No bio provided."}
        </p>
      </Card>
    </div>
  );
}
