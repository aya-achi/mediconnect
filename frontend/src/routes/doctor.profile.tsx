import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/store/auth";
import { useDoctorProfileByUserId, useUpdateDoctorProfile } from "@/hooks/useDoctors";
import { toast } from "sonner";

export const Route = createFileRoute("/doctor/profile")({ component: DoctorProfile });

function DoctorProfile() {
  const user = useAuth((s) => s.user);
  const { data: profile, isLoading } = useDoctorProfileByUserId(user?.id);
  const updateProfile = useUpdateDoctorProfile();

  const [form, setForm] = useState({
    fullName: "",
    specialty: "",
    city: "",
    yearsOfExperience: "",
    consultationFee: "",
    availability: "",
    bio: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        fullName: profile.fullName ?? "",
        specialty: profile.specialty ?? "",
        city: profile.city ?? "",
        yearsOfExperience: String(profile.yearsOfExperience ?? 0),
        consultationFee: String(profile.consultationFee ?? 0),
        availability: profile.availability ?? "",
        bio: profile.bio ?? "",
      });
    }
  }, [profile]);

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!profile) return;
    try {
      await updateProfile.mutateAsync({
        id: profile.id,
        fullName: form.fullName,
        specialty: form.specialty,
        bio: form.bio,
        consultationFee: Number(form.consultationFee) || 0,
        yearsOfExperience: Number(form.yearsOfExperience) || 0,
        city: form.city,
        availability: form.availability || undefined,
        profileImage: profile.profileImage ?? undefined,
      });
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update profile");
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading profile...</div>;
  }

  if (!profile) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No doctor profile found for your account.
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Your professional profile</h1>

      <Card className="p-6">
        <div className="flex items-center gap-5">
          <div className="h-24 w-24 rounded-full bg-gradient-hero grid place-items-center text-primary-foreground text-xl font-bold">
            {form.fullName?.[0] ?? user?.name?.[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold">{form.fullName || user?.name}</p>
              {profile.isApproved !== false && (
                <Badge className="bg-success text-success-foreground">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{form.specialty || "No specialty set"}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-5">
        <h3 className="font-semibold">General information</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full name" value={form.fullName} onChange={set("fullName")} />
          <Field label="Specialty" value={form.specialty} onChange={set("specialty")} />
          <Field label="City" value={form.city} onChange={set("city")} />
          <Field
            label="Years of experience"
            type="number"
            value={form.yearsOfExperience}
            onChange={set("yearsOfExperience")}
          />
          <Field
            label="Consultation fee (€)"
            type="number"
            value={form.consultationFee}
            onChange={set("consultationFee")}
          />
          <Field
            label="Availability"
            value={form.availability}
            onChange={set("availability")}
            placeholder="e.g. Mon-Fri 9-17"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Professional bio</Label>
          <Textarea
            rows={4}
            className="mt-1.5"
            value={form.bio}
            onChange={set("bio")}
            placeholder="Tell patients about your approach to care..."
          />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button
            variant="outline"
            onClick={() =>
              profile &&
              setForm({
                fullName: profile.fullName ?? "",
                specialty: profile.specialty ?? "",
                city: profile.city ?? "",
                yearsOfExperience: String(profile.yearsOfExperience ?? 0),
                consultationFee: String(profile.consultationFee ?? 0),
                availability: profile.availability ?? "",
                bio: profile.bio ?? "",
              })
            }
          >
            Discard
          </Button>
          <Button
            className="bg-gradient-hero border-0"
            onClick={save}
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input className="mt-1.5" value={value} onChange={onChange} {...rest} />
    </div>
  );
}
