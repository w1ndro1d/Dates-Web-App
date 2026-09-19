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

        [Column(TypeName = "date")]
        public DateTime EventDate { get; set; }

        [Required]
        [MaxLength(100)]
        [Column(TypeName = "nvarchar(100)")]
        public string TimeZoneId { get; set; } = "UTC";

        public bool IsRecurring { get; set; }

        [Range(1, 10)]
        public int Importance { get; set; } = 5;

        [MaxLength(200)]
        [Column(TypeName = "nvarchar(200)")]
        public string EventNote { get; set; } = "";

        public bool ReminderOneMonth { get; set; }

        public bool ReminderOneWeek { get; set; }

        public bool ReminderOneDay { get; set; }

        public bool ReminderSameDay { get; set; }

        public DateTime? OneMonthReminderSentFor { get; set; }

        public DateTime? OneWeekReminderSentFor { get; set; }

        public DateTime? OneDayReminderSentFor { get; set; }

        public DateTime? SameDayReminderSentFor { get; set; }

        [Column(TypeName = "datetime")]
        public DateTime InitialLoggedDate { get; set; }

    }
}
