using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DatesAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddEventTimeZones : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<DateTime>(
                name: "EventDate",
                table: "DateDetails",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "datetime");

            migrationBuilder.AddColumn<string>(
                name: "TimeZoneId",
                table: "DateDetails",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "UTC");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TimeZoneId",
                table: "DateDetails");

            migrationBuilder.AlterColumn<DateTime>(
                name: "EventDate",
                table: "DateDetails",
                type: "datetime",
                nullable: false,
                oldClrType: typeof(DateTime),
                oldType: "date");
        }
    }
}
