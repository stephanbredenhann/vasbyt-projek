using QRCoder;
using Vasbyt.API.Endpoints;

namespace Vasbyt.API.Services;

public static class QrPng
{
    /// The same payload the SPA renders client side, and the scanner expects.
    public static string Payload(Guid qrToken) => $"VASBYT:{OrderEndpoints.EventYear}:{qrToken:D}";

    public static byte[] Generate(string payload)
    {
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.M);
        return new PngByteQRCode(data).GetGraphic(10, [0, 0, 0], [255, 255, 255], true);
    }
}
