using DatesAPI.Models;

namespace DatesAPI.Interfaces
{
    public interface IUserRepository
    {
        Task<UserDetails> GetUserByEmailAsync(string email);
        Task<UserDetails?> GetUserByVerificationTokenHashAsync(string tokenHash);
        Task AddUserAsync(UserDetails user);
        Task UpdateUserAsync(UserDetails user);
    }
}
