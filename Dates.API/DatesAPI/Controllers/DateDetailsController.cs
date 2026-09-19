using DatesAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DatesAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DateDetailsController : ControllerBase
    {
        private readonly DateDetailsContext _context;
        private readonly UserDetailsContext _userDetailsContext;

        public DateDetailsController(DateDetailsContext context, UserDetailsContext userDetailsContext)
        {
            _context = context;
            _userDetailsContext = userDetailsContext;
        }
        
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DateDetails>>> GetDateDetailsForUser()
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return NotFound("User not found!");
            }

            return Ok(await _context.DateDetails
                .Where(date => date.UserId == user.UserID)
                .OrderBy(date => date.EventDate)
                .ToListAsync());
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<DateDetails>> PutDateDetails(int id, DateDetailsRequest request)
        {
            if (!IsValidTimeZone(request.TimeZoneId))
            {
                return BadRequest("The supplied time zone is not supported.");
            }

            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return NotFound("User not found!");
            }

            var dateDetails = await _context.DateDetails
                .FirstOrDefaultAsync(date => date.DateId == id && date.UserId == user.UserID);
            if (dateDetails == null)
            {
                return NotFound();
            }

            dateDetails.Event = request.Event.Trim();
            dateDetails.EventDate = request.EventDate.Date;
            dateDetails.TimeZoneId = request.TimeZoneId;
            dateDetails.IsRecurring = request.IsRecurring;
            dateDetails.Importance = request.Importance;
            dateDetails.EventNote = request.EventNote.Trim();
            dateDetails.ReminderOneMonth = request.ReminderOneMonth;
            dateDetails.ReminderOneWeek = request.ReminderOneWeek;
            dateDetails.ReminderOneDay = request.ReminderOneDay;
            dateDetails.ReminderSameDay = request.ReminderSameDay;
            dateDetails.OneMonthReminderSentFor = null;
            dateDetails.OneWeekReminderSentFor = null;
            dateDetails.OneDayReminderSentFor = null;
            dateDetails.SameDayReminderSentFor = null;

            await _context.SaveChangesAsync();
            return Ok(dateDetails);
        }

        [HttpPost]
        public async Task<ActionResult<DateDetails>> PostDateDetails(DateDetailsRequest request)
        {
            if (!IsValidTimeZone(request.TimeZoneId))
            {
                return BadRequest("The supplied time zone is not supported.");
            }

            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return NotFound("User not found!");
            }

            var dateDetails = new DateDetails
            {
                UserId = user.UserID,
                Event = request.Event.Trim(),
                EventDate = request.EventDate.Date,
                TimeZoneId = request.TimeZoneId,
                IsRecurring = request.IsRecurring,
                Importance = request.Importance,
                EventNote = request.EventNote.Trim(),
                ReminderOneMonth = request.ReminderOneMonth,
                ReminderOneWeek = request.ReminderOneWeek,
                ReminderOneDay = request.ReminderOneDay,
                ReminderSameDay = request.ReminderSameDay,
                InitialLoggedDate = DateTime.UtcNow
            };

            _context.DateDetails.Add(dateDetails);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetDateDetailsForUser), null, dateDetails);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDateDetails(int id)
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return NotFound("User not found!");
            }

            var dateDetails = await _context.DateDetails
                .FirstOrDefaultAsync(date => date.DateId == id && date.UserId == user.UserID);
            if (dateDetails == null)
            {
                return NotFound();
            }

            _context.DateDetails.Remove(dateDetails);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private async Task<UserDetails?> GetCurrentUserAsync()
        {
            var email = User.FindFirstValue(ClaimTypes.Name);
            if (string.IsNullOrWhiteSpace(email))
            {
                return null;
            }

            return await _userDetailsContext.UserDetails
                .FirstOrDefaultAsync(user => user.Email == email);
        }

        private static bool IsValidTimeZone(string timeZoneId)
        {
            if (string.IsNullOrWhiteSpace(timeZoneId))
            {
                return false;
            }

            try
            {
                _ = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
                return true;
            }
            catch (TimeZoneNotFoundException)
            {
                return false;
            }
            catch (InvalidTimeZoneException)
            {
                return false;
            }
        }
    }
}
