using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DatesAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailReminders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "OneDayReminderSentFor",
                table: "DateDetails",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OneMonthReminderSentFor",
                table: "DateDetails",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "OneWeekReminderSentFor",
                table: "DateDetails",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ReminderOneDay",
                table: "DateDetails",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ReminderOneMonth",
                table: "DateDetails",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ReminderOneWeek",
                table: "DateDetails",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ReminderSameDay",
                table: "DateDetails",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "SameDayReminderSentFor",
                table: "DateDetails",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OneDayReminderSentFor",
                table: "DateDetails");

            migrationBuilder.DropColumn(
                name: "OneMonthReminderSentFor",
                table: "DateDetails");

            migrationBuilder.DropColumn(
                name: "OneWeekReminderSentFor",
                table: "DateDetails");

            migrationBuilder.DropColumn(
                name: "ReminderOneDay",
                table: "DateDetails");

            migrationBuilder.DropColumn(
                name: "ReminderOneMonth",
                table: "DateDetails");

            migrationBuilder.DropColumn(
                name: "ReminderOneWeek",
                table: "DateDetails");

            migrationBuilder.DropColumn(
                name: "ReminderSameDay",
                table: "DateDetails");

            migrationBuilder.DropColumn(
                name: "SameDayReminderSentFor",
                table: "DateDetails");
        }
    }
}
