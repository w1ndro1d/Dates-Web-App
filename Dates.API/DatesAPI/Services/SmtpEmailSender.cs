using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Text;

namespace DatesAPI.Services
{
    public class SmtpEmailSender : IEmailSender
    {
        private readonly IConfiguration _configuration;

        public SmtpEmailSender(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task SendAsync(string recipient, string subject, string textBody, string htmlBody, CancellationToken cancellationToken)
        {
            var host = _configuration["Email:Smtp:Host"];
            var username = _configuration["Email:Smtp:Username"];
            var password = _configuration["Email:Smtp:Password"];
            var from = _configuration["Email:Smtp:From"] ?? username;
            var displayName = _configuration["Email:Smtp:DisplayName"] ?? "Dates Reminders";

            if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(username) ||
                string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(from))
            {
                throw new InvalidOperationException("Email SMTP settings are incomplete.");
            }

            var port = _configuration.GetValue("Email:Smtp:Port", 587);
            var enableSsl = _configuration.GetValue("Email:Smtp:EnableSsl", true);

            using var client = new SmtpClient(host, port)
            {
                EnableSsl = enableSsl,
                Credentials = new NetworkCredential(username, password)
            };
            using var message = new MailMessage
            {
                From = new MailAddress(from, displayName),
                Subject = subject,
                SubjectEncoding = Encoding.UTF8,
                Body = textBody,
                BodyEncoding = Encoding.UTF8,
                IsBodyHtml = false
            };
            message.To.Add(recipient);
            message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(htmlBody, Encoding.UTF8, MediaTypeNames.Text.Html));
            await client.SendMailAsync(message, cancellationToken);
        }
    }
}
