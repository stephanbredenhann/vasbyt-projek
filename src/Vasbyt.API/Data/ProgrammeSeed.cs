using Vasbyt.API.Domain;

namespace Vasbyt.API.Data;

public static class ProgrammeSeed
{
    public static ProgrammeDay[] Days() =>
    [
        new()
        {
            DayNumber = 1, DateLocal = new(2027, 4, 29), TitleAf = "Donderdag", TitleEn = "Thursday",
            NoteAf = "Stalletjies en wegneem-etes is by die tent beskikbaar.",
            NoteEn = "Stalls and takeaway meals are available at the tent.",
            Entries =
            [
                Entry(0, 13, 0, "Registrasie van alle Vasbyt-deelnemers", "Registration for all Vasbyt participants"),
                Entry(1, 16, 45, "Registrasie sluit", "Registration closes"),
                Entry(2, 17, 0, "Inligtingsvergadering", "Race briefing",
                    "Program en roetes, bepalings en voorwaardes, tradisies, borge en koeponne.",
                    "Programme and routes, terms, traditions, sponsors and vouchers."),
                Entry(3, 17, 0, "Stalletjies open", "Stalls open"),
                Entry(4, 18, 0, "Vasbyt en Dorpsdraf kom byeen", "Vasbyt and town run participants gather"),
                Entry(5, 18, 15, "Wegspring", "Start"),
            ],
        },
        new()
        {
            DayNumber = 2, DateLocal = new(2027, 4, 30), TitleAf = "Vrydag", TitleEn = "Friday",
            Entries =
            [
                Entry(0, 5, 45, "Stalletjies open, koffie", "Stalls open, coffee"),
                Entry(1, 6, 15, "Opening en reëlings vir die dag", "Opening and arrangements for the day"),
                Entry(2, 6, 30, "Wegspring", "Start"),
                Entry(3, 17, 0, "Bring-en-braai, vure word aangesteek", "Bring-and-braai, fires are lit"),
            ],
        },
        new()
        {
            DayNumber = 3, DateLocal = new(2027, 5, 1), TitleAf = "Saterdag", TitleEn = "Saturday",
            Entries =
            [
                Entry(0, 5, 0, "Stalletjies open, koffie", "Stalls open, coffee"),
                Entry(1, 5, 30, "Vragmotor laai wedloopdeelnemers op", "Truck collects running participants"),
                Entry(2, 6, 15, "Opening en reëlings vir die dag", "Opening and arrangements for the day"),
                Entry(3, 6, 30, "Wegspring", "Start"),
                Entry(4, 11, 0, "Prysuitdeling", "Prize giving"),
            ],
        },
    ];

    private static ProgrammeEntry Entry(int order, int hour, int minute, string af, string en,
        string detailAf = "", string detailEn = "") => new()
    {
        SortOrder = order, TimeLocal = new(hour, minute), TitleAf = af, TitleEn = en,
        DetailAf = detailAf, DetailEn = detailEn,
    };
}
