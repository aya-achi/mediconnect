import { fetchApi } from "@/lib/api";

export type ChatMessage = { role: string; content: string };

export type ChatSource = {
  number?: number;
  title: string;
  page?: number | null;
  snippet?: string | null;
};

export type AiChatResponse = {
  answer: string;
  language?: string;
  sources?: ChatSource[];
};

export type MedicalDocument = {
  id: string;
  fileName: string;
  chunkCount: number;
};

// Simple language detection based on character patterns
function detectLanguage(text: string): string {
  const arabicPattern = /[\u0600-\u06FF]/;
  const frenchPattern = /[àâäéèêëïîôùûüÿœæç]/i;

  if (arabicPattern.test(text)) return "ar";
  if (frenchPattern.test(text)) return "fr";
  return "en"; // Default to English
}

export async function sendAiChat(query: string, chatHistory: ChatMessage[] = []) {
  const detectedLanguage = detectLanguage(query);
  return fetchApi<AiChatResponse>("/Ai/chat", {
    method: "POST",
    body: JSON.stringify({ query, chatHistory, language: detectedLanguage }),
  });
}

export async function uploadMedicalDocument(file: File) {
  const form = new FormData();
  form.append("file", file);
  return fetchApi<{ success: boolean; message: string; document?: MedicalDocument }>(
    "/Ai/documents",
    { method: "POST", body: form },
  );
}

export async function listMedicalDocuments() {
  return fetchApi<MedicalDocument[]>("/Ai/documents");
}
