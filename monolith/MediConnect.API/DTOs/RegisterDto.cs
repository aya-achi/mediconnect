using MediConnect.Domain.Enums;

namespace MediConnect.API.DTOs;

public class RegisterDto
{
    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public UserRole Role { get; set; }

    public DoctorProfileDto? DoctorProfile { get; set; }
}

public class DoctorProfileDto
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