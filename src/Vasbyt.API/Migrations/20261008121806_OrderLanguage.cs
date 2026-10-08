using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vasbyt.API.Migrations
{
    /// <inheritdoc />
    public partial class OrderLanguage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Language",
                table: "Orders",
                type: "text",
                nullable: false,
                defaultValue: "af");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Language",
                table: "Orders");
        }
    }
}
