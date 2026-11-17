import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "MediConnect AI Service"
    API_V1_STR: str = "/api/v1"

    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = "gpt-4o-mini"

    # LLM provider: "groq" (default, free tier), "gemini" or "openai"
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "groq")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "openai/gpt-oss-120b")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")

    # Embeddings provider: "local" (default, FastEmbed) or "openai"
    EMBEDDINGS_PROVIDER: str = os.getenv("EMBEDDINGS_PROVIDER", "local")
    FASTEMBED_MODEL: str = os.getenv(
        "FASTEMBED_MODEL",
        "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    )
    FASTEMBED_CACHE_DIR: str = os.getenv("FASTEMBED_CACHE_DIR", "fastembed_cache")

    CHROMA_DB_DIR: str = "db_data"
    KNOWLEDGE_BASE_FILE: str = "data/knowledge_base.txt"

    # Document ingestion
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
    ALLOWED_EXTENSIONS: str = ".pdf,.txt"

    # Chunking
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "1000"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "150"))

    # RAG retrieval: max chunks per store and max cosine distance allowed
    RETRIEVAL_K: int = int(os.getenv("RETRIEVAL_K", "8"))
    RELEVANCE_THRESHOLD: float = float(os.getenv("RELEVANCE_THRESHOLD", "30.0"))

    # Security - JWT_SECRET_KEY must be provided via environment; no default
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    JWT_ALGORITHM: str = "HS256"

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env")

settings = Settings()
