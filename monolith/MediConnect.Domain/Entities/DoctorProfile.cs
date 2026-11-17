namespace MediConnect.Domain.Entities;

public class DoctorProfile
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    
    public ApplicationUser User { get; set; } = null!;
    
    public string FullName { get; set; } = string.Empty;

    public string Specialty { get; set; } = string.Empty;

    public string Bio { get; set; } = string.Empty;

    public decimal ConsultationFee { get; set; }

    public int YearsOfExperience { get; set; }

    public string City { get; set; } = string.Empty;

    public string? ProfileImage { get; set; }

    public string? Availability { get; set; }

    public bool IsApproved { get; set; }
}
