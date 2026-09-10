using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace DatesAPI.Models
{
    public class DateDetails
    {
        [Key]
        public int DateId { get; set; }
        public int UserId { get; set; }

        [Required]
        [MaxLength(200)]
        [Column(TypeName ="nvarchar(200)")]
        public string Event { get; set; } = "";

        [Column(TypeName = "datetime")]
        public DateTime EventDate { get; set; }

        public bool IsRecurring { get; set; }

        [Range(1, 10)]
        public int Importance { get; set; } = 5;

        [MaxLength(200)]
        [Column(TypeName = "nvarchar(200)")]
        public string EventNote { get; set; } = "";

        [Column(TypeName = "datetime")]
        public DateTime InitialLoggedDate { get; set; }

    }
}
