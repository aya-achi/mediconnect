import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Search,
  Calendar,
  MessageSquare,
  Sparkles,
  Shield,
  Stethoscope,
  ArrowRight,
  Activity,
  CheckCircle2,
  Heart,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicNav, PublicFooter } from "@/components/layout/PublicNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediConnect — Find verified doctors, book in seconds" },
      {
        name: "description",
        content:
          "MediConnect is the premium healthcare platform connecting patients with verified doctors. Book appointments, chat securely, and access AI medical assistance.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Search,
    title: "Find verified doctors",
    desc: "Browse specialists by specialty, city and consultation fee.",
    color: "from-sky-500 to-cyan-400",
  },
  {
    icon: Calendar,
    title: "Book in 30 seconds",
    desc: "Real-time availability with instant confirmation. No phone calls, no waiting.",
    color: "from-cyan-500 to-teal-400",
  },
  {
    icon: MessageSquare,
    title: "Secure messaging",
    desc: "End-to-end encrypted chat with your care team. Share files and follow up easily.",
    color: "from-teal-500 to-emerald-400",
  },
  {
    icon: Sparkles,
    title: "AI medical assistant",
    desc: "Get instant general information about symptoms, medications and wellness.",
    color: "from-violet-500 to-fuchsia-400",
  },
  {
    icon: Shield,
    title: "Verified credentials",
    desc: "Every doctor is manually reviewed by our medical board for your safety.",
    color: "from-blue-500 to-indigo-400",
  },
  {
    icon: Activity,
    title: "Health timeline",
    desc: "All your appointments, prescriptions and notes in one place, forever.",
    color: "from-rose-500 to-orange-400",
  },
];

const steps = [
  {
    n: "01",
    title: "Search & discover",
    desc: "Find the right specialist by symptom, specialty or location.",
  },
  {
    n: "02",
    title: "Book instantly",
    desc: "Pick a slot that works for you — video or in-person.",
  },
  {
    n: "03",
    title: "Meet & follow-up",
    desc: "Consult, message securely and access your full health record.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      {/* Hero */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-mesh opacity-80 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-4 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="outline" className="mb-5 px-3 py-1 glass">
              <Sparkles className="h-3 w-3 mr-1.5 text-primary" />
              AI-powered healthcare, redefined
            </Badge>
            <h1 className="text-5xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
              Your health,
              <br />
              <span className="text-gradient">beautifully connected.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              Find verified doctors, book appointments instantly, and access secure medical care
              from anywhere. The premium healthcare platform you deserve.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/register">
                <Button size="lg" className="bg-gradient-hero shadow-glow border-0">
                  Find a doctor <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline">
                  Sign in
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> No credit card
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> HIPAA compliant
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-3">
              Features
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
              Everything you need for modern care
            </h2>
            <p className="mt-4 text-muted-foreground">
              Built for patients and clinicians who refuse to settle.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="p-6 h-full hover:shadow-elegant transition-all group border-border/60">
                  <div
                    className={`h-12 w-12 rounded-xl bg-gradient-to-br ${f.color} grid place-items-center text-white shadow-lg group-hover:scale-110 transition-transform`}
                  >
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-semibold text-lg">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Section */}
      <section className="py-24 bg-gradient-soft">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge variant="outline" className="mb-3">
              <Sparkles className="h-3 w-3 mr-1" /> AI Assistant
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
              A medical co-pilot in your pocket.
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Ask anything — from symptom triage to medication interactions. Our AI provides general
              medical information instantly, then helps you connect with the right specialist.
            </p>
            <div className="mt-6 space-y-3">
              {[
                "24/7 availability",
                "Multilingual support",
                "Connects you to a real doctor when needed",
              ].map((t) => (
                <div key={t} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success" /> {t}
                </div>
              ))}
            </div>
            <Link to="/register">
              <Button size="lg" className="mt-8 bg-gradient-hero border-0 shadow-glow">
                Try the assistant
              </Button>
            </Link>
          </div>
          <Card className="p-6 glass-strong shadow-elegant">
            <div className="space-y-3">
              <ChatBubble side="me">I've had headaches for 3 days, what could it be?</ChatBubble>
              <ChatBubble side="ai">
                Headaches lasting several days can have many causes — tension, dehydration, sleep
                disruption or migraines. I'd suggest tracking when they occur and trying to rest. If
                they intensify or come with fever, please consult a doctor.
                <p className="mt-2 text-[10px] text-muted-foreground italic">
                  These informations sont à caractère général uniquement. Consultez votre médecin
                  pour un avis médical.
                </p>
              </ChatBubble>
              <ChatBubble side="me">Can you find me a neurologist?</ChatBubble>
              <ChatBubble side="ai">
                Of course — here are 3 verified neurologists available this week.
              </ChatBubble>
            </div>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Badge variant="outline" className="mb-3">
              How it works
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
              Care in three simple steps
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <Card key={s.n} className="p-8 relative overflow-hidden border-border/60">
                <span className="absolute -top-3 -right-3 text-7xl font-bold text-muted/40 select-none">
                  {s.n}
                </span>
                <Stethoscope className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-semibold text-xl">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-4 lg:px-8">
          <Card className="overflow-hidden bg-gradient-hero text-primary-foreground p-12 lg:p-16 text-center border-0 shadow-elegant relative">
            <Heart className="absolute top-6 left-6 h-6 w-6 opacity-30" />
            <Brain className="absolute bottom-6 right-6 h-6 w-6 opacity-30" />
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">
              Ready to take charge of your health?
            </h2>
            <p className="mt-4 text-primary-foreground/90 max-w-xl mx-auto">
              Join MediConnect today and discover what modern healthcare feels like.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/register">
                <Button size="lg" variant="secondary" className="shadow-elegant">
                  Create free account
                </Button>
              </Link>
              <Link to="/doctor-apply">
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-transparent border-white/30 text-white hover:bg-white/10"
                >
                  Apply as doctor
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

function ChatBubble({ side, children }: { side: "me" | "ai"; children: React.ReactNode }) {
  if (side === "me") {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] text-sm">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <div className="h-8 w-8 rounded-lg bg-gradient-hero grid place-items-center shrink-0">
        <Sparkles className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%] text-sm">
        {children}
      </div>
    </div>
  );
}
