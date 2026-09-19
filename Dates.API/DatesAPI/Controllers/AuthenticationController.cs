using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DatesAPI.Models;
using DatesAPI.Interfaces;
using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;
using System.Net.Mail;

namespace DatesAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthenticationController : ControllerBase
    {
        private readonly IUserService _userService;
        private readonly IConfiguration _configuration;

        public AuthenticationController(IUserService userService, IConfiguration configuration)
        {
            _userService = userService;
            _configuration = configuration;
        }


        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] UserDetails model)
        {
            try
            {
                var token = await _userService.LoginAsync(model.Email, model.PasswordHash);
                return Ok(new { Token = token });
            }
            catch (Exception ex) when (ex.Message == $"No account found for {model.Email}! Please sign up first.")
            {
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex) when (ex.Message == "Invalid credentials!")
            {
                return Conflict(new { message = ex.Message });
            }
            catch (Exception ex) when (ex.Message == "Verify your email address before signing in.")
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message, code = "email_not_verified" });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] UserDetails model)
        {
            var email = model.Email?.Trim() ?? "";
            if (string.IsNullOrWhiteSpace(email) || !new EmailAddressAttribute().IsValid(email))
            {
                return BadRequest(new { message = "Enter a valid email address." });
            }

            if (string.IsNullOrEmpty(model.PasswordHash) || model.PasswordHash.Length < 8)
            {
                return BadRequest(new { message = "Your password must contain at least 8 characters." });
            }

            model.Email = email;

            try
            {
                await _userService.RegisterAsync(model);
                return Ok(new { message = "Check your inbox to verify your email address." });
            }
            catch (Exception ex) when (ex.Message == "User already exists!")
            {
                return Conflict(new {message = ex.Message});
            }
            catch (Exception ex) when (ex is SmtpException or InvalidOperationException)
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    message = "Your account was created, but the verification email could not be sent. Try signing in and request a new link."
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("verify-email")]
        public async Task<IActionResult> VerifyEmail([FromQuery] string token)
        {
            var verified = await _userService.VerifyEmailAsync(token);
            var webBaseUrl = (_configuration["App:WebBaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
            var result = verified ? "verified" : "invalid";
            return Redirect($"{webBaseUrl}/?emailVerification={result}");
        }

        [HttpPost("resend-verification")]
        public async Task<IActionResult> ResendVerification([FromBody] EmailVerificationRequest request)
        {
            try
            {
                await _userService.ResendVerificationEmailAsync(request.Email);
                return Ok(new { message = "If that account is awaiting verification, a new link has been sent." });
            }
            catch (Exception ex) when (ex is SmtpException or InvalidOperationException)
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "The verification email could not be sent right now." });
            }
        }
    }
}
