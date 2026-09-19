namespace DatesAPI.Services
{
    public interface IEmailSender
    {
        Task SendAsync(string recipient, string subject, string textBody, string htmlBody, CancellationToken cancellationToken);
    }
}
