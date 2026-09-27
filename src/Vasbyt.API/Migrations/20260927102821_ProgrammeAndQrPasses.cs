using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Vasbyt.API.Migrations
{
    /// <inheritdoc />
    public partial class ProgrammeAndQrPasses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CheckedInUtc",
                table: "Entrants",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "QrToken",
                table: "Entrants",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()");

            migrationBuilder.Sql("ALTER TABLE \"Entrants\" ALTER COLUMN \"QrToken\" DROP DEFAULT;");

            migrationBuilder.CreateTable(
                name: "ProgrammeDays",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DayNumber = table.Column<int>(type: "integer", nullable: false),
                    DateLocal = table.Column<DateOnly>(type: "date", nullable: false),
                    TitleAf = table.Column<string>(type: "text", nullable: false),
                    TitleEn = table.Column<string>(type: "text", nullable: false),
                    NoteAf = table.Column<string>(type: "text", nullable: false),
                    NoteEn = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgrammeDays", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProgrammeEntry",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProgrammeDayId = table.Column<int>(type: "integer", nullable: false),
                    TimeLocal = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    TitleAf = table.Column<string>(type: "text", nullable: false),
                    TitleEn = table.Column<string>(type: "text", nullable: false),
                    DetailAf = table.Column<string>(type: "text", nullable: false),
                    DetailEn = table.Column<string>(type: "text", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgrammeEntry", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgrammeEntry_ProgrammeDays_ProgrammeDayId",
                        column: x => x.ProgrammeDayId,
                        principalTable: "ProgrammeDays",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Entrants_QrToken",
                table: "Entrants",
                column: "QrToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProgrammeDays_DayNumber",
                table: "ProgrammeDays",
                column: "DayNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProgrammeEntry_ProgrammeDayId",
                table: "ProgrammeEntry",
                column: "ProgrammeDayId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProgrammeEntry");

            migrationBuilder.DropTable(
                name: "ProgrammeDays");

            migrationBuilder.DropIndex(
                name: "IX_Entrants_QrToken",
                table: "Entrants");

            migrationBuilder.DropColumn(
                name: "CheckedInUtc",
                table: "Entrants");

            migrationBuilder.DropColumn(
                name: "QrToken",
                table: "Entrants");
        }
    }
}
