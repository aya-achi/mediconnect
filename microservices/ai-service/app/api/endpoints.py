from typing import List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile, Depends
from pydantic import BaseModel

from app.core.security import validate_token, get_user_id
from app.db.vector_store import vector_store_manager
from app.services.ai_service import ai_service
from app.services.ingestion import validate_upload, extract_pages, chunk_pages

router = APIRouter()


class ChatMessage(BaseModel):
    role: str  # 'human' or 'ai'
    content: str


class ChatRequest(BaseModel):
    query: str
    chat_history: Optional[List[ChatMessage]] = []


class ChatSource(BaseModel):
    number: Optional[int] = None
    title: str
    page: Optional[int] = None
    snippet: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    sources: List[ChatSource] = []


class DocumentInfo(BaseModel):
    id: str
    fileName: str
    chunkCount: int


class DocumentResult(BaseModel):
    success: bool
    message: str
    document: Optional[DocumentInfo] = None


def format_history(history: List[ChatMessage]):
    # Converts list of dicts to LangChain message tuples
    formatted = []
    for msg in history:
        formatted.append((msg.role, msg.content))
    return formatted


def _is_rate_limit_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return "429" in text or "resource_exhausted" in text or "rate limit" in text or "quota" in text


@router.post("/chat", response_model=ChatResponse)
async def medical_chat(request: ChatRequest, token_data: dict = Depends(validate_token)):
    try:
        user_id = get_user_id(token_data)
        history = format_history(request.chat_history)
        result = await ai_service.get_medical_chat_response(request.query, user_id, history)
        return ChatResponse(answer=result["answer"], sources=result["sources"])
    except HTTPException:
        raise
    except Exception as e:
        if _is_rate_limit_error(e):
            raise HTTPException(status_code=429, detail="AI quota reached, try again later")
        raise HTTPException(status_code=500, detail="Failed to generate response")


@router.post("/appointment", response_model=ChatResponse)
async def appointment_assistant(request: ChatRequest, token_data: dict = Depends(validate_token)):
    try:
        history = format_history(request.chat_history)
        answer = await ai_service.get_appointment_assistance(request.query, history)
        return ChatResponse(answer=answer, sources=[])
    except Exception as e:
        if _is_rate_limit_error(e):
            raise HTTPException(status_code=429, detail="AI quota reached, try again later")
        raise HTTPException(status_code=500, detail="Failed to generate response")


@router.post("/documents", response_model=DocumentResult)
async def upload_document(file: UploadFile = File(...), token_data: dict = Depends(validate_token)):
    try:
        user_id = get_user_id(token_data)
        content = await file.read()

        validate_upload(file.filename or "", len(content))
        pages = extract_pages(content, file.filename or "")
        chunks = chunk_pages(file.filename or "", pages)
        chunk_count = vector_store_manager.ingest_document(user_id, file.filename or "", chunks)

        info = DocumentInfo(id=file.filename or "", fileName=file.filename or "", chunkCount=chunk_count)
        return DocumentResult(success=True, message="Document indexed successfully", document=info)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to process document")


@router.get("/documents", response_model=List[DocumentInfo])
async def list_documents(token_data: dict = Depends(validate_token)):
    user_id = get_user_id(token_data)
    documents = vector_store_manager.list_documents(user_id)
    return [DocumentInfo(id=doc["id"], fileName=doc["file_name"], chunkCount=doc["chunk_count"]) for doc in documents]


@router.delete("/documents/{document_id}")
async def delete_document(document_id: str, token_data: dict = Depends(validate_token)):
    user_id = get_user_id(token_data)
    removed = vector_store_manager.delete_document(user_id, document_id)
    if removed == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"success": True, "message": "Document deleted"}
