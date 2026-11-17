import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, AlertTriangle, Plus, Loader2, Upload, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  sendAiChat,
  uploadMedicalDocument,
  listMedicalDocuments,
  type ChatMessage,
  type ChatSource,
  type MedicalDocument,
} from "@/hooks/useAiChat";
import { toast } from "sonner";

export const Route = createFileRoute("/patient/assistant")({ component: AIAssistant });

interface Msg {
  id: number;
  from: "me" | "ai";
  text: string;
  sources?: ChatSource[];
}

const ACCEPTED_TYPES = ".pdf,.txt";
const MAX_SIZE_MB = 10;

function AIAssistant() {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: 1,
      from: "ai",
      text: "Hi! I'm your MediConnect AI assistant. Ask me anything about symptoms, medications or wellness. How can I help today?",
    },
  ]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const aiSuggestions = [
    "What are common causes of persistent headaches?",
    "How can I improve my sleep quality?",
    "What does my blood pressure reading mean?",
    "Tips for managing seasonal allergies",
  ];

  useEffect(() => {
    listMedicalDocuments()
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, []);

  const ask = async (q: string) => {
    if (!q.trim() || loading) return;
    const userMsg = { id: Date.now(), from: "me" as const, text: q };
    setMsgs((m) => [...m, userMsg]);
    setText("");
    setLoading(true);

    const history: ChatMessage[] = msgs
      .filter((m) => m.id !== 1)
      .map((m) => ({
        role: m.from === "me" ? "human" : "ai",
        content: m.text,
      }));

    try {
      const res = await sendAiChat(q, history);
      setMsgs((m) => [
        ...m,
        { id: Date.now() + 1, from: "ai", text: res.answer, sources: res.sources },
      ]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "AI service unavailable";
      toast.error(message);
      setMsgs((m) => [
        ...m,
        {
          id: Date.now() + 1,
          from: "ai",
          text: "Sorry, I could not reach the AI service right now. Please try again later or consult a doctor.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Maximum size is ${MAX_SIZE_MB} MB.`);
      return;
    }
    setUploading(true);
    try {
      const res = await uploadMedicalDocument(file);
      toast.success(res.message || "Document uploaded and indexed.");
      const docs = await listMedicalDocuments().catch(() => documents);
      setDocuments(docs);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-6 h-[calc(100vh-12rem)]">
      <aside className="space-y-2 hidden lg:block">
        <Button
          className="w-full bg-gradient-hero border-0 shadow-glow"
          onClick={() => setMsgs([msgs[0]])}
        >
          <Plus className="h-4 w-4 mr-1" /> New conversation
        </Button>

        <Card className="p-3 mt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Medical documents
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              className="hidden"
              onChange={(e) => handleUpload(e.target.files?.[0])}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3 mr-1" />
              )}
              Upload
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">
            PDF or TXT, max {MAX_SIZE_MB} MB. Answers cite these documents.
          </p>
          {documents.length === 0 && !uploading && (
            <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
          )}
          {documents.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg text-muted-foreground"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1">{d.fileName}</span>
              <span className="text-[10px]">{d.chunkCount} chunks</span>
            </div>
          ))}
        </Card>
      </aside>

      <Card className="flex flex-col overflow-hidden">
        <div className="p-3 bg-warning/10 border-b border-warning/20 flex items-center gap-2 text-xs">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <p>This information is general in nature only. Consult your doctor for medical advice.</p>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4 bg-gradient-soft">
          {msgs.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${m.from === "me" ? "justify-end" : ""}`}
            >
              {m.from === "ai" && (
                <div className="h-9 w-9 rounded-xl bg-gradient-hero grid place-items-center shrink-0 shadow-glow">
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.from === "me" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border rounded-tl-sm shadow-soft"}`}
              >
                {m.from === "ai" ? (
                  <div className="assistant-md">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => (
                          <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>
                        ),
                        li: ({ children }) => <li>{children}</li>,
                        strong: ({ children }) => (
                          <strong className="font-semibold">{children}</strong>
                        ),
                      }}
                    >
                      {m.text}
                    </ReactMarkdown>
                  </div>
                ) : (
                  m.text
                )}
                {m.from === "ai" && m.sources && m.sources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-border/60 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Sources
                    </p>
                    {m.sources.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-1.5 text-xs text-muted-foreground"
                      >
                        <span className="font-medium text-foreground/70 shrink-0">
                          [{s.number ?? i + 1}]
                        </span>
                        <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>
                          {s.title}
                          {s.page != null && ` — page ${s.page}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
            </div>
          )}

          {msgs.length === 1 && !loading && (
            <div className="pt-6">
              <p className="text-xs text-muted-foreground mb-3 font-medium">Try asking:</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {aiSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="text-left p-3 rounded-xl border bg-card hover:border-primary hover:shadow-soft transition text-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(text)}
            placeholder="Ask anything about your health..."
            className="flex-1"
            disabled={loading}
          />
          <Button
            onClick={() => ask(text)}
            disabled={loading}
            className="bg-gradient-hero border-0 shadow-glow"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
