import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/store/auth";
import { fetchApi } from "@/lib/api";
import { toast } from "sonner";
import { initials } from "@/lib/utils";

export const Route = createFileRoute("/patient/settings")({ component: Settings });

function Settings() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await fetchApi<{ id: string; fullName: string; email: string }>(
        `/Users/${user.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ fullName: name, email }),
        },
      );
      setUser({ ...user, name: updated.fullName, email: updated.email });
      toast.success("Profile updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarFallback className="bg-gradient-hero text-primary-foreground">
              {initials(user?.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.role}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Full name</Label>
            <Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input
              className="mt-1.5"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            className="bg-gradient-hero border-0"
            onClick={save}
            disabled={saving || !name.trim() || !email.trim()}
          >
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
