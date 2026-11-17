import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { useAuth } from "@/store/auth";
import { registerAccount } from "@/lib/auth-session";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({ component: Register });

const schema = z.object({
  name: z.string().min(2, "Required"),
  email: z.string().email(),
  password: z.string().min(8, "At least 8 characters"),
});
type FormData = z.infer<typeof schema>;

function Register() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const setUser = useAuth((s) => s.setUser);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const { user, token } = await registerAccount({
        fullName: data.name,
        email: data.email,
        password: data.password,
        role: 0, // Patient
      });

      setUser(user, token);
      toast.success("Account created! Welcome to MediConnect.");
      navigate({ to: "/patient", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Registration failed");
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Create your MediConnect account"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Full name" error={errors.name?.message}>
          <User className="h-4 w-4 text-muted-foreground" />
          <Input
            {...register("name")}
            placeholder="Sarah Mitchell"
            className="border-0 focus-visible:ring-0 bg-transparent"
          />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Mail className="h-4 w-4 text-muted-foreground" />
          <Input
            {...register("email")}
            type="email"
            placeholder="you@email.com"
            className="border-0 focus-visible:ring-0 bg-transparent"
          />
        </Field>
        <Field label="Password" error={errors.password?.message}>
          <Lock className="h-4 w-4 text-muted-foreground" />
          <Input
            {...register("password")}
            type="password"
            placeholder="At least 8 characters"
            className="border-0 focus-visible:ring-0 bg-transparent"
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          By signing up, you agree to our Terms and Privacy Policy.
        </p>
        <Button
          type="submit"
          disabled={isSubmitting || !mounted}
          className="w-full bg-gradient-hero border-0 shadow-glow"
        >
          {isSubmitting ? (
            "Creating account..."
          ) : (
            <>
              Create account <ArrowRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Are you a doctor?{" "}
        <Link to="/doctor-apply" className="text-primary hover:underline">
          Apply here →
        </Link>
      </p>
    </AuthLayout>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="mt-1.5 flex items-center gap-2 px-3 h-11 rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring/30 focus-within:border-ring transition">
        {children}
      </div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
