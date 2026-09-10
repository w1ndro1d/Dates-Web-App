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
            dateDetails.EventDate = request.EventDate;
            dateDetails.IsRecurring = request.IsRecurring;
            dateDetails.Importance = request.Importance;
            dateDetails.EventNote = request.EventNote.Trim();

            await _context.SaveChangesAsync();
            return Ok(dateDetails);
        }

        [HttpPost]
        public async Task<ActionResult<DateDetails>> PostDateDetails(DateDetailsRequest request)
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
            {
                return NotFound("User not found!");
            }

            var dateDetails = new DateDetails
            {
                UserId = user.UserID,
                Event = request.Event.Trim(),
                EventDate = request.EventDate,
                IsRecurring = request.IsRecurring,
                Importance = request.Importance,
                EventNote = request.EventNote.Trim(),
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
    }
}
