using DatesAPI.Interfaces;
using DatesAPI.Models;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.WebUtilities;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Cryptography;
using System.Security.Claims;
using System.Text;

namespace DatesAPI.Services
{
    public class UserService: IUserService
    {
        private readonly IConfiguration _configuration;
        private readonly IUserRepository _userRepository;
        private readonly IPasswordHasher _passwordHasher;
        private readonly IEmailSender _emailSender;

        public UserService(IConfiguration configuration, IUserRepository userRepository, IPasswordHasher passwordHasher, IEmailSender emailSender)
        {
            _configuration = configuration;
            _userRepository = userRepository;
            _passwordHasher = passwordHasher;
            _emailSender = emailSender;
        }

        public async Task<string> LoginAsync(string email, string password)
        {
            var user = await _userRepository.GetUserByEmailAsync(email);
            if (user == null)
            {
                throw new Exception($"No account found for {email}! Please sign up first.");
            }

            if (!_passwordHasher.VerifyHashedPassword(password, user.PasswordHash))
            {
                throw new Exception("Invalid credentials!");
            }

            if (!user.IsEmailVerified)
            {
                throw new Exception("Verify your email address before signing in.");
            }

            return GenerateJwtToken(user);
        }

        public async Task RegisterAsync(UserDetails userRegistration)
        {
            var user = await _userRepository.GetUserByEmailAsync(userRegistration.Email);
            if (user != null)
            {
                throw new Exception("User already exists!");
            }

            var (verificationToken, verificationTokenHash) = CreateVerificationToken();
            var newUser = new UserDetails
            {
                Email = userRegistration.Email,
                PasswordHash = _passwordHasher.HashPassword(userRegistration.PasswordHash),
                CreatedAt = DateTime.UtcNow,
                IsEmailVerified = false,
                EmailVerificationTokenHash = verificationTokenHash,
                EmailVerificationTokenExpiresAt = DateTime.UtcNow.AddHours(24),
                EmailVerificationLastSentAt = DateTime.UtcNow
            };

            await _userRepository.AddUserAsync(newUser);
            await SendVerificationEmailAsync(newUser.Email, verificationToken);
        }

        public async Task<bool> VerifyEmailAsync(string token)
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                return false;
            }

            var user = await _userRepository.GetUserByVerificationTokenHashAsync(HashToken(token));
            if (user == null || user.IsEmailVerified || !user.EmailVerificationTokenExpiresAt.HasValue ||
                user.EmailVerificationTokenExpiresAt.Value <= DateTime.UtcNow)
            {
                return false;
            }

            user.IsEmailVerified = true;
            user.EmailVerifiedAt = DateTime.UtcNow;
            user.EmailVerificationTokenHash = null;
            user.EmailVerificationTokenExpiresAt = null;
            user.EmailVerificationLastSentAt = null;
            await _userRepository.UpdateUserAsync(user);
            return true;
        }

        public async Task ResendVerificationEmailAsync(string email)
        {
            var normalizedEmail = email.Trim();
            var user = await _userRepository.GetUserByEmailAsync(normalizedEmail);
            if (user == null || user.IsEmailVerified)
            {
                return;
            }

            if (user.EmailVerificationLastSentAt > DateTime.UtcNow.AddMinutes(-1))
            {
                return;
            }

            var (verificationToken, verificationTokenHash) = CreateVerificationToken();
            user.EmailVerificationTokenHash = verificationTokenHash;
            user.EmailVerificationTokenExpiresAt = DateTime.UtcNow.AddHours(24);
            user.EmailVerificationLastSentAt = DateTime.UtcNow;
            await _userRepository.UpdateUserAsync(user);
            await SendVerificationEmailAsync(user.Email, verificationToken);
        }

        private async Task SendVerificationEmailAsync(string email, string token)
        {
            var apiBaseUrl = (_configuration["App:ApiBaseUrl"] ?? "https://localhost:7275").TrimEnd('/');
            var verificationUrl = $"{apiBaseUrl}/api/Authentication/verify-email?token={Uri.EscapeDataString(token)}";
            var encodedUrl = WebUtility.HtmlEncode(verificationUrl);
            var subject = "Verify your Dates email address";
            var textBody = $"Welcome to Dates.\n\nVerify your email address by opening this link:\n{verificationUrl}\n\nThis link expires in 24 hours. If you did not create this account, you can ignore this email.";
            var htmlBody = $"""
                <!doctype html>
                <html>
                <body style="margin:0;padding:0;background:#0d0c12;font-family:Arial,sans-serif;color:#f5ede3">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d0c12;padding:32px 16px">
                    <tr><td align="center">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#181419;border:1px solid #704827;border-radius:18px;overflow:hidden">
                        <tr><td style="height:5px;background:#f5a13a"></td></tr>
                        <tr><td style="padding:32px 34px 10px;color:#ffd184;font-size:12px;font-weight:bold;letter-spacing:.16em;text-transform:uppercase">Welcome to Dates</td></tr>
                        <tr><td style="padding:0 34px;color:#fff4df;font-size:28px;font-weight:bold;line-height:1.2">Verify your email</td></tr>
                        <tr><td style="padding:12px 34px 24px;color:#cfc5bb;font-size:15px;line-height:1.6">Confirm this email address to finish creating your account and start receiving event reminders.</td></tr>
                        <tr><td style="padding:0 34px 30px"><a href="{encodedUrl}" style="display:inline-block;padding:13px 22px;color:#24150c;background:#f5a13a;border-radius:10px;font-size:14px;font-weight:bold;text-decoration:none">Verify email address</a></td></tr>
                        <tr><td style="padding:20px 34px;border-top:1px solid #30231e;color:#8f8884;font-size:12px;line-height:1.6">This link expires in 24 hours. If you did not create this account, you can ignore this email.</td></tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """;

            await _emailSender.SendAsync(email, subject, textBody, htmlBody, CancellationToken.None);
        }

        private static (string Token, string TokenHash) CreateVerificationToken()
        {
            var token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
            return (token, HashToken(token));
        }

        private static string HashToken(string token)
        {
            return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
        }

        private string GenerateJwtToken(UserDetails user)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(_configuration["Jwt:Secret"]);
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new Claim[]
                {
                    new Claim(ClaimTypes.Name, user.Email.ToString())
                }),
                Issuer = _configuration["Jwt:Issuer"],
                Audience = _configuration["Jwt:Audience"],
                Expires = DateTime.UtcNow.AddHours(1),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };
            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }
    }
}
