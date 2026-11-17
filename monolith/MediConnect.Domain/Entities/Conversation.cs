using System;
using System.Collections.Generic;

namespace MediConnect.Domain.Entities
{
    public class Conversation
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public Guid PatientId { get; set; }
        public ApplicationUser Patient { get; set; } = null!;
        public Guid DoctorId { get; set; }
        public ApplicationUser Doctor { get; set; } = null!;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public ICollection<Message> Messages { get; set; } = new List<Message>();
    }
}
