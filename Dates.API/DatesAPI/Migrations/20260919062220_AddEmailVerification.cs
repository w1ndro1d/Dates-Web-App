using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DatesAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EmailVerificationLastSentAt",
                table: "UserDetails",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmailVerificationTokenHash",
                table: "UserDetails",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EmailVerificationTokenExpiresAt",
                table: "UserDetails",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EmailVerifiedAt",
                table: "UserDetails",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsEmailVerified",
                table: "UserDetails",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserDetails_EmailVerificationTokenHash",
                table: "UserDetails",
                column: "EmailVerificationTokenHash",
                unique: true,
                filter: "[EmailVerificationTokenHash] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserDetails_EmailVerificationTokenHash",
                table: "UserDetails");

            migrationBuilder.DropColumn(name: "EmailVerificationLastSentAt", table: "UserDetails");
            migrationBuilder.DropColumn(name: "EmailVerificationTokenHash", table: "UserDetails");
            migrationBuilder.DropColumn(name: "EmailVerificationTokenExpiresAt", table: "UserDetails");
            migrationBuilder.DropColumn(name: "EmailVerifiedAt", table: "UserDetails");
            migrationBuilder.DropColumn(name: "IsEmailVerified", table: "UserDetails");

        }
    }
}
