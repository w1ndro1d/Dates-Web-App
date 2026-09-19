using System.ComponentModel.DataAnnotations;

namespace DatesAPI.Models
{
    public class EmailVerificationRequest
    {
        [Required]
        [EmailAddress]
        [MaxLength(256)]
        public string Email { get; set; } = "";
    }
}
