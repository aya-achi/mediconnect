"""Document ingestion: validation, text extraction and chunking."""
import io
import os
from typing import List, Tuple

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

from app.core.config import settings

MAX_FILE_SIZE_BYTES = settings.MAX_FILE_SIZE_MB * 1024 * 1024
ALLOWED_EXTENSIONS = {ext.strip().lower() for ext in settings.ALLOWED_EXTENSIONS.split(",") if ext.strip()}


def validate_upload(file_name: str, size_bytes: int) -> None:
    ext = os.path.splitext(file_name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type '{ext}'. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}")
    if size_bytes <= 0:
        raise ValueError("File is empty")
    if size_bytes > MAX_FILE_SIZE_BYTES:
        raise ValueError(f"File exceeds the maximum size of {settings.MAX_FILE_SIZE_MB} MB")


def extract_pages(file_bytes: bytes, file_name: str) -> List[Tuple[int | None, str]]:
    """Return a list of (page_number_or_None, text) for the uploaded document."""
    ext = os.path.splitext(file_name)[1].lower()

    if ext == ".pdf":
        return _extract_pdf_pages(file_bytes)
    if ext == ".txt":
        text = file_bytes.decode("utf-8", errors="replace")
        return [(None, text)] if text.strip() else []
    raise ValueError(f"Unsupported file type '{ext}'")


def _extract_pdf_pages(file_bytes: bytes) -> List[Tuple[int, str]]:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except Exception as e:
        raise ValueError(f"Could not read PDF file: {e}")

    pages = []
    for index, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        if text.strip():
            pages.append((index, text))

    if not pages:
        raise ValueError("PDF contains no extractable text (it may be scanned images)")
    return pages


def chunk_pages(file_name: str, pages: List[Tuple[int | None, str]]) -> List[Document]:
    """Split extracted text into overlapping chunks, preserving source metadata."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
    )

    documents: List[Document] = []
    for page_number, text in pages:
        pieces = splitter.split_text(text)
        for piece in pieces:
            if not piece.strip():
                continue
            metadata = {"source": file_name}
            if page_number is not None:
                metadata["page"] = page_number
            documents.append(Document(page_content=piece, metadata=metadata))

    if not documents:
        raise ValueError("Document produced no usable text chunks")
    return documents
