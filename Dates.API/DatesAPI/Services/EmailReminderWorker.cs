using DatesAPI.Models;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Net.Mail;

namespace DatesAPI.Services
{
    public class EmailReminderWorker : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<EmailReminderWorker> _logger;

        public EmailReminderWorker(IServiceScopeFactory scopeFactory, ILogger<EmailReminderWorker> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessDueRemindersAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception exception)
                {
                    _logger.LogError(exception, "Error while processing email reminders.");
                }

                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
        }

        private async Task ProcessDueRemindersAsync(CancellationToken cancellationToken)
        {
            using var scope = _scopeFactory.CreateScope();
            var dateContext = scope.ServiceProvider.GetRequiredService<DateDetailsContext>();
            var userContext = scope.ServiceProvider.GetRequiredService<UserDetailsContext>();
            var emailSender = scope.ServiceProvider.GetRequiredService<IEmailSender>();
            var utcNow = DateTime.UtcNow;

            var events = await dateContext.DateDetails
                .Where(date => date.ReminderOneMonth || date.ReminderOneWeek || date.ReminderOneDay || date.ReminderSameDay)
                .ToListAsync(cancellationToken);

            foreach (var dateEvent in events)
            {
                TimeZoneInfo timeZone;
                try
                {
                    timeZone = TimeZoneInfo.FindSystemTimeZoneById(dateEvent.TimeZoneId);
                }
                catch (Exception exception) when (exception is TimeZoneNotFoundException or InvalidTimeZoneException)
                {
                    _logger.LogWarning(exception, "Skipping event {EventId} because time zone {TimeZoneId} is invalid.", dateEvent.DateId, dateEvent.TimeZoneId);
                    continue;
                }

                var localToday = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utcNow, timeZone));
                var occurrenceDate = GetOccurrenceDate(dateEvent, localToday);
                if (occurrenceDate < localToday)
                {
                    continue;
                }

                var user = await userContext.UserDetails
                    .SingleOrDefaultAsync(item => item.UserID == dateEvent.UserId, cancellationToken);
                if (user == null || string.IsNullOrWhiteSpace(user.Email))
                {
                    continue;
                }

                var changed = false;
                changed |= await SendIfDueAsync(dateEvent, user.Email, occurrenceDate, localToday, 0, 1, dateEvent.ReminderOneMonth, dateEvent.OneMonthReminderSentFor, "one month away", "in one month", emailSender, cancellationToken, sentDate => dateEvent.OneMonthReminderSentFor = sentDate);
                changed |= await SendIfDueAsync(dateEvent, user.Email, occurrenceDate, localToday, 7, 0, dateEvent.ReminderOneWeek, dateEvent.OneWeekReminderSentFor, "one week away", "in one week", emailSender, cancellationToken, sentDate => dateEvent.OneWeekReminderSentFor = sentDate);
                changed |= await SendIfDueAsync(dateEvent, user.Email, occurrenceDate, localToday, 1, 0, dateEvent.ReminderOneDay, dateEvent.OneDayReminderSentFor, "tomorrow", "tomorrow", emailSender, cancellationToken, sentDate => dateEvent.OneDayReminderSentFor = sentDate);
                changed |= await SendIfDueAsync(dateEvent, user.Email, occurrenceDate, localToday, 0, 0, dateEvent.ReminderSameDay, dateEvent.SameDayReminderSentFor, "today", "today", emailSender, cancellationToken, sentDate => dateEvent.SameDayReminderSentFor = sentDate);

                if (changed)
                {
                    await dateContext.SaveChangesAsync(cancellationToken);
                }
            }
        }

        private async Task<bool> SendIfDueAsync(
            DateDetails dateEvent,
            string recipient,
            DateOnly occurrenceDate,
            DateOnly localToday,
            int daysBefore,
            int monthsBefore,
            bool enabled,
            DateTime? sentFor,
            string subjectTiming,
            string bodyTiming,
            IEmailSender emailSender,
            CancellationToken cancellationToken,
            Action<DateTime> markSent)
        {
            if (!enabled || (sentFor.HasValue && DateOnly.FromDateTime(sentFor.Value) == occurrenceDate))
            {
                return false;
            }

            var dueDate = monthsBefore > 0
                ? occurrenceDate.AddMonths(-monthsBefore)
                : occurrenceDate.AddDays(-daysBefore);
            if (localToday != dueDate)
            {
                return false;
            }

            var subject = $"Reminder: {dateEvent.Event} is {subjectTiming}";
            var textBody = $"Your event is coming up {bodyTiming}.\n\n" +
                           $"Event: {dateEvent.Event}\n" +
                           $"Date: {occurrenceDate:dddd, MMMM d, yyyy}\n" +
                           $"Importance: {dateEvent.Importance}/10\n" +
                           (string.IsNullOrWhiteSpace(dateEvent.EventNote) ? "" : $"\nNote: {dateEvent.EventNote}\n") +
                           "\nThis reminder was sent by Dates.";
            var htmlBody = BuildHtmlBody(dateEvent, occurrenceDate, bodyTiming);

            try
            {
                await emailSender.SendAsync(recipient, subject, textBody, htmlBody, cancellationToken);
                markSent(occurrenceDate.ToDateTime(TimeOnly.MinValue));
                _logger.LogInformation("Sent {ReminderLabel} reminder for event {EventId} to {Recipient}.", subjectTiming, dateEvent.DateId, recipient);
                return true;
            }
            catch (Exception exception) when (exception is InvalidOperationException or SmtpException)
            {
                _logger.LogWarning(exception, "Could not send {ReminderLabel} reminder for event {EventId}.", subjectTiming, dateEvent.DateId);
                return false;
            }
        }

        private static string BuildHtmlBody(DateDetails dateEvent, DateOnly occurrenceDate, string bodyTiming)
        {
            var eventName = WebUtility.HtmlEncode(dateEvent.Event) ?? "Event";
            var timing = WebUtility.HtmlEncode(bodyTiming) ?? "soon";
            var note = (WebUtility.HtmlEncode(dateEvent.EventNote) ?? "")
                .Replace("\r\n", "<br>")
                .Replace("\n", "<br>");
            var noteRow = string.IsNullOrWhiteSpace(dateEvent.EventNote)
                ? ""
                : $"<tr><td style=\"padding:14px 0 0;color:#a9a3a0;font-size:12px;text-transform:uppercase;letter-spacing:.08em\">Note</td></tr><tr><td style=\"padding:5px 0 0;color:#f5ede3;font-size:15px;line-height:1.6\">{note}</td></tr>";

            return $"""
                <!doctype html>
                <html>
                <body style="margin:0;padding:0;background:#0d0c12;font-family:Arial,sans-serif;color:#f5ede3">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d0c12;padding:32px 16px">
                    <tr><td align="center">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#181419;border:1px solid #704827;border-radius:18px;overflow:hidden">
                        <tr><td style="height:5px;background:#f5a13a"></td></tr>
                        <tr><td style="padding:32px 34px 12px;color:#ffd184;font-size:12px;font-weight:bold;letter-spacing:.16em;text-transform:uppercase">Dates reminder</td></tr>
                        <tr><td style="padding:0 34px;color:#fff4df;font-size:28px;font-weight:bold;line-height:1.2">{eventName}</td></tr>
                        <tr><td style="padding:10px 34px 26px;color:#cfc5bb;font-size:16px;line-height:1.5">This event is coming up {timing}.</td></tr>
                        <tr><td style="padding:0 34px 32px">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#100e13;border:1px solid #3c302a;border-radius:12px;padding:20px">
                            <tr><td style="color:#a9a3a0;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Date</td></tr>
                            <tr><td style="padding:5px 0 0;color:#fff4df;font-size:17px;font-weight:bold">{occurrenceDate:dddd, MMMM d, yyyy}</td></tr>
                            <tr><td style="padding:14px 0 0;color:#a9a3a0;font-size:12px;text-transform:uppercase;letter-spacing:.08em">Importance</td></tr>
                            <tr><td style="padding:5px 0 0;color:#ffd184;font-size:15px;font-weight:bold">{dateEvent.Importance}/10</td></tr>
                            {noteRow}
                          </table>
                        </td></tr>
                        <tr><td style="padding:20px 34px;border-top:1px solid #30231e;color:#8f8884;font-size:12px;line-height:1.5">Sent by Dates · Your events, right on time.</td></tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """;
        }

        private static DateOnly GetOccurrenceDate(DateDetails dateEvent, DateOnly today)
        {
            if (!dateEvent.IsRecurring)
            {
                return DateOnly.FromDateTime(dateEvent.EventDate);
            }

            var day = Math.Min(dateEvent.EventDate.Day, DateTime.DaysInMonth(today.Year, dateEvent.EventDate.Month));
            var occurrenceDate = new DateOnly(today.Year, dateEvent.EventDate.Month, day);
            return occurrenceDate < today
                ? occurrenceDate.AddYears(1)
                : occurrenceDate;
        }
    }
}
