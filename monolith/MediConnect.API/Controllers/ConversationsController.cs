using System.Collections.Generic;
using System.Linq;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using MediConnect.Domain.Entities;
using MediConnect.Infrastructure.Persistence;

namespace MediConnect.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ConversationsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<ConversationsController> _logger;

    public ConversationsController(AppDbContext context, ILogger<ConversationsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetConversations()
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var userRole = User.FindFirstValue(ClaimTypes.Role);
            
            _logger.LogInformation("Fetching conversations for user {UserId} with role {Role}", userId, userRole);

            var conversations = await _context.Conversations
                .Include(c => c.Patient)
                .Include(c => c.Doctor)
                .Include(c => c.Messages.OrderByDescending(m => m.SentAt))
                .Where(c => userRole == "Doctor" ? c.DoctorId == userId : c.PatientId == userId)
                .OrderByDescending(c => c.Messages.Any() ? c.Messages.Max(m => m.SentAt) : c.CreatedAt)
                .ToListAsync();

            return Ok(conversations.Select(ToConversationDto));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching conversations");
            return StatusCode(500, new { message = "Error fetching conversations" });
        }
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetConversation(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            _logger.LogInformation("Fetching conversation {ConversationId} for user {UserId}", id, userId);

            var conversation = await _context.Conversations
                .Include(c => c.Patient)
                .Include(c => c.Doctor)
                .Include(c => c.Messages.OrderBy(m => m.SentAt))
                .FirstOrDefaultAsync(c => c.Id == id);

            if (conversation == null)
            {
                return NotFound(new { message = "Conversation not found" });
            }

            // Verify user is part of the conversation
            if (conversation.PatientId != userId && conversation.DoctorId != userId)
            {
                return Forbid();
            }

            return Ok(ToConversationDto(conversation));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching conversation {ConversationId}", id);
            return StatusCode(500, new { message = "Error fetching conversation" });
        }
    }

    [HttpGet("{id:guid}/messages")]
    public async Task<IActionResult> GetMessages(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            _logger.LogInformation("Fetching messages for conversation {ConversationId}", id);

            var conversation = await _context.Conversations
                .FirstOrDefaultAsync(c => c.Id == id);

            if (conversation == null)
            {
                return NotFound(new { message = "Conversation not found" });
            }

            // Verify user is part of the conversation
            if (conversation.PatientId != userId && conversation.DoctorId != userId)
            {
                return Forbid();
            }

            var messages = await _context.Messages
                .Include(m => m.Sender)
                .Where(m => m.ConversationId == id)
                .OrderBy(m => m.SentAt)
                .ToListAsync();

            return Ok(messages.Select(ToMessageDto));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching messages for conversation {ConversationId}", id);
            return StatusCode(500, new { message = "Error fetching messages" });
        }
    }

    [HttpPost("initiate")]
    public async Task<IActionResult> InitiateConversation([FromBody] InitiateConversationDto dto)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            _logger.LogInformation("Initiating conversation between patient {PatientId} and doctor {DoctorId}", dto.PatientId, dto.DoctorId);

            // Only approved doctors can be contacted by patients
            var doctorProfile = await _context.DoctorProfiles
                .FirstOrDefaultAsync(dp => dp.UserId == dto.DoctorId);
            if (doctorProfile == null || !doctorProfile.IsApproved)
            {
                _logger.LogWarning("Conversation refused: doctor {DoctorId} is not approved", dto.DoctorId);
                return BadRequest(new { message = "This doctor is not yet approved and cannot be contacted" });
            }

            // Check if conversation already exists
            var existing = await _context.Conversations
                .FirstOrDefaultAsync(c => c.PatientId == dto.PatientId && c.DoctorId == dto.DoctorId);

            if (existing != null)
            {
                _logger.LogInformation("Conversation already exists between patient {PatientId} and doctor {DoctorId}", dto.PatientId, dto.DoctorId);
                return Ok(existing);
            }

            // Verify the current user is either the patient or doctor
            if (userId != dto.PatientId && userId != dto.DoctorId)
            {
                _logger.LogWarning("User {UserId} attempted to initiate conversation for other users", userId);
                return Forbid();
            }

            var conversation = new Conversation
            {
                Id = Guid.NewGuid(),
                PatientId = dto.PatientId,
                DoctorId = dto.DoctorId,
                CreatedAt = DateTime.UtcNow
            };

            await _context.Conversations.AddAsync(conversation);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Conversation initiated successfully with ID {ConversationId}", conversation.Id);
            return Ok(conversation);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initiating conversation");
            return StatusCode(500, new { message = "Error initiating conversation" });
        }
    }

    [HttpPost("{id:guid}/messages")]
    public async Task<IActionResult> SendMessage(Guid id, [FromBody] SendMessageDto dto)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            _logger.LogInformation("Sending message to conversation {ConversationId} from user {UserId}", id, userId);

            var conversation = await _context.Conversations
                .FirstOrDefaultAsync(c => c.Id == id);

            if (conversation == null)
            {
                return NotFound(new { message = "Conversation not found" });
            }

            // Verify user is part of the conversation
            if (conversation.PatientId != userId && conversation.DoctorId != userId)
            {
                _logger.LogWarning("User {UserId} attempted to send message to conversation {ConversationId} they are not part of", userId, id);
                return Forbid();
            }

            var message = new Message
            {
                Id = Guid.NewGuid(),
                ConversationId = id,
                SenderId = userId,
                Content = dto.Content,
                SentAt = DateTime.UtcNow,
                IsRead = false
            };

            await _context.Messages.AddAsync(message);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Message sent successfully with ID {MessageId}", message.Id);
            return Ok(ToMessageDto(message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message to conversation {ConversationId}", id);
            return StatusCode(500, new { message = "Error sending message" });
        }
    }

    [HttpPut("{conversationId:guid}/messages/{messageId:guid}/read")]
    public async Task<IActionResult> MarkMessageAsRead(Guid conversationId, Guid messageId)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            _logger.LogInformation("Marking message {MessageId} as read by user {UserId}", messageId, userId);

            var message = await _context.Messages
                .Include(m => m.Conversation)
                .FirstOrDefaultAsync(m => m.Id == messageId);

            if (message == null)
            {
                return NotFound(new { message = "Message not found" });
            }

            // Verify user is part of the conversation
            if (message.Conversation.PatientId != userId && message.Conversation.DoctorId != userId)
            {
                return Forbid();
            }

            // Only recipient can mark as read
            if (message.SenderId == userId)
            {
                return BadRequest(new { message = "Cannot mark own message as read" });
            }

            message.IsRead = true;
            await _context.SaveChangesAsync();

            return Ok(ToMessageDto(message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking message {MessageId} as read", messageId);
            return StatusCode(500, new { message = "Error marking message as read" });
        }
    }

    private static MessageDto ToMessageDto(Message m) => new()
    {
        Id = m.Id,
        ConversationId = m.ConversationId,
        SenderId = m.SenderId,
        Content = m.Content,
        SentAt = m.SentAt,
        IsRead = m.IsRead
    };

    private static ConversationDto ToConversationDto(Conversation c) => new()
    {
        Id = c.Id,
        PatientId = c.PatientId,
        DoctorId = c.DoctorId,
        CreatedAt = c.CreatedAt,
        PatientName = c.Patient?.FullName,
        DoctorName = c.Doctor?.FullName,
        Messages = c.Messages?.Select(ToMessageDto).ToList() ?? new List<MessageDto>()
    };
}

public class MessageDto
{
    public Guid Id { get; set; }
    public Guid ConversationId { get; set; }
    public Guid SenderId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime SentAt { get; set; }
    public bool IsRead { get; set; }
}

public class ConversationDto
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid DoctorId { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? PatientName { get; set; }
    public string? DoctorName { get; set; }
    public List<MessageDto> Messages { get; set; } = new();
}

public class InitiateConversationDto
{
    public Guid PatientId { get; set; }
    public Guid DoctorId { get; set; }
}

public class SendMessageDto
{
    public string Content { get; set; } = string.Empty;
}
