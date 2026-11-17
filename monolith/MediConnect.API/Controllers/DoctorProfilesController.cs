using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using MediConnect.Domain.Entities;
using MediConnect.Domain.Enums;
using MediConnect.Infrastructure.Persistence;

namespace MediConnect.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DoctorProfilesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<DoctorProfilesController> _logger;

    public DoctorProfilesController(AppDbContext context, ILogger<DoctorProfilesController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpPost]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> CreateMyProfile([FromBody] CreateDoctorProfileDto dto)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            _logger.LogInformation("Creating doctor profile for user {UserId}", userId);

            // Check if profile already exists
            var existing = await _context.DoctorProfiles
                .FirstOrDefaultAsync(dp => dp.UserId == userId);
            
            if (existing != null)
            {
                _logger.LogInformation("Doctor profile already exists for user {UserId}", userId);
                return Ok(existing);
            }

            var profile = new DoctorProfile
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                FullName = dto.FullName,
                Specialty = dto.Specialty,
                Bio = dto.Bio,
                ConsultationFee = dto.ConsultationFee,
                YearsOfExperience = dto.YearsOfExperience,
                City = dto.City,
                ProfileImage = dto.ProfileImage,
                Availability = dto.Availability
            };

            await _context.DoctorProfiles.AddAsync(profile);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Doctor profile created successfully for user {UserId}", userId);
            return Ok(profile);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating doctor profile");
            return StatusCode(500, new { message = "Error creating doctor profile" });
        }
    }

    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAllDoctors([FromQuery] string? specialty = null, [FromQuery] string? city = null)
    {
        try
        {
            _logger.LogInformation("Fetching all doctors with filters - Specialty: {Specialty}, City: {City}", specialty, city);

            var query = _context.DoctorProfiles
                .Include(dp => dp.User)
                .Where(dp => dp.User.IsActive);

            // Non-admin callers only see approved doctors; admins see all.
            if (User.FindFirstValue(ClaimTypes.Role) != "Admin")
            {
                query = query.Where(dp => dp.IsApproved);
            }

            if (!string.IsNullOrEmpty(specialty))
            {
                query = query.Where(dp => dp.Specialty == specialty);
            }

            if (!string.IsNullOrEmpty(city))
            {
                query = query.Where(dp => dp.City == city);
            }

            var doctors = await query.ToListAsync();

            _logger.LogInformation("Found {Count} doctors", doctors.Count);
            return Ok(doctors);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching doctors");
            return StatusCode(500, new { message = "Error fetching doctors" });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetDoctorById(Guid id)
    {
        try
        {
            _logger.LogInformation("Fetching doctor profile with ID {DoctorId}", id);

            var doctor = await _context.DoctorProfiles
                .Include(dp => dp.User)
                .FirstOrDefaultAsync(dp => dp.Id == id);

            if (doctor == null)
            {
                _logger.LogWarning("Doctor profile not found with ID {DoctorId}", id);
                return NotFound(new { message = "Doctor profile not found" });
            }

            return Ok(doctor);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching doctor profile with ID {DoctorId}", id);
            return StatusCode(500, new { message = "Error fetching doctor profile" });
        }
    }

    [HttpGet("user/{userId}")]
    public async Task<IActionResult> GetDoctorByUserId(Guid userId)
    {
        try
        {
            _logger.LogInformation("Fetching doctor profile for user {UserId}", userId);

            var doctor = await _context.DoctorProfiles
                .Include(dp => dp.User)
                .FirstOrDefaultAsync(dp => dp.UserId == userId);

            if (doctor == null)
            {
                _logger.LogWarning("Doctor profile not found for user {UserId}", userId);
                return NotFound(new { message = "Doctor profile not found" });
            }

            return Ok(doctor);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching doctor profile for user {UserId}", userId);
            return StatusCode(500, new { message = "Error fetching doctor profile" });
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Doctor")]
    public async Task<IActionResult> UpdateDoctorProfile(Guid id, [FromBody] UpdateDoctorProfileDto dto)
    {
        try
        {
            var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            
            _logger.LogInformation("Updating doctor profile {DoctorId} by user {UserId}", id, userId);

            var doctor = await _context.DoctorProfiles
                .Include(dp => dp.User)
                .FirstOrDefaultAsync(dp => dp.Id == id);

            if (doctor == null)
            {
                _logger.LogWarning("Doctor profile not found with ID {DoctorId}", id);
                return NotFound(new { message = "Doctor profile not found" });
            }

            // Verify ownership
            if (doctor.UserId != userId)
            {
                _logger.LogWarning("User {UserId} attempted to update doctor profile {DoctorId} owned by another user", userId, id);
                return Forbid();
            }

            doctor.FullName = dto.FullName;
            doctor.Specialty = dto.Specialty;
            doctor.Bio = dto.Bio;
            doctor.ConsultationFee = dto.ConsultationFee;
            doctor.YearsOfExperience = dto.YearsOfExperience;
            doctor.City = dto.City;
            doctor.ProfileImage = dto.ProfileImage;
            doctor.Availability = dto.Availability;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Doctor profile {DoctorId} updated successfully", id);
            return Ok(doctor);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating doctor profile {DoctorId}", id);
            return StatusCode(500, new { message = "Error updating doctor profile" });
        }
    }
}

public class CreateDoctorProfileDto
{
    public string FullName { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
    public string Bio { get; set; } = string.Empty;
    public decimal ConsultationFee { get; set; }
    public int YearsOfExperience { get; set; }
    public string City { get; set; } = string.Empty;
    public string? ProfileImage { get; set; }
    public string? Availability { get; set; }
}

public class UpdateDoctorProfileDto
{
    public string FullName { get; set; } = string.Empty;
    public string Specialty { get; set; } = string.Empty;
    public string Bio { get; set; } = string.Empty;
    public decimal ConsultationFee { get; set; }
    public int YearsOfExperience { get; set; }
    public string City { get; set; } = string.Empty;
    public string? ProfileImage { get; set; }
    public string? Availability { get; set; }
}
