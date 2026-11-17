using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

using MediConnect.API.DTOs;
using MediConnect.Domain.Entities;
using MediConnect.Domain.Enums;
using MediConnect.Infrastructure.Persistence;

namespace MediConnect.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthController(
        AppDbContext context,
        IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }
    
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto)
    {
        if (dto.Role == UserRole.Admin)
        {
            return BadRequest(new { message = "Registration with this role is not allowed" });
        }

        if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 8)
        {
            return BadRequest(new { message = "Password must be at least 8 characters" });
        }

        var existingUser = _context.Users
            .FirstOrDefault(x => x.Email == dto.Email);

        if (existingUser != null)
        {
            return BadRequest(new { message = "Email already exists" });
        }

        var hashedPassword =
            BCrypt.Net.BCrypt.HashPassword(dto.Password);

        var user = new ApplicationUser
        {
            FullName = dto.FullName,
            Email = dto.Email,
            PasswordHash = hashedPassword,
            Role = dto.Role,
            IsActive = true
        };

        await _context.Users.AddAsync(user);
        await _context.SaveChangesAsync();

        // If registering as a doctor, create a doctor profile
        if (dto.Role == UserRole.Doctor && dto.DoctorProfile != null)
        {
            var doctorProfile = new DoctorProfile
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                FullName = dto.DoctorProfile.FullName,
                Specialty = dto.DoctorProfile.Specialty,
                Bio = dto.DoctorProfile.Bio,
                ConsultationFee = dto.DoctorProfile.ConsultationFee,
                YearsOfExperience = dto.DoctorProfile.YearsOfExperience,
                City = dto.DoctorProfile.City,
                ProfileImage = dto.DoctorProfile.ProfileImage,
                Availability = dto.DoctorProfile.Availability
            };

            await _context.DoctorProfiles.AddAsync(doctorProfile);
            await _context.SaveChangesAsync();
        }

        return Ok(CreateAuthResponse(user));
    }

    [HttpPost("login")]
    public IActionResult Login(LoginDto dto)
    {
        var user = _context.Users
            .FirstOrDefault(x => x.Email == dto.Email);

        if (user == null || !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid email or password" });
        }

        if (!user.IsActive)
        {
            return Unauthorized(new { message = "Account is deactivated" });
        }

        return Ok(CreateAuthResponse(user));
    }

    private AuthResponseDto CreateAuthResponse(ApplicationUser user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role.ToString())
        };

        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));

        var creds = new SigningCredentials(
            key,
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.Now.AddMinutes(
                Convert.ToDouble(_configuration["Jwt:DurationInMinutes"])),
            signingCredentials: creds
        );

        var jwt = new JwtSecurityTokenHandler()
            .WriteToken(token);

        return new AuthResponseDto
        {
            Token = jwt,
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email,
            Role = user.Role.ToString().ToLower()
        };
    }
}