using System.ComponentModel.DataAnnotations;

namespace DatesAPI.Models
{
    public class DateDetailsRequest
    {
        [Required]
        [MaxLength(200)]
        public string Event { get; set; } = "";

        public DateTime EventDate { get; set; }

        public bool IsRecurring { get; set; }

        [Range(1, 10)]
        public int Importance { get; set; } = 5;

        [MaxLength(200)]
        public string EventNote { get; set; } = "";
    }
}