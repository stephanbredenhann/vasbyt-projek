using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vasbyt.API.Migrations
{
    /// <inheritdoc />
    public partial class SharedWalkRoutes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SharesRouteWithId",
                table: "RouteCategories",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_RouteCategories_SharesRouteWithId",
                table: "RouteCategories",
                column: "SharesRouteWithId");

            migrationBuilder.AddForeignKey(
                name: "FK_RouteCategories_RouteCategories_SharesRouteWithId",
                table: "RouteCategories",
                column: "SharesRouteWithId",
                principalTable: "RouteCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Walks ride on the run routes: link and open them, and give them their new copy.
            migrationBuilder.Sql("""
                UPDATE "RouteCategories" w
                SET "SharesRouteWithId" = r."Id", "IsOpen" = TRUE,
                    "Blurb" = CASE w."Code"
                        WHEN 'ligstap' THEN 'Die Ligstap is dieselfde roete as die Ligdraf, maar teen ''n stapper se pas. Vir drie dae stap jy tussen die Karookoppies, langs die kanaal en oor die Oranjerivier, met tyd om die uitsig in te drink en nuwe vriende te maak.'
                        ELSE 'Die Vasstap is dieselfde roete as die Vasbyt, maar teen ''n stapper se pas. Dit is vir die vasberade stappers wat drie dae lank die Karoo se koppies en kanaalpad wil vat, met goeie stapskoene, genoeg water en ''n bestendige pas.'
                    END
                FROM "RouteCategories" r
                WHERE (w."Code", r."Code") IN (('ligstap', 'ligdraf'), ('vasstap', 'vasbyt'));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""UPDATE "RouteCategories" SET "IsOpen" = FALSE WHERE "Code" IN ('ligstap', 'vasstap');""");

            migrationBuilder.DropForeignKey(
                name: "FK_RouteCategories_RouteCategories_SharesRouteWithId",
                table: "RouteCategories");

            migrationBuilder.DropIndex(
                name: "IX_RouteCategories_SharesRouteWithId",
                table: "RouteCategories");

            migrationBuilder.DropColumn(
                name: "SharesRouteWithId",
                table: "RouteCategories");
        }
    }
}
