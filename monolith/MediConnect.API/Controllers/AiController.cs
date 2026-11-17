using System.Threading.Tasks;
using MediConnect.Domain.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MediConnect.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AiController : ControllerBase
    {
        private readonly IAiServiceClient _aiServiceClient;
        private readonly ILogger<AiController> _logger;

        public AiController(IAiServiceClient aiServiceClient, ILogger<AiController> logger)
        {
            _aiServiceClient = aiServiceClient;
            _logger = logger;
        }

        [HttpPost("chat")]
        public async Task<IActionResult> MedicalChat([FromBody] ChatRequest request)
        {
            var token = GetBearerToken();
            try
            {
                var result = await _aiServiceClient.GetChatResponseAsync(request, token);
                return Ok(result);
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Error calling AI service chat endpoint");
                return StatusCode(500, new { message = "AI service error" });
            }
        }

        [HttpPost("appointment")]
        public async Task<IActionResult> AppointmentAssistant([FromBody] ChatRequest request)
        {
            var token = GetBearerToken();
            try
            {
                var result = await _aiServiceClient.GetAppointmentAssistanceAsync(request, token);
                return Ok(result);
            }
            catch (System.Exception ex)
            {
                _logger.LogError(ex, "Error calling AI service appointment endpoint");
                return StatusCode(500, new { message = "AI service error" });
            }
        }

        [HttpPost("documents")]
        [RequestSizeLimit(15 * 1024 * 1024)]
        public async Task<IActionResult> UploadDocument(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file provided" });
            }

            var token = GetBearerToken();
            await using var stream = file.OpenReadStream();
            var result = await _aiServiceClient.UploadDocumentAsync(
                stream, file.FileName, file.ContentType ?? "application/octet-stream", token);

            if (!result.Success)
            {
                return BadRequest(new { message = result.Message });
            }

            return Ok(result);
        }

        [HttpGet("documents")]
        public async Task<IActionResult> GetDocuments()
        {
            var documents = await _aiServiceClient.GetDocumentsAsync(GetBearerToken());
            return Ok(documents);
        }

        [HttpDelete("documents/{id}")]
        public async Task<IActionResult> DeleteDocument(string id)
        {
            var deleted = await _aiServiceClient.DeleteDocumentAsync(id, GetBearerToken());
            return deleted ? NoContent() : NotFound(new { message = "Document not found" });
        }

        private string GetBearerToken()
        {
            return Request.Headers["Authorization"].ToString().Replace("Bearer ", "");
        }
    }
}
