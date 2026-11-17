import os
from typing import Dict, List, Optional

import chromadb
from langchain_community.document_loaders import TextLoader
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
try:
    from langchain.retrievers import EnsembleRetriever
except ImportError:  # langchain >= 1.0 moved classic APIs
    from langchain_classic.retrievers import EnsembleRetriever
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import settings

SHARED_COLLECTION = "shared_knowledge"


def _collection_name(user_id: str) -> str:
    # Chroma collection names must be filesystem-safe; user ids are GUIDs
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in user_id)
    return f"user_{safe}"


class VectorStoreManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(VectorStoreManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def initialize_db(self):
        if self._initialized:
            return

        os.makedirs(settings.CHROMA_DB_DIR, exist_ok=True)
        os.makedirs(settings.FASTEMBED_CACHE_DIR, exist_ok=True)
        self._client = chromadb.PersistentClient(path=settings.CHROMA_DB_DIR)
        self._embeddings = self._create_embeddings()
        self._stores: Dict[str, Chroma] = {}
        self._initialized = True

        # Shared medical knowledge base available to every user
        shared = self._get_store(SHARED_COLLECTION)
        if self._client.get_collection(SHARED_COLLECTION).count() == 0 and os.path.exists(settings.KNOWLEDGE_BASE_FILE):
            try:
                loader = TextLoader(settings.KNOWLEDGE_BASE_FILE, encoding="utf-8")
                documents = loader.load()
                splitter = RecursiveCharacterTextSplitter(
                    chunk_size=settings.CHUNK_SIZE,
                    chunk_overlap=settings.CHUNK_OVERLAP,
                )
                docs = splitter.split_documents(documents)
                shared.add_documents(docs)
            except Exception as e:
                # Knowledge base indexing requires a working OpenAI key;
                # don't prevent the service from starting without it.
                print(f"Warning: could not index knowledge base: {e}")

    @staticmethod
    def _create_embeddings():
        """Embeddings for the configured provider (local FastEmbed by default)."""
        if settings.EMBEDDINGS_PROVIDER == "openai":
            from langchain_openai import OpenAIEmbeddings

            return OpenAIEmbeddings(openai_api_key=settings.OPENAI_API_KEY)

        from langchain_community.embeddings import FastEmbedEmbeddings

        return FastEmbedEmbeddings(
            model_name=settings.FASTEMBED_MODEL,
            cache_dir=settings.FASTEMBED_CACHE_DIR,
        )

    def _get_store(self, collection_name: str) -> Chroma:
        if collection_name not in self._stores:
            # Ensure the collection exists before handing it to LangChain
            self._client.get_or_create_collection(name=collection_name)
            self._stores[collection_name] = Chroma(
                client=self._client,
                collection_name=collection_name,
                embedding_function=self._embeddings,
            )
        return self._stores[collection_name]

    def _raw_collection(self, user_id: str):
        return self._client.get_collection(_collection_name(user_id))

    def get_retriever(self, user_id: str):
        """Retriever combining the user's own documents with the shared knowledge base."""
        self.initialize_db()
        user_store = self._get_store(_collection_name(user_id))
        shared_store = self._get_store(SHARED_COLLECTION)

        return EnsembleRetriever(
            retrievers=[
                user_store.as_retriever(),
                shared_store.as_retriever(),
            ],
            weights=[3.0, 1.0],
        )

    def search_with_scores(self, user_id: str, query: str, k: Optional[int] = None):
        """Semantic search across the user's documents and the shared knowledge base.

        Returns a list of (Document, score) tuples sorted by score ascending.
        Chroma returns cosine distance, so lower scores are more relevant.
        """
        self.initialize_db()
        k = k or settings.RETRIEVAL_K
        results = []
        for collection_name in (_collection_name(user_id), SHARED_COLLECTION):
            store = self._get_store(collection_name)
            results.extend(store.similarity_search_with_score(query, k=k))
        results.sort(key=lambda item: item[1])
        return results

    def ingest_document(self, user_id: str, file_name: str, chunks: List[Document]) -> int:
        """Index chunks for a user, replacing any previous version of the same file."""
        self.initialize_db()
        self.delete_document(user_id, file_name)
        store = self._get_store(_collection_name(user_id))
        store.add_documents(chunks)
        return len(chunks)

    def delete_document(self, user_id: str, file_name: str) -> int:
        self.initialize_db()
        collection = self._client.get_or_create_collection(_collection_name(user_id))
        existing = collection.get(where={"source": file_name}, include=[])
        ids = existing.get("ids", [])
        if ids:
            collection.delete(ids=ids)
            if _collection_name(user_id) in self._stores:
                self._stores.pop(_collection_name(user_id))
        return len(ids)

    def list_documents(self, user_id: str) -> List[dict]:
        self.initialize_db()
        collection = self._client.get_or_create_collection(_collection_name(user_id))
        data = collection.get(include=["metadatas"])

        counts: Dict[str, int] = {}
        for metadata in data.get("metadatas", []):
            source = (metadata or {}).get("source")
            if source:
                counts[source] = counts.get(source, 0) + 1

        return [
            {"id": name, "file_name": name, "chunk_count": count}
            for name, count in sorted(counts.items())
        ]


vector_store_manager = VectorStoreManager()
