using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using MediConnect.API.DTOs;
using MediConnect.Domain.Entities;
using MediConnect.Infrastructure.Persistence;
using MediConnect.Domain.Enums;

namespace MediConnect.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AppointmentsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<AppointmentsController> _logger;

    public AppointmentsController(AppDbContext context, ILogger<AppointmentsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> CreateAppointment(CreateAppointmentDto dto)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            _logger.LogInformation("Creating appointment for patient {PatientId} with doctor profile {DoctorProfileId}", dto.PatientId, dto.DoctorProfileId);

            // Verify patient exists
            var patient = await _context.Users.FindAsync(dto.PatientId);
            if (patient == null)
            {
                _logger.LogWarning("Patient not found with ID {PatientId}", dto.PatientId);
                return BadRequest(new { message = "Patient not found" });
            }

            // Verify doctor profile exists
            var doctorProfile = await _context.DoctorProfiles
                .Include(dp => dp.User)
                .FirstOrDefaultAsync(dp => dp.Id == dto.DoctorProfileId);
            if (doctorProfile == null)
            {
                _logger.LogWarning("Doctor profile not found with ID {DoctorProfileId}", dto.DoctorProfileId);
                return BadRequest(new { message = "Doctor profile not found" });
            }

            // Verify doctor user is active
            if (!doctorProfile.User.IsActive)
            {
                _logger.LogWarning("Doctor user is not active for profile {DoctorProfileId}", dto.DoctorProfileId);
                return BadRequest(new { message = "Doctor is not active" });
            }

            // Only approved doctors can be booked
            if (!doctorProfile.IsApproved)
            {
                _logger.LogWarning("Booking attempted for unapproved doctor profile {DoctorProfileId}", dto.DoctorProfileId);
                return BadRequest(new { message = "This doctor is not yet approved and cannot be booked" });
            }

            // PostgreSQL timestamptz requires UTC
            dto.AppointmentDate = dto.AppointmentDate.ToUniversalTime();

            // Check for double booking
            var existingAppointment = await _context.Appointments
                .FirstOrDefaultAsync(a => a.DoctorProfileId == dto.DoctorProfileId 
                    && a.AppointmentDate == dto.AppointmentDate
                    && a.Status != AppointmentStatus.Cancelled);

            if (existingAppointment != null)
            {
                _logger.LogWarning("Doctor profile {DoctorProfileId} already has an appointment at {AppointmentDate}", dto.DoctorProfileId, dto.AppointmentDate);
                return BadRequest(new { message = "Doctor is already booked at this time" });
            }

            var appointment = new Appointment
            {
                Id = Guid.NewGuid(),
                AppointmentDate = dto.AppointmentDate,
                Reason = dto.Reason,
                DoctorProfileId = dto.DoctorProfileId,
                PatientId = dto.PatientId,
                Status = AppointmentStatus.Pending,
                CreatedAt = DateTime.UtcNow
            };

            await _context.Appointments.AddAsync(appointment);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Appointment created successfully with ID {AppointmentId}", appointment.Id);
            return Ok(appointment);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating appointment");
            return StatusCode(500, new { message = "Error creating appointment" });
        }
    }

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAppointments()
    {
        try
        {
            _logger.LogInformation("Fetching all appointments");

            var appointments = await _context.Appointments
                .Include(a => a.Patient)
                .Include(a => a.DoctorProfile)
                .ThenInclude(dp => dp.User)
                .OrderByDescending(a => a.AppointmentDate)
                .ToListAsync();

            return Ok(appointments);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching appointments");
            return StatusCode(500, new { message = "Error fetching appointments" });
        }
    }

    [HttpGet("doctor/me")]
    public async Task<IActionResult> GetMyDoctorAppointments()
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var doctorProfile = await _context.DoctorProfiles
                .FirstOrDefaultAsync(dp => dp.UserId == userId);

            if (doctorProfile == null)
            {
                return NotFound(new { message = "Doctor profile not found" });
            }

            var appointments = await _context.Appointments
                .Include(a => a.Patient)
                .Include(a => a.DoctorProfile)
                .Where(a => a.DoctorProfileId == doctorProfile.Id)
                .OrderByDescending(a => a.AppointmentDate)
                .ToListAsync();

            return Ok(appointments);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching appointments for current doctor");
            return StatusCode(500, new { message = "Error fetching appointments" });
        }
    }

    [HttpGet("doctor/{doctorProfileId}")]
    public async Task<IActionResult> GetDoctorAppointments(Guid doctorProfileId)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            // Get the doctor profile to verify ownership
            var doctorProfile = await _context.DoctorProfiles
                .Include(dp => dp.User)
                .FirstOrDefaultAsync(dp => dp.Id == doctorProfileId);
            
            if (doctorProfile == null)
            {
                return NotFound(new { message = "Doctor profile not found" });
            }
            
            // Verify the user is either the doctor (through their profile) or an admin
            if (doctorProfile.UserId != userId && User.FindFirstValue(ClaimTypes.Role) != "Admin")
            {
                return Forbid();
            }

            _logger.LogInformation("Fetching appointments for doctor profile {DoctorProfileId}", doctorProfileId);

            var appointments = await _context.Appointments
                .Include(a => a.Patient)
                .Include(a => a.DoctorProfile)
                .Where(a => a.DoctorProfileId == doctorProfileId)
                .OrderByDescending(a => a.AppointmentDate)
                .ToListAsync();

            return Ok(appointments);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching appointments for doctor profile {DoctorProfileId}", doctorProfileId);
            return StatusCode(500, new { message = "Error fetching appointments" });
        }
    }

    [HttpGet("patient/{patientId}")]
    public async Task<IActionResult> GetPatientAppointments(Guid patientId)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            // Verify the user is either the patient or an admin
            if (userId != patientId && User.FindFirstValue(ClaimTypes.Role) != "Admin")
            {
                return Forbid();
            }

            _logger.LogInformation("Fetching appointments for patient {PatientId}", patientId);

            var appointments = await _context.Appointments
                .Include(a => a.Patient)
                .Include(a => a.DoctorProfile)
                .ThenInclude(dp => dp.User)
                .Where(a => a.PatientId == patientId)
                .OrderByDescending(a => a.AppointmentDate)
                .ToListAsync();

            return Ok(appointments);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching appointments for patient {PatientId}", patientId);
            return StatusCode(500, new { message = "Error fetching appointments" });
        }
    }

    [HttpPut("{id}/cancel")]
    public async Task<IActionResult> CancelAppointment(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            _logger.LogInformation("Cancelling appointment {AppointmentId} by user {UserId}", id, userId);

            var appointment = await _context.Appointments
                .Include(a => a.Patient)
                .Include(a => a.DoctorProfile)
                .ThenInclude(dp => dp.User)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (appointment == null)
            {
                return NotFound(new { message = "Appointment not found" });
            }

            // Verify the user is either the patient, doctor (through profile), or admin
            if (userId != appointment.PatientId && appointment.DoctorProfile.UserId != userId && User.FindFirstValue(ClaimTypes.Role) != "Admin")
            {
                return Forbid();
            }

            appointment.Status = AppointmentStatus.Cancelled;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Appointment {AppointmentId} cancelled successfully", id);
            return Ok(appointment);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling appointment {AppointmentId}", id);
            return StatusCode(500, new { message = "Error cancelling appointment" });
        }
    }

    [HttpPut("{id}/confirm")]
    public async Task<IActionResult> ConfirmAppointment(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            _logger.LogInformation("Confirming appointment {AppointmentId} by user {UserId}", id, userId);

            var appointment = await _context.Appointments
                .Include(a => a.Patient)
                .Include(a => a.DoctorProfile)
                .ThenInclude(dp => dp.User)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (appointment == null)
            {
                return NotFound(new { message = "Appointment not found" });
            }

            // Only doctors can confirm appointments
            if (appointment.DoctorProfile.UserId != userId && User.FindFirstValue(ClaimTypes.Role) != "Admin")
            {
                return Forbid();
            }

            appointment.Status = AppointmentStatus.Confirmed;
            await _context.SaveChangesAsync();

            // Create conversation between patient and doctor
            var existingConversation = await _context.Conversations
                .FirstOrDefaultAsync(c => c.PatientId == appointment.PatientId && c.DoctorId == appointment.DoctorProfile.UserId);

            if (existingConversation == null)
            {
                var conversation = new Conversation
                {
                    Id = Guid.NewGuid(),
                    PatientId = appointment.PatientId,
                    DoctorId = appointment.DoctorProfile.UserId,
                    CreatedAt = DateTime.UtcNow
                };

                await _context.Conversations.AddAsync(conversation);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Conversation created between patient {PatientId} and doctor {DoctorId}", appointment.PatientId, appointment.DoctorProfile.UserId);
            }

            _logger.LogInformation("Appointment {AppointmentId} confirmed successfully", id);
            return Ok(appointment);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error confirming appointment {AppointmentId}", id);
            return StatusCode(500, new { message = "Error confirming appointment" });
        }
    }

    [HttpPut("{id}/complete")]
    public async Task<IActionResult> CompleteAppointment(Guid id)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            _logger.LogInformation("Completing appointment {AppointmentId} by user {UserId}", id, userId);

            var appointment = await _context.Appointments
                .Include(a => a.Patient)
                .Include(a => a.DoctorProfile)
                .ThenInclude(dp => dp.User)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (appointment == null)
            {
                return NotFound(new { message = "Appointment not found" });
            }

            // Only doctors can complete appointments
            if (appointment.DoctorProfile.UserId != userId && User.FindFirstValue(ClaimTypes.Role) != "Admin")
            {
                return Forbid();
            }

            appointment.Status = AppointmentStatus.Completed;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Appointment {AppointmentId} completed successfully", id);
            return Ok(appointment);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error completing appointment {AppointmentId}", id);
            return StatusCode(500, new { message = "Error completing appointment" });
        }
    }
}