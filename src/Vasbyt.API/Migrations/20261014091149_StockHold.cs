using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vasbyt.API.Migrations
{
    /// <inheritdoc />
    public partial class StockHold : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "StockHeldUntilUtc",
                table: "Orders",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StockHeldUntilUtc",
                table: "Orders");
        }
    }
}
