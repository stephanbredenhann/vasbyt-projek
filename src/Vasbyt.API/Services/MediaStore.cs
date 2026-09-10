namespace Vasbyt.API.Services;

/// The only place an uploaded file is written, named or deleted. Program.cs serves the same
/// directory read only at /media, so nothing under it is ever executed or reachable for write.
///
/// ponytail: static over an injected service, same reasoning as Pricing. It has no state beyond a
/// path the caller already has. Swap the two file calls for a blob client if uploads ever outgrow
/// one machine's disk.
public static class MediaStore
{
    public const string UrlPrefix = "/media";
    public const long MaxBytes = 5 * 1024 * 1024;

    /// Declared content type to the extension we store it under. The client's own filename is never
    /// used for anything, so this is the only source of an extension.
    private static readonly Dictionary<string, string> Allowed = new()
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
    };

    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF];
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private static readonly byte[] Riff = "RIFF"u8.ToArray();
    private static readonly byte[] Webp = "WEBP"u8.ToArray();

    /// Outside the content root by default so a redeploy that replaces the app directory, or a
    /// container that is rebuilt from the image, never takes the uploads with it.
    public static string Root(IConfiguration cfg, IHostEnvironment env) =>
        Path.GetFullPath(cfg["Content:Root"] is { Length: > 0 } configured
            ? configured
            : Path.Combine(env.ContentRootPath, "content-media"));

    public static string? Url(string? fileName) =>
        string.IsNullOrEmpty(fileName) ? null : $"{UrlPrefix}/{fileName}";

    /// The bytes decide what this is, not the Content-Type header a client is free to invent.
    internal static string? Sniff(ReadOnlySpan<byte> head)
    {
        if (head.Length < 12) return null;
        if (head[..3].SequenceEqual(Jpeg)) return "image/jpeg";
        if (head[..8].SequenceEqual(Png)) return "image/png";
        if (head[..4].SequenceEqual(Riff) && head.Slice(8, 4).SequenceEqual(Webp)) return "image/webp";
        return null;
    }

    /// Returns the stored name, or an Afrikaans problem string. Every check that matters happens
    /// here: nothing else in the codebase writes to the media root.
    public static async Task<(string? FileName, string? Problem)> SaveAsync(IFormFile file, string root)
    {
        if (file.Length == 0) return (null, "Die lêer is leeg.");
        // Read off the multipart headers, so an oversized upload is refused before its body is
        // copied anywhere. Kestrel's request size limit on the endpoint is the backstop.
        if (file.Length > MaxBytes) return (null, "Die prent mag hoogstens 5 MB wees.");

        var declared = file.ContentType?.Split(';')[0].Trim().ToLowerInvariant() ?? "";
        if (!Allowed.TryGetValue(declared, out var extension))
            return (null, "Slegs JPEG-, PNG- en WEBP-prente word aanvaar.");

        await using var source = file.OpenReadStream();
        var head = new byte[12];
        var read = await source.ReadAtLeastAsync(head, head.Length, throwOnEndOfStream: false);
        if (Sniff(head.AsSpan(0, read)) != declared)
            return (null, "Die lêer se inhoud stem nie met die prentformaat ooreen nie.");

        Directory.CreateDirectory(root);
        // Server generated name, server chosen extension. A client filename never reaches the disk.
        var fileName = $"{Guid.NewGuid():N}{extension}";
        await using var destination = File.Create(Path.Combine(root, fileName));
        await destination.WriteAsync(head.AsMemory(0, read));
        await source.CopyToAsync(destination);
        return (fileName, null);
    }

    /// Same guard the GPX endpoint uses: the name is client input, so resolve it and refuse
    /// anything that lands outside the media root.
    public static bool Delete(string root, string fileName)
    {
        var path = Path.GetFullPath(Path.Combine(root, fileName));
        if (!path.StartsWith(root + Path.DirectorySeparatorChar) || !File.Exists(path)) return false;
        File.Delete(path);
        return true;
    }
}
