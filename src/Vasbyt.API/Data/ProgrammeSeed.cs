using Vasbyt.API.Domain;

namespace Vasbyt.API.Data;

public static class ProgrammeSeed
{
    public static ProgrammeDay[] Days() =>
    [
        new()
        {
            DayNumber = 1, DateLocal = new(2027, 4, 29), TitleAf = "Donderdag", TitleEn = "Thursday",
            NoteAf = "Gesellige saamkuier in die Vasbyt-tent na afloop van die wedloop en wedren.",
            NoteEn = "Social get-together in the Vasbyt tent after the run and ride.",
            Entries =
            [
                Entry(0, 15, 0, "Registrasie en stalletjies open", "Registration and stalls open",
                    "Registrasie van alle Vasbyt-deelnemers.", "Registration for all Vasbyt participants."),
                Entry(1, 16, 45, "Registrasie sluit", "Registration closes"),
                Entry(2, 17, 0, "Inligtingsvergadering: verwelkoming en waarom Vasbyt?", "Briefing: welcome and why Vasbyt?"),
                Entry(3, 17, 10, "Byeenkomsprogram en roetes", "Event programme and routes"),
                Entry(4, 17, 20, "Bepalings en voorwaardes", "Terms and conditions"),
                Entry(5, 17, 25, "Tradisies", "Traditions"),
                Entry(6, 17, 30, "Borge en koeponne", "Sponsors and vouchers"),
                Entry(7, 18, 0, "Opening", "Opening"),
                Entry(8, 18, 5, "Vasbyt as projek van Orania Helpmekaar", "Vasbyt as a project of Orania Helpmekaar"),
                Entry(9, 18, 15, "Wegspring", "Start"),
            ],
        },
        new()
        {
            DayNumber = 2, DateLocal = new(2027, 4, 30), TitleAf = "Vrydag", TitleEn = "Friday",
            Entries =
            [
                Entry(0, 5, 30, "Stalletjies open, koffie", "Stalls open, coffee"),
                Entry(1, 5, 45, "Opening", "Opening"),
                Entry(2, 5, 50, "Reëlings vir die dag", "Arrangements for the day"),
                Entry(3, 6, 0, "Wegspring", "Start"),
                Entry(4, 16, 30, "Stalletjies open", "Stalls open"),
                Entry(5, 17, 0, "Vasbyt Fees by die feestent", "Vasbyt Fees at the marquee"),
            ],
        },
        new()
        {
            DayNumber = 3, DateLocal = new(2027, 5, 1), TitleAf = "Saterdag", TitleEn = "Saturday",
            Entries =
            [
                Entry(0, 5, 0, "Stalletjies open, koffie", "Stalls open, coffee"),
                Entry(1, 5, 30, "Vragmotor laai hardlopers op", "Truck collects runners"),
                Entry(2, 5, 45, "Opening", "Opening"),
                Entry(3, 5, 50, "Reëlings vir die dag", "Arrangements for the day"),
                Entry(4, 6, 0, "Wegspring", "Start"),
                Entry(5, 11, 0, "Prysuitdeling", "Prize giving"),
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
