using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Vasbyt.API.Migrations
{
    /// <inheritdoc />
    public partial class ShopCheckout : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "TrackStock",
                table: "ProductVariants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "CheckoutFingerprint",
                table: "Orders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CheckoutKey",
                table: "Orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CollectedQuantity",
                table: "OrderLines",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CheckoutKey",
                table: "Orders",
                column: "CheckoutKey",
                unique: true,
                filter: "\"CheckoutKey\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_CheckoutKey",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "TrackStock",
                table: "ProductVariants");

            migrationBuilder.DropColumn(
                name: "CheckoutFingerprint",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "CheckoutKey",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "CollectedQuantity",
                table: "OrderLines");
        }
    }
}
