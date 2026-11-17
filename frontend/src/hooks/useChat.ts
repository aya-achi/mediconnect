import { useEffect, useState, useRef, useCallback } from "react";
import { fetchApi, API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/store/auth";

export interface Conversation {
  id: string;
  patientId: string;
  doctorId: string;
  createdAt: string;
  patientName?: string;
  doctorName?: string;
  participantName?: string;
  participantAvatar?: string;
  participantRole?: string;
  lastMessage?: string;
  time?: string;
  unread?: number;
  online?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  sentAt: string;
  isRead: boolean;
}

function normId(id: string | undefined | null) {
  return (id ?? "").toLowerCase();
}

function mapConversation(raw: Record<string, unknown>): Conversation {
  return {
    id: String(raw.id ?? raw.Id ?? ""),
    patientId: String(raw.patientId ?? raw.PatientId ?? ""),
    doctorId: String(raw.doctorId ?? raw.DoctorId ?? ""),
    createdAt: String(raw.createdAt ?? raw.CreatedAt ?? ""),
    patientName: raw.patientName != null ? String(raw.patientName) : undefined,
    doctorName: raw.doctorName != null ? String(raw.doctorName) : undefined,
  };
}

function mapMessage(raw: Record<string, unknown>): Message {
  return {
    id: String(raw.id ?? raw.Id ?? ""),
    conversationId: String(raw.conversationId ?? raw.ConversationId ?? ""),
    senderId: String(raw.senderId ?? raw.SenderId ?? ""),
    content: String(raw.content ?? raw.Content ?? ""),
    sentAt: String(raw.sentAt ?? raw.SentAt ?? ""),
    isRead: Boolean(raw.isRead ?? raw.IsRead ?? false),
  };
}

export function useChat() {
  const user = useAuth((s) => s.user);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeConversationRef = useRef<Conversation | null>(null);
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  const initiateConversation = useCallback(async (doctorId: string, patientId: string) => {
    const raw = await fetchApi<Record<string, unknown>>("/Conversations/initiate", {
      method: "POST",
      body: JSON.stringify({ patientId, doctorId }),
    });
    return mapConversation(raw);
  }, []);

  const syncConversationsFromAppointments = useCallback(async () => {
    if (!user || user.role !== "patient") return;

    try {
      const appointments = await fetchApi<
        Array<{ doctorProfile?: { userId?: string }; status: number }>
      >(`/Appointments/patient/${user.id}`);
      const confirmed = appointments.filter((a) => a.status === 1);
      for (const appt of confirmed) {
        const doctorUserId = appt.doctorProfile?.userId;
        if (!doctorUserId) continue;
        try {
          await initiateConversation(doctorUserId, user.id);
        } catch {
          /* may already exist */
        }
      }
    } catch (e) {
      console.error("Failed to sync conversations from appointments", e);
    }
  }, [user, initiateConversation]);

  const loadConversations = useCallback(async () => {
    if (!user) return;

    const token = localStorage.getItem("mediconnect-auth-token");
    if (!token) {
      setError("Not signed in. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let data = await fetchApi<Record<string, unknown>[]>("/Conversations");

      if (data.length === 0) {
        await syncConversationsFromAppointments();
        data = await fetchApi<Record<string, unknown>[]>("/Conversations");
      }

      const mapped = data.map(mapConversation);

      const populated = await Promise.all(
        mapped.map(async (c) => {
          const name =
            (user.role === "patient" ? c.doctorName : c.patientName) ??
            (user.role === "patient" ? "Doctor" : "Patient");
          const role = user.role === "patient" ? "Doctor" : "Patient";

          let lastMessage = "No messages yet";
          let time = "";
          let unread = 0;
          try {
            const msgsRaw = await fetchApi<Record<string, unknown>[]>(
              `/Conversations/${c.id}/messages`,
            );
            const msgs = msgsRaw.map(mapMessage);
            unread = msgs.filter((m) => !m.isRead && normId(m.senderId) !== normId(user.id)).length;
            if (msgs.length > 0) {
              const last = msgs[msgs.length - 1];
              lastMessage = last.content;
              time = new Date(last.sentAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
            }
          } catch (e) {
            console.error("Failed to fetch messages preview", c.id, e);
          }

          return {
            ...c,
            participantName: name,
            participantRole: role,
            lastMessage,
            time,
            unread,
            online: false,
          };
        }),
      );

      setConversations(populated);
      if (populated.length > 0 && !activeConversationRef.current) {
        setActiveConversation(populated[0]);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load conversations";
      setError(msg);
      setConversations([]);
      console.error("Failed to load conversations", e);
    } finally {
      setLoading(false);
    }
  }, [user, syncConversationsFromAppointments, initiateConversation]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }
    const loadMessages = async () => {
      try {
        const data = await fetchApi<Record<string, unknown>[]>(
          `/Conversations/${activeConversation.id}/messages`,
        );
        setMessages(data.map(mapMessage));
      } catch (e) {
        console.error("Failed to load messages", e);
      }
    };
    loadMessages();
  }, [activeConversation]);

  const sendMessage = async (content: string) => {
    if (!activeConversation || !content.trim()) return;

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversation.id,
      senderId: user?.id ?? "",
      content: content.trim(),
      sentAt: new Date().toISOString(),
      isRead: false,
    };

    try {
      setMessages((prev) => [...prev, optimistic]);
      const raw = await fetchApi<Record<string, unknown>>(
        `/Conversations/${activeConversation.id}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content: content.trim() }),
        },
      );
      const message = mapMessage(raw);
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return prev.map((m) => (m.id === optimistic.id ? message : m));
      });
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {
                ...c,
                lastMessage: message.content,
                time: new Date(message.sentAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              }
            : c,
        ),
      );
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      console.error("Failed to send message", e);
      throw e;
    }
  };

  const startConversationWithDoctor = async (doctorUserId: string) => {
    if (!user) return null;
    const patientId = user.role === "patient" ? user.id : doctorUserId;
    const doctorId = user.role === "patient" ? doctorUserId : user.id;
    try {
      const conv = await initiateConversation(doctorId, patientId);
      setError(null);
      const token = localStorage.getItem("mediconnect-auth-token");
      if (!token) return conv;

      const data = await fetchApi<Record<string, unknown>[]>("/Conversations");
      const mapped = data.map(mapConversation);
      const populated = await Promise.all(
        mapped.map(async (c) => {
          const name =
            (user.role === "patient" ? c.doctorName : c.patientName) ??
            (user.role === "patient" ? "Doctor" : "Patient");
          return {
            ...c,
            participantName: name,
            lastMessage: "No messages yet",
            time: "",
            unread: 0,
            online: false,
          };
        }),
      );
      setConversations(populated);
      const active = populated.find((c) => c.id === conv.id) ?? populated[0] ?? null;
      setActiveConversation(active);
      return active;
    } catch (e) {
      console.error("Failed to start conversation", e);
      setError(e instanceof Error ? e.message : "Failed to start conversation");
      return null;
    }
  };

  return {
    conversations,
    messages,
    activeConversation,
    setActiveConversation,
    sendMessage,
    initiateConversation: startConversationWithDoctor,
    reloadConversations: loadConversations,
    loading,
    error,
  };
}
