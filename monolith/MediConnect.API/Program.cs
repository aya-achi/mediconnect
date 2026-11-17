using Microsoft.EntityFrameworkCore;
using MediConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using FluentValidation;
using FluentValidation.AspNetCore;
using MediConnect.API.Validators;
using MediConnect.Domain.Interfaces;
using MediConnect.Infrastructure.Services;


var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddHttpClient<IAiServiceClient, AiServiceClient>(client =>
{
    var aiServiceUrl = builder.Configuration["AiService:Url"] ?? "http://localhost:8000";
    client.BaseAddress = new Uri(aiServiceUrl.TrimEnd('/') + "/");
});

builder.Services.AddFluentValidationAutoValidation();

builder.Services.AddValidatorsFromAssemblyContaining<CreateUserDtoValidator>();

builder.Services.AddEndpointsApiExplorer();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (connectionString?.Contains("Host=") == true)
    {
        options.UseNpgsql(connectionString);
    }
    else
    {
        options.UseSqlite(connectionString);
    }
});

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,

        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],

        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!))
    };
});

var allowedOrigins = builder.Configuration["Cors:AllowedOrigins"]
    ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? ["http://localhost:8081"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy =>
        {
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();

    if (connectionString?.Contains("Host=") == true)
    {
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS "DoctorApplications" (
                "Id" uuid NOT NULL PRIMARY KEY,
                "UserId" uuid NOT NULL,
                "FullName" text NOT NULL,
                "Email" text NOT NULL,
                "Specialty" text NOT NULL,
                "LicenseNumber" text NOT NULL,
                "City" text NOT NULL,
                "YearsOfExperience" integer NOT NULL,
                "Bio" text NOT NULL,
                "DocumentCount" integer NOT NULL,
                "Status" integer NOT NULL,
                "SubmittedAt" timestamp with time zone NOT NULL
            );
            """);
    }

    // Seed sample doctors for testing
    if (!db.Users.Any())
    {
        var passwordHash = BCrypt.Net.BCrypt.HashPassword("Password123!");
        
        // Create sample doctors
        var doctor1 = new MediConnect.Domain.Entities.ApplicationUser
        {
            Id = Guid.NewGuid(),
            FullName = "Dr. Sarah Mitchell",
            Email = "sarah.mitchell@mediconnect.com",
            PasswordHash = passwordHash,
            Role = MediConnect.Domain.Enums.UserRole.Doctor,
            IsActive = true
        };
        
        var doctor2 = new MediConnect.Domain.Entities.ApplicationUser
        {
            Id = Guid.NewGuid(),
            FullName = "Dr. James Carter",
            Email = "james.carter@mediconnect.com",
            PasswordHash = passwordHash,
            Role = MediConnect.Domain.Enums.UserRole.Doctor,
            IsActive = true
        };
        
        var doctor3 = new MediConnect.Domain.Entities.ApplicationUser
        {
            Id = Guid.NewGuid(),
            FullName = "Dr. Emily Chen",
            Email = "emily.chen@mediconnect.com",
            PasswordHash = passwordHash,
            Role = MediConnect.Domain.Enums.UserRole.Doctor,
            IsActive = true
        };
        
        db.Users.AddRange(doctor1, doctor2, doctor3);
        
        // Create doctor profiles
        var profile1 = new MediConnect.Domain.Entities.DoctorProfile
        {
            Id = Guid.NewGuid(),
            UserId = doctor1.Id,
            FullName = "Dr. Sarah Mitchell",
            Specialty = "Cardiology",
            City = "Paris",
            YearsOfExperience = 15,
            Bio = "Experienced cardiologist specializing in heart disease prevention and treatment.",
            ConsultationFee = 80,
            IsApproved = true
        };
        
        var profile2 = new MediConnect.Domain.Entities.DoctorProfile
        {
            Id = Guid.NewGuid(),
            UserId = doctor2.Id,
            FullName = "Dr. James Carter",
            Specialty = "Dermatology",
            City = "Lyon",
            YearsOfExperience = 12,
            Bio = "Board-certified dermatologist with expertise in skin cancer screening and cosmetic procedures.",
            ConsultationFee = 65,
            IsApproved = true
        };
        
        var profile3 = new MediConnect.Domain.Entities.DoctorProfile
        {
            Id = Guid.NewGuid(),
            UserId = doctor3.Id,
            FullName = "Dr. Emily Chen",
            Specialty = "Neurology",
            City = "Marseille",
            YearsOfExperience = 10,
            Bio = "Neurologist specializing in headache disorders and neurological rehabilitation.",
            ConsultationFee = 75,
            IsApproved = true
        };
        
        db.DoctorProfiles.AddRange(profile1, profile2, profile3);
        
        // Create a sample patient
        var patient = new MediConnect.Domain.Entities.ApplicationUser
        {
            Id = Guid.NewGuid(),
            FullName = "John Doe",
            Email = "john.doe@example.com",
            PasswordHash = passwordHash,
            Role = MediConnect.Domain.Enums.UserRole.Patient,
            IsActive = true
        };
        
        db.Users.Add(patient);
        
        db.SaveChanges();
    }

    // Development-only admin account; credentials come from Seed__AdminEmail / Seed__AdminPassword
    if (app.Environment.IsDevelopment())
    {
        var adminEmail = builder.Configuration["Seed:AdminEmail"];
        var adminPassword = builder.Configuration["Seed:AdminPassword"];

        if (!string.IsNullOrEmpty(adminEmail)
            && !string.IsNullOrEmpty(adminPassword)
            && !db.Users.Any(u => u.Email == adminEmail))
        {
            db.Users.Add(new MediConnect.Domain.Entities.ApplicationUser
            {
                Id = Guid.NewGuid(),
                FullName = "Admin",
                Email = adminEmail,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                Role = MediConnect.Domain.Enums.UserRole.Admin,
                IsActive = true
            });
            db.SaveChanges();
        }
    }
}

// app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

app.MapGet("/", () => Results.Redirect("http://localhost:8081"));

app.Run();