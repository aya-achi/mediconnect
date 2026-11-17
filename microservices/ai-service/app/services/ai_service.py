from typing import List, Optional

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from app.core.config import settings
from app.db.vector_store import vector_store_manager

INSUFFICIENT_CONTEXT_MESSAGE = (
    "I could not find enough relevant information in the available medical documents "
    "to answer your question reliably. Please consult a qualified healthcare "
    "professional or upload additional medical documents."
)


def create_llm():
    """Build the chat LLM for the configured provider."""
    if settings.LLM_PROVIDER == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=settings.OPENAI_MODEL,
            openai_api_key=settings.OPENAI_API_KEY,
            temperature=0.2,
        )

    if settings.LLM_PROVIDER == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI

        kwargs = {"model": settings.GEMINI_MODEL, "temperature": 0.2}
        if settings.GOOGLE_API_KEY:
            kwargs["google_api_key"] = settings.GOOGLE_API_KEY
        return ChatGoogleGenerativeAI(**kwargs)

    # Default: Groq (OpenAI-compatible API)
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=settings.LLM_MODEL,
        openai_api_key=settings.GROQ_API_KEY,
        openai_api_base="https://api.groq.com/openai/v1",
        temperature=0.2,
    )


class AIService:
    def __init__(self):
        self.llm = create_llm()

        # Medical Chatbot System Prompt
        self.medical_system_prompt = (
            "You are a helpful medical assistant for MediConnect. "
            "Answer questions ONLY using the provided context retrieved from medical documents. "
            "If the context does not contain enough information to answer the question, "
            "say so explicitly instead of guessing. "
            "Do not provide a formal medical diagnosis or prescribe specific treatments. "
            "Always suggest consulting a professional doctor for serious concerns. "
            "Cite the sources you used inline with their number in square brackets "
            "(e.g. [1], [2]) and only cite numbers that appear in the context below. "
            "\n\n"
            "{context}"
        )

        # Appointment Assistant System Prompt
        self.appointment_system_prompt = (
            "You are a friendly appointment assistant for MediConnect. "
            "Help the user schedule a medical appointment. "
            "Ask for their name, preferred date, and the reason for the visit. "
            "Guide them naturally through the conversation."
        )

    async def get_medical_chat_response(self, query: str, user_id: str, chat_history=None):
        scored = vector_store_manager.search_with_scores(user_id, query)
        relevant = [(doc, score) for doc, score in scored if score <= settings.RELEVANCE_THRESHOLD]

        print(
            f"[RAG] user={user_id} query={query!r} "
            f"top_scores={[round(s, 4) for _, s in scored[:5]]} kept={len(relevant)}"
        )

        if not relevant:
            return {"answer": INSUFFICIENT_CONTEXT_MESSAGE, "sources": []}

        context_docs = [doc for doc, _ in relevant]
        numbered = self._number_sources(context_docs)
        context_text = "\n\n".join(
            f"[Source {num}]\n{doc.page_content}" for num, doc in numbered
        )

        qa_prompt = ChatPromptTemplate.from_messages([
            ("system", self.medical_system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ])

        prompt_value = qa_prompt.invoke({
            "input": query,
            "chat_history": chat_history or [],
            "context": context_text,
        })
        response = await self.llm.ainvoke(prompt_value)
        answer = response.content if hasattr(response, "content") else str(response)

        sources = self._build_sources(context_docs)
        return {"answer": answer, "sources": sources}

    @staticmethod
    def _source_key(doc) -> tuple:
        metadata = getattr(doc, "metadata", {}) or {}
        return (metadata.get("source") or "Unknown document", metadata.get("page"))

    @classmethod
    def _number_sources(cls, context_docs) -> List[tuple]:
        """Assign each chunk the number of its (file, page) source.

        Chunks from the same file+page share a number so the returned
        sources list (deduplicated by file+page) stays consistent with
        the [Source N] labels and inline citations.
        """
        numbers: dict = {}
        numbered: List[tuple] = []
        for doc in context_docs:
            key = cls._source_key(doc)
            if key not in numbers:
                numbers[key] = len(numbers) + 1
            numbered.append((numbers[key], doc))
        return numbered

    @classmethod
    def _build_sources(cls, context_docs) -> List[dict]:
        """Convert retrieved LangChain documents into numbered source references."""
        sources: List[dict] = []
        seen = set()
        for num, doc in cls._number_sources(context_docs):
            key = cls._source_key(doc)
            if key in seen:
                continue
            seen.add(key)
            title, page = key
            snippet = (getattr(doc, "page_content", "") or "")[:200].strip()
            sources.append({
                "number": num,
                "title": title,
                "page": page,
                "snippet": snippet or None,
            })
        return sources

    async def get_appointment_assistance(self, query: str, chat_history=None):
        prompt = ChatPromptTemplate.from_messages([
            ("system", self.appointment_system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ])

        chain = prompt | self.llm

        # In a real app, we would manage session-based history
        response = chain.invoke({"input": query, "chat_history": chat_history or []})
        return response.content


ai_service = AIService()
