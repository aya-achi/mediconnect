using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;

namespace MediConnect.Domain.Interfaces
{
    public record ChatMessage(string Role, string Content);

    public record ChatRequest(string Query, List<ChatMessage> ChatHistory);

    public record ChatSource(string Title, int? Page, string? Snippet, int? Number = null);

    public record ChatResponse(string Answer, List<ChatSource>? Sources = null);

    public interface IAiServiceClient
    {
        Task<ChatResponse> GetChatResponseAsync(ChatRequest request, string token);
        Task<ChatResponse> GetAppointmentAssistanceAsync(ChatRequest request, string token);
        Task<AiDocumentResult> UploadDocumentAsync(Stream content, string fileName, string contentType, string token);
        Task<List<AiDocumentInfo>> GetDocumentsAsync(string token);
        Task<bool> DeleteDocumentAsync(string documentId, string token);
    }

    public record AiDocumentInfo(string Id, string FileName, int ChunkCount);

    public record AiDocumentResult(bool Success, string Message, AiDocumentInfo? Document = null);
}
