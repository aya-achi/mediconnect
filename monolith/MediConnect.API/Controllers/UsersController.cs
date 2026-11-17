using Microsoft.AspNetCore.Mvc;
using MediConnect.Domain.Entities;
using MediConnect.Domain.Enums;
using MediConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using MediConnect.API.DTOs;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace MediConnect.API.Controllers;
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;

    public UsersController(AppDbContext context)
    {
        _context = context;
    }

  [HttpPost]
  [AllowAnonymous]
public async Task<IActionResult> CreateUser(CreateUserDto dto)
{
    if (dto.Role == UserRole.Admin)
    {
        return BadRequest(new { message = "Registration with this role is not allowed" });
    }

    var user = new ApplicationUser
    {
        FullName = dto.FullName,
        Email = dto.Email,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
        Role = dto.Role,
        IsActive = true
    };

    await _context.Users.AddAsync(user);

    await _context.SaveChangesAsync();

    return Ok(UserDto.FromEntity(user));
}
    
    [HttpGet]
    [Authorize(Roles = "Admin")]
public async Task<IActionResult> GetAllUsers()
{
    var users = await _context.Users.ToListAsync();

    return Ok(users.Select(UserDto.FromEntity));
}

[HttpGet("doctors")]
public async Task<IActionResult> GetDoctors()
{
    var query = _context.Users
        .Where(u => u.Role == UserRole.Doctor && u.IsActive);

    // Non-admin callers only see approved doctors
    if (User.FindFirstValue(ClaimTypes.Role) != "Admin")
    {
        query = query.Where(u => _context.DoctorProfiles
            .Any(dp => dp.UserId == u.Id && dp.IsApproved));
    }

    var doctors = await query
        .Select(u => new { u.Id, u.FullName, u.Email })
        .ToListAsync();

    return Ok(doctors);
}

[HttpGet("{id}")]
public async Task<IActionResult> GetUserById(Guid id)
{
    var user = await _context.Users.FindAsync(id);

    if (user == null)
    {
        return NotFound("User not found");
    }

    var callerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
    var isAdmin = User.IsInRole("Admin");
    if (!isAdmin && callerId != id.ToString())
    {
        return Forbid();
    }

    return Ok(UserDto.FromEntity(user));
}

[HttpDelete("{id}")]
[Authorize(Roles = "Admin")]
public async Task<IActionResult> DeleteUser(Guid id)
{
    var user = await _context.Users.FindAsync(id);

    if (user == null)
    {
        return NotFound("User not found");
    }

    // Remove dependent rows first: appointments, conversations and messages
    // reference users with DeleteBehavior.Restrict.
    var doctorProfileIds = await _context.DoctorProfiles
        .Where(dp => dp.UserId == id)
        .Select(dp => dp.Id)
        .ToListAsync();

    var appointments = await _context.Appointments
        .Where(a => a.PatientId == id || doctorProfileIds.Contains(a.DoctorProfileId))
        .ToListAsync();
    _context.Appointments.RemoveRange(appointments);

    var conversations = await _context.Conversations
        .Where(c => c.PatientId == id || c.DoctorId == id)
        .ToListAsync();
    _context.Conversations.RemoveRange(conversations);

    var sentMessages = await _context.Messages
        .Where(m => m.SenderId == id)
        .ToListAsync();
    _context.Messages.RemoveRange(sentMessages);

    var applications = await _context.DoctorApplications
        .Where(a => a.UserId == id)
        .ToListAsync();
    _context.DoctorApplications.RemoveRange(applications);

    _context.Users.Remove(user);

    await _context.SaveChangesAsync();

    return Ok("User deleted");
}

[HttpPut("{id}")]
public async Task<IActionResult> UpdateUser(Guid id, UpdateUserDto dto)
{
    var user = await _context.Users.FindAsync(id);

    if (user == null)
    {
        return NotFound("User not found");
    }

    var callerId = User.FindFirstValue(ClaimTypes.NameIdentifier);
    var isAdmin = User.IsInRole("Admin");
    if (!isAdmin && callerId != id.ToString())
    {
        return Forbid();
    }

    user.FullName = dto.FullName;
    user.Email = dto.Email;
    if (isAdmin && dto.IsActive.HasValue)
    {
        user.IsActive = dto.IsActive.Value;
    }

    await _context.SaveChangesAsync();

    return Ok(UserDto.FromEntity(user));
}
}