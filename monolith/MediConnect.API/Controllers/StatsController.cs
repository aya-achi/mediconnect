using MediConnect.Domain.Enums;
using MediConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MediConnect.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class StatsController : ControllerBase
{
    private readonly AppDbContext _context;

    public StatsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetStats()
    {
        var today = DateTime.UtcNow.Date;
        var tomorrow = today.AddDays(1);

        var stats = new
        {
            totalPatients = await _context.Users.CountAsync(u => u.Role == UserRole.Patient),
            totalDoctors = await _context.Users.CountAsync(u => u.Role == UserRole.Doctor && u.IsActive),
            approvedDoctors = await _context.DoctorProfiles.CountAsync(dp => dp.IsApproved),
            pendingApplications = await _context.DoctorApplications.CountAsync(a => a.Status == ApplicationStatus.Pending),
            totalAppointments = await _context.Appointments.CountAsync(),
            appointmentsToday = await _context.Appointments.CountAsync(a => a.AppointmentDate >= today && a.AppointmentDate < tomorrow),
            totalUsers = await _context.Users.CountAsync(),
        };

        return Ok(stats);
    }
}
