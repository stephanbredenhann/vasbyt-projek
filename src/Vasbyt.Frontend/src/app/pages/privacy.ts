import { Component } from '@angular/core';

@Component({
  selector: 'vb-privacy',
  standalone: true,
  template: `
    <article class="container section policy" lang="af" aria-labelledby="privacy-title">
      <p class="eyebrow">Orania Helpmekaar Vasbyt</p>
      <h1 id="privacy-title">Privaatheidsbeleid</h1>
      <p class="muted">Laas bygewerk: <time datetime="2026-10-14">14 Oktober 2026</time></p>
      <p class="lead">
        Hierdie beleid verduidelik watter persoonlike inligting ons vir Vasbyt versamel,
        waarvoor ons dit gebruik, met wie ons dit deel en hoe jy jou regte kan uitoefen.
        Dit geld vir besoekers, kopers, deelnemers, ouers of voogde, noodkontakte en rekeninghouers.
      </p>

      <section aria-labelledby="responsible">
        <h2 id="responsible">1. Wie is verantwoordelik?</h2>
        <p>
          Orania Helpmekaar NPO, registrasienommer 2019/404839/08, is die verantwoordelike
          party vir persoonlike inligting wat deur hierdie webwerf vir Vasbyt verwerk word.
          Ons hanteer dit ingevolge die Wet op Beskerming van Persoonlike Inligting, 4 van 2013 (POPIA).
        </p>
        <address>
          Die Duiker, Olienhoutrylaan S068, Orania, Noord-Kaap, 8752, Suid-Afrika<br />
          E-pos: <a href="mailto:admin@oraniahelpmekaar.co.za">admin&#64;oraniahelpmekaar.co.za</a><br />
          Telefoon: <a href="tel:+27795062090">079 506 2090</a><br />
          Webwerf: <a href="https://oraniavasbyt.co.za/">oraniavasbyt.co.za</a>
        </address>
        <p>Rig privaatheidsnavrae en versoeke aan die Inligtingsbeampte via hierdie kontakbesonderhede.</p>
      </section>

      <section aria-labelledby="information">
        <h2 id="information">2. Watter inligting versamel ons?</h2>
        <ul>
          <li><strong>Rekeninge:</strong> naam, van, e-posadres, ’n wagwoord in gehashte vorm,
            rekeningrol en aanmeld- en sekuriteitsrekords. Ons bewaar nie jou leesbare wagwoord nie.</li>
          <li><strong>Bestellings:</strong> die koper se naam, van, e-posadres en opsionele telefoonnommer;
            kaartjies, roetes, tariewe, produkte, groottes of variante, skenkings en bedrae;
            bestel- en betalingsverwysings, status, datums, afhaalrekords, taalvoorkeur en e-posafleweringsrekords.</li>
          <li><strong>Deelnemers:</strong> naam, van, Suid-Afrikaanse identiteitsnommer, geboortedatum,
            geslag, e-posadres, selfoonnommer, straatadres, dorp, provinsie, poskode, hempgrootte,
            opsionele klubnaam, roete, tarief, inskrywingsnommer en QR-pas.</li>
          <li><strong>Mediese besonderhede, indien verskaf:</strong> mediese toestande, allergieë,
            medikasie, mediese fonds en lidnommer. Gesondheidsinligting is besondere persoonlike inligting.</li>
          <li><strong>Noodkontakte en toestemming:</strong> die noodkontak se naam, verhouding en
            telefoonnommer; die ouer of voog se naam waar nodig; aanvaarding van voorwaardes,
            die tyd daarvan en die fototoestemmingsrekord.</li>
          <li><strong>Onvoltooide vorms en aanmelding:</strong> antwoorde wat outomaties gestoor
            word, ook voordat jy die vorm indien; die deelnemer se aanmeldtyd en die
            administrateur wat hulle aangemeld het.</li>
          <li><strong>Tegniese inligting:</strong> ons bediener en eksterne dienste ontvang verbindingsdata
            soos jou IP-adres, versoekte bladsy en blaaierbesonderhede. Fout- en sekuriteitslogboeke
            kan tegniese besonderhede en verwysings bevat om probleme te ondersoek.</li>
        </ul>
        <p>
          Ons ontvang besonderhede direk van jou, van ’n koper of gemagtigde persoon wat namens ’n
          deelnemer invul, van administrateurs en van Kwik wanneer ’n betaling bevestig word.
          Maak seker dat jy gemagtig is om iemand anders se besonderhede te verskaf, wys hierdie
          beleid aan hulle en lig jou noodkontak in oor die gebruik van hul besonderhede.
        </p>
      </section>

      <section aria-labelledby="purposes">
        <h2 id="purposes">3. Waarom gebruik ons dit?</h2>
        <p>
          Ons gebruik die besonderhede om aankope en inskrywings te verwerk, betalings te bevestig,
          deelnemers te identifiseer en aan te meld, produkte vir afhaal gereed te maak, die geleentheid
          te organiseer en jou met ’n bestelling of rekening te help. Die identiteitsnommer help met
          identifikasie; die vorm lei ook geboortedatum en geslag uit ’n geldige Suid-Afrikaanse ID af.
          Mediese en noodkontakbesonderhede help gemagtigde personeel om in ’n noodsituasie op te tree.
        </p>
        <p>
          Ons steun, waar toepaslik, op die uitvoering van jou aankoop- of deelnameooreenkoms,
          wetlike verpligtinge en regmatige belange soos veilige dienslewering en die voorkoming van
          misbruik. Waar toestemming nodig is, moet dit vrywillig, spesifiek en ingelig wees.
          Besondere persoonlike inligting en kinders se inligting vereis ook die toepaslike
          magtiging ingevolge POPIA; gewone kontrakverwerking alleen is nie voldoende daarvoor nie.
        </p>
        <p>
          Die diens stuur bestelbevestigings, QR-passe, herinneringe oor onvoltooide vorms,
          aanmeldkodes, rekeningskakels en wagwoordherstelskakels. Hierdie diensboodskappe is nodig
          om jou bestelling of rekening te bestuur. Die webwerf het geen nuusbriefintekening nie.
          Elektroniese direkte bemarking moet aan POPIA se vereistes voldoen en ’n uittekenopsie bied.
        </p>
      </section>

      <section aria-labelledby="choices">
        <h2 id="choices">4. Jou keuses, mediese inligting en minderjariges</h2>
        <p>
          Jy kan die openbare bladsye sonder ’n rekening besoek en as ’n gas koop. Verpligte
          koop- en deelnemersvelde is nodig vir die betrokke diens; sonder hulle kan ons nie die
          bestelling of inskrywing voltooi nie. Dit beteken nie dat POPIA self elke vormveld vereis nie.
          Die koper se telefoonnommer, klubnaam en mediese velde is opsioneel.
        </p>
        <p>
          Verskaf slegs mediese inligting wat vir veilige deelname en noodhulp nodig is, met die
          deelnemer se ingeligte toestemming of ’n ander toepaslike POPIA-magtiging. Jy kan dit
          weglaat, maar die mediese span sal dan nie vooraf daarvan weet nie. Kontak ons om
          besonderhede reg te stel of toestemming terug te trek.
        </p>
        <p>
          ’n Ouer, voog of ander bevoegde persoon moet vooraf toestemming gee vir die verwerking
          van ’n minderjarige se persoonlike inligting. Moenie ’n kind se vorm of mediese besonderhede
          begin invul voordat daardie toestemming verkry is nie, aangesien antwoorde outomaties
          gestoor word. Die vorm vra die ouer of voog se naam voordat die inskrywing voltooi word.
        </p>
        <p>
          Die huidige deelnamevoorwaardes sluit die gebruik van deelnemersfoto’s vir Vasbyt se
          bemarking in; die fototoestemmingsrekord word saam met die aanvaarding daarvan gestoor.
          Kontak ons indien jy beswaar teen dié gebruik het of toestemming wil terugtrek, ook vir
          ’n kind. Lees dié voorwaarde voordat jy die inskrywing voltooi.
        </p>
      </section>

      <section aria-labelledby="sharing">
        <h2 id="sharing">5. Met wie deel ons inligting?</h2>
        <ul>
          <li><strong>Gemagtigde organiseerders en administrateurs:</strong> bestuur bestellings,
            inskrywings, afhaal en aanmelding. Administrateurs kan ID-, adres-, noodkontak- en mediese
            data sien en deelnemerslyste uitvoer. Waar nodig vir veiligheid, kan relevante besonderhede
            aan die mediese span of nooddienspersoneel verskaf word.</li>
          <li><strong>Die koper en gekoppelde rekeninghouer:</strong> kan die bestelling en
            deelnemeropsomming bestuur en ontvang kopieë van QR-passe. Die gewone bestelopsomming
            bevat nie voltooide ID-, adres- of mediese velde nie. Iemand met die privaat bestelskakel
            kan egter onvoltooide vorms, insluitend hul gestoorde antwoorde, heropen. Hou dié skakel privaat.</li>
          <li><strong>Kwik:</strong> ontvang die koper se naam, van en e-posadres, bestelbeskrywing,
            bedrag, bestelverwysing, besteltoken en terugkeer- en kennisgewingskakels om betaling te
            verwerk. Betalingsbesonderhede word op Kwik se betaalblad ingevul. Ons ontvang die
            betalingsuitslag en transaksieverwysing; ons stoor nie jou kaartnommer, CVV of bankaanmeldbesonderhede nie.
            Sien <a href="https://help.kwik.co.za/legal/privacy-notice">Kwik se privaatheidskennisgewing</a>.</li>
          <li><strong>Resend:</strong> lewer ons diens-e-posse af en ontvang die ontvanger se e-posadres,
            boodskapinhoud en aanhangsels, soos name, bestelbesonderhede, privaat rekeningskakels
            en QR-passe. Die e-posse bevat nie die deelnemer se ID- of mediese velde nie.
            Sien <a href="https://resend.com/legal/privacy-policy">Resend se privaatheidsbeleid</a>.</li>
          <li><strong>Bediener- en tegniese diensverskaffers:</strong> die webwerf se bediener,
            databasis en berging verwerk data vir dienslewering. Gemagtigde tegniese personeel kan
            toegang nodig hê vir instandhouding en probleemoplossing.</li>
          <li><strong>Ander ontvangers:</strong> ons kan inligting verskaf waar ’n geldige regsproses
            dit vereis of waar dit regmatig nodig is om iemand se lewe, gesondheid of regte te beskerm.</li>
        </ul>
        <p>
          Die openbare deelnemerskaart wys slegs getalle per provinsie, nie name, ID-nommers,
          adresse of mediese besonderhede nie. Borg- en verblyfadvertensies kan hul eie openbare
          kontakbesonderhede en skakels wys; hulle ontvang nie deelnemerslyste deur die webwerf nie.
          Eksterne bespreking-, borg- en kalenderwebwerwe hanteer jou besoek volgens hul eie beleid.
          Ons verkoop nie persoonlike inligting nie.
        </p>
      </section>

      <section aria-labelledby="transfers">
        <h2 id="transfers">6. Verwerking buite Suid-Afrika</h2>
        <p>
          Ons bedieners is in Switserland geleë, waar persoonlike inligting vir die webwerf
          verwerk en gestoor word. Resend beskryf verwerking in die Verenigde State van Amerika.
          Eksterne diensverskaffers en hul subverwerkers kan ook in ander lande inligting verwerk;
          ons bedieners se ligging beteken dus nie dat alle verwerking in Switserland plaasvind nie.
        </p>
        <p>
          POPIA se artikel 72 vereis ’n toepaslike grondslag vir ’n buitelandse oordrag, soos voldoende
          beskerming deur wetgewing of ’n bindende ooreenkoms, geldige toestemming of ’n toepaslike
          kontraktuele noodsaaklikheid. Waar ’n diensverskaffer namens ons optree, vereis POPIA ook
          toepaslike vertroulikheid en sekuriteitsreëlings. Jy kan ons vra oor die betrokke
          bergingsligging, ontvangers en beskermingsmaatreëls.
        </p>
      </section>

      <section aria-labelledby="cookies">
        <h2 id="cookies">7. Koekies en blaaierberging</h2>
        <p>
          Die Vasbyt-toepassing gebruik geen advertensiekoekies, besoekontledingsdiens of
          ingeboude bemarkingsopsporingspixel nie. Dit gebruik wel funksionele berging:
        </p>
        <ul>
          <li><strong>Aanmeldkoekie:</strong> herken jou rekening en hou jou aangemeld. Die geldigheid
            is 30 dae en kan met voortgesette gebruik hernu word. Uittek en die verwydering van
            die koekie beëindig daardie blaaier se aanmeldsessie.</li>
          <li><strong>Voorskoukoekie:</strong> indien die webwerf nog nie bekendgestel is nie,
            onthou <code>vb_voorskou</code> ’n gemagtigde voorskou vir tot 30 dae.</li>
          <li><strong>Plaaslike berging:</strong> <code>vasbyt.locale</code> onthou jou taal;
            <code>vasbyt.cart</code> onthou jou mandjie en koperbesonderhede;
            <code>vasbyt.orderToken</code>, <code>vasbyt.pendingOrder</code> en
            <code>vasbyt.checkoutKey</code> help om jou bestelling te hervat en dubbele indiening
            te vermy. Hierdie berging het geen vaste outomatiese vervaldatum nie.</li>
        </ul>
        <p>
          Jy kan koekies en plaaslike berging in jou blaaier uitvee of blokkeer; aanmelding en die
          onthou van ’n mandjie kan dan nie werk nie. Uittek verwyder plaaslik gestoorde
          koperbesonderhede en bestelskakels, maar nie die bestelling op ons bediener nie.
          Gebruik dit veral op ’n gedeelde toestel.
        </p>
        <p>
          Kwik se betaalblad en ander eksterne dienste kan hul eie koekies of
          soortgelyke tegnologie gebruik. Hulle beleid geld vir daardie verwerking. Indien
          nie-noodsaaklike opsporing by Vasbyt gevoeg word, moet die kennisgewing en enige nodige
          toestemmingskeuses aangepas word voordat dit gebruik word.
        </p>
      </section>

      <section aria-labelledby="retention">
        <h2 id="retention">8. Hoe lank word inligting bewaar?</h2>
        <p>
          POPIA vereis dat rekords nie langer bewaar word as wat hul doel of ’n ander geldige
          regsgrond toelaat nie. Die toepaslike tyd hang af van die afhandeling van die geleentheid,
          bestelling, betaling, klagte of eis, toepaslike rekeningkundige en wetlike verpligtinge
          en die behoefte om rekords vir bewys beskikbaar te hou. Dit is nie ’n grondslag om alle
          mediese of ID-data onbepaald saam met finansiële rekords te bewaar nie.
        </p>
      </section>

      <section aria-labelledby="security">
        <h2 id="security">9. Beveiliging en privaat skakels</h2>
        <p>
          Die produksiewebwerf gebruik HTTPS. Wagwoorde word gehash en gestoorde antwoorde in
          onvoltooide vorms word versleutel. Administrateurfunksies vereis ’n gemagtigde rekening. Voltooide sensitiewe
          deelnemersvelde verskyn nie in die gewone bestelopsomming of op die openbare kaart nie.
          Hierdie maatreëls beteken nie dat elke databasisveld afsonderlik versleutel is of dat
          enige stelsel risikovry is nie.
        </p>
        <p>
          Hou jou bestelskakel, herstel- en rekeningskakels en QR-pas privaat. ’n Bestelskakel kan
          toegang gee sonder dat die persoon aanteken. Kontak ons dadelik indien ’n skakel of
          rekening moontlik misbruik is. By ’n sekuriteitskompromie moet ons die Inligtingsreguleerder
          en geraakte persone in kennis stel soos POPIA vereis.
        </p>
      </section>

      <section aria-labelledby="rights">
        <h2 id="rights">10. Jou regte en hoe om ’n versoek te rig</h2>
        <p>
          Jy kan vra of ons jou persoonlike inligting hou, toegang daartoe en besonderhede van die
          ontvangers versoek, en vra dat verkeerde, onvolledige of onregmatig bewaarde inligting
          reggestel, uitgevee of beperk word. Jy kan, waar POPIA dit toelaat, teen verwerking
          beswaar maak en toestemming vir toekomstige verwerking terugtrek. Terugtrekking maak
          nie vorige regmatige verwerking ongedaan nie, en sommige rekords mag steeds op ’n
          ander geldige regsgrond bewaar moet word.
        </p>
        <p>
          Skryf aan <a href="mailto:admin@oraniahelpmekaar.co.za">admin&#64;oraniahelpmekaar.co.za</a>
          met die onderwerp “POPIA-versoek”, jou kontakbesonderhede, ’n bestel- of inskrywingsverwysing
          indien beskikbaar, en wat jy versoek. Ons kan redelike bewys van identiteit of jou
          bevoegdheid om namens iemand op te tree vra voordat ons inligting openbaar.
          Moenie mediese besonderhede of ’n volledige ID-afskrif ongevraagd per e-pos stuur nie.
        </p>
        <p>
          Indien toegang ingevolge PAIA aangevra moet word of ’n voorgeskrewe vorm of toegelate
          fooi geld, moet ons dit aan jou verduidelik. Versoeke en enige weiering moet volgens
          die toepaslike POPIA- en PAIA-vereistes hanteer word.
        </p>
      </section>

      <section aria-labelledby="complaints">
        <h2 id="complaints">11. Klagtes en veranderinge aan hierdie beleid</h2>
        <p>
          Jy kan ’n klagte direk by die Inligtingsreguleerder indien; jy hoef nie eers ons
          interne proses te voltooi nie. Gebruik die Reguleerder se voorgeskrewe POPIA-klagtevorm
          of klagteportaal. Die huidige kontakbesonderhede is:
        </p>
        <address>
          Inligtingsreguleerder van Suid-Afrika<br />
          Woodmead North Office Park, 54 Maxwell Drive, Woodmead, Johannesburg, 2191<br />
          Telefoon: <a href="tel:+27100235200">010 023 5200</a><br />
          POPIA-klagtes: <a href="mailto:POPIAComplaints@inforegulator.org.za">POPIAComplaints&#64;inforegulator.org.za</a><br />
          <a href="https://inforegulator.org.za/complaints/">Klagteproses en vorms</a> ·
          <a href="https://inforegulator.org.za/contact-us/">Kontakbesonderhede</a>
        </address>
        <p>
          Ons werk hierdie beleid by wanneer die diens of verwerking verander. Die datum boaan
          toon die jongste weergawe. ’n Beleidsverandering of voortgesette gebruik van die webwerf
          vervang nie toestemming waar POPIA nuwe toestemming vereis nie.
        </p>
        <p><a href="https://www.justice.gov.za/legislation/acts/2013-004.pdf">Lees die POPIA-wet</a>.</p>
      </section>
    </article>
  `,
  styles: `
    .policy { max-width: 76ch; overflow-wrap: anywhere; }
    section { margin-top: var(--space-12); }
    h2 { font-size: clamp(1.25rem, 3vw, 1.75rem); }
    li + li { margin-top: var(--space-3); }
    address { font-style: normal; line-height: 1.8; }
    code { font-size: 0.9em; }
  `,
})
export class Privacy {}
