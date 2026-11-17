using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using MediConnect.Domain.Interfaces;
using Microsoft.Extensions.Logging;

namespace MediConnect.Infrastructure.Services
{
    public class AiServiceClient : IAiServiceClient
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<AiServiceClient> _logger;
        private readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        public AiServiceClient(HttpClient httpClient, ILogger<AiServiceClient> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
        }

        public async Task<ChatResponse> GetChatResponseAsync(ChatRequest request, string token)
        {
            return await PostToAiServiceAsync("api/v1/ai/chat", request, token);
        }

        public async Task<ChatResponse> GetAppointmentAssistanceAsync(ChatRequest request, string token)
        {
            return await PostToAiServiceAsync("api/v1/ai/appointment", request, token);
        }

        public async Task<AiDocumentResult> UploadDocumentAsync(Stream content, string fileName, string contentType, string token)
        {
            try
            {
                using var form = new MultipartFormDataContent();
                var fileContent = new StreamContent(content);
                fileContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
                form.Add(fileContent, "file", fileName);

                using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "api/v1/ai/documents")
                {
                    Content = form
                };
                httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

                var response = await _httpClient.SendAsync(httpRequest);
                var body = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("AI Service upload error: {StatusCode} - {Error}", response.StatusCode, body);
                    return new AiDocumentResult(false, ExtractErrorMessage(body, response.StatusCode));
                }

                var result = JsonSerializer.Deserialize<AiDocumentResult>(body, _jsonOptions);
                return result ?? new AiDocumentResult(false, "Empty response from AI service");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upload document to AI Service");
                return new AiDocumentResult(false, "AI service unavailable");
            }
        }

        public async Task<List<AiDocumentInfo>> GetDocumentsAsync(string token)
        {
            using var httpRequest = new HttpRequestMessage(HttpMethod.Get, "api/v1/ai/documents");
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var response = await _httpClient.SendAsync(httpRequest);
            if (!response.IsSuccessStatusCode)
            {
                return new List<AiDocumentInfo>();
            }

            var docs = await response.Content.ReadFromJsonAsync<List<AiDocumentInfo>>(_jsonOptions);
            return docs ?? new List<AiDocumentInfo>();
        }

        public async Task<bool> DeleteDocumentAsync(string documentId, string token)
        {
            using var httpRequest = new HttpRequestMessage(HttpMethod.Delete, $"api/v1/ai/documents/{Uri.EscapeDataString(documentId)}");
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            var response = await _httpClient.SendAsync(httpRequest);
            return response.IsSuccessStatusCode;
        }

        private static string ExtractErrorMessage(string body, System.Net.HttpStatusCode statusCode)
        {
            try
            {
                using var doc = JsonDocument.Parse(body);
                if (doc.RootElement.TryGetProperty("detail", out var detail))
                {
                    return detail.ToString();
                }
                if (doc.RootElement.TryGetProperty("message", out var message))
                {
                    return message.ToString();
                }
            }
            catch { }
            return $"AI service returned {(int)statusCode}";
        }

        private async Task<ChatResponse> PostToAiServiceAsync(string endpoint, ChatRequest request, string token)
        {
            try
            {
                var httpRequest = new HttpRequestMessage(HttpMethod.Post, endpoint)
                {
                    Content = JsonContent.Create(request)
                };
                httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

                var response = await _httpClient.SendAsync(httpRequest);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError("AI Service error: {StatusCode} - {Error}", response.StatusCode, errorContent);
                    throw new Exception($"AI Service returned {response.StatusCode}");
                }

                return await response.Content.ReadFromJsonAsync<ChatResponse>(_jsonOptions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to call AI Service at {Endpoint}", endpoint);
                throw;
            }
        }
    }
}
