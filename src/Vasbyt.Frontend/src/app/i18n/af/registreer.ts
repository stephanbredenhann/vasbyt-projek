// Serves the entry flow: choose, products, donation, review, pay, participant forms, confirmation.
export const registreer = {
  'reg.step': 'Stap',
  'reg.of': 'van',
  'reg.step1': 'Kies',
  'reg.step2': 'Produkte',
  'reg.step3': 'Skenking',
  'reg.step4': 'Kontroleer',
  'reg.step5': 'Betaal',
  'reg.step6': 'Vorms',
  'reg.step7': 'Klaar',

  'reg.entrant': 'Deelnemer',
  'reg.continue': 'Gaan voort',
  'reg.back': 'Terug',
  'reg.skip': 'Slaan oor',
  'reg.total': 'Totaal',
  'reg.perEntrant': 'per deelnemer',

  // Step 1, the keuseskerm. Ses roetekategorieë maal twee tariefgroepe, op een blad.
  'reg.chooseTitle': 'Kies jou inskrywings',
  'reg.chooseIntro':
    'Kies die aantal inskrywings vir elke roete en tariefgroep. Jy kan meer as een roete in dieselfde bestelling koop.',
  'reg.student': 'Student en skolier',
  'reg.normal': 'Normaal',
  'reg.qty': 'Aantal',
  'reg.notOpen': 'Nog nie oop nie',
  'reg.notOpenHint': 'Die afstande vir hierdie roete is nog nie bevestig nie.',
  'reg.entriesClosed': 'Inskrywings is tans gesluit.',
  'reg.entriesClosedBody':
    'Daar is nou geen oop tarief nie, so daar is niks om te kies nie. Kyk solank na die roetes, ons maak weer oop sodra die volgende venster begin.',
  'reg.seeRoutes': 'Sien die roetes',
  'reg.estimate': 'Geskatte totaal',
  'reg.estimateHint':
    'Dit is ’n skatting. Die bediener herbereken elke bedrag voordat jy betaal.',
  'reg.pickOne': 'Kies asseblief ten minste een inskrywing.',
  'reg.max20': 'Hoogstens 20 inskrywings per bestelling.',
  'reg.tickets': 'Inskrywings',

  // Tariff labels only. The amounts live in the API so one place sets the price.
  'reg.tariffs': 'Tariewe',
  'reg.tariffStudent': 'Student en skolier',
  'reg.tariffLateStudent': 'Laat student- en skolierinskrywing',
  'reg.tariffEarly': 'Vroeë normale inskrywing',
  'reg.tariffNormal': 'Gewone normale inskrywing',
  'reg.tariffLate': 'Laat inskrywing',
  'reg.tariffNote':
    'Die tarief word outomaties volgens die inskrywingsdatum en die deelnemer se tipe toegepas.',

  // Step 2, die winkelbylae.
  'reg.productsTitle': 'Voeg by jou bestelling',
  'reg.productsIntro':
    'Vasbyt-goedere by jou inskrywing. Hierdie stap is opsioneel, jy kan dit gerus oorslaan.',
  'reg.productsNone': 'Daar is nog geen produkte beskikbaar nie.',
  'reg.products': 'Produkte',
  'reg.pick': 'Kies',
  'reg.more': 'Een meer',
  'reg.fewer': 'Een minder',
  'reg.close': 'Maak toe',
  'reg.pickDone': 'Klaar',
  'reg.cart': 'Jou bestelling',
  'reg.cartEmpty': 'Nog geen produkte gekies nie.',
  'reg.entryFees': 'Inskrywingskoste',
  'reg.grandTotal': 'Groottotaal',

  // Step 3, die skenking.
  'reg.donationTitle': 'Skenk aan Orania Helpmekaar',
  'reg.donationIntro':
    'Elke sent gaan na Orania Helpmekaar se studiefonds. Kies ’n bedrag, tik jou eie in, of slaan die stap oor.',
  'reg.donation': 'Skenking',
  'reg.donationNone': 'Geen skenking hierdie keer nie',
  'reg.donationOwn': 'Eie bedrag',
  'reg.donationMin': 'Die minimum skenking is R10.',

  // Step 4, kontroleer en skep die bestelling.
  'reg.reviewTitle': 'Kontroleer jou bestelling',
  'reg.buyer': 'Koper se besonderhede',
  'reg.buyerIntro':
    'Ons stuur die bevestiging en die verwysingsnommer hierheen. Die deelnemersvorms word ná betaling ingevul.',
  'reg.emptyCart': 'Jou mandjie is leeg.',
  'reg.startOver': 'Begin van voor af',
  'reg.edit': 'Wysig',
  'reg.createOrder': 'Stoor bestelling en gaan voort',
  'reg.creating': 'Besig om te stoor…',
  'reg.orderSaved': 'Jou bestelling is gestoor.',
  'reg.orderSavedBody':
    'Hou hierdie verwysingsnommer by. As die betaling onderbreek word, kan jy dit hiermee hervat sonder om die mandjie weer saam te stel.',
  'reg.toPayment': 'Gaan na betaling',

  'pay.title': 'Betaal jou bestelling',
  'pay.summary': 'Opsomming',
  'pay.event': 'Geleentheid',
  'pay.entrants': 'Deelnemers',
  'pay.amount': 'Bedrag',
  'pay.warning':
    'Ná betaling word een deelnemersvorm vir elke inskrywing geskep. Die roete en tariefgroep van elke kaartjie is dan vasgestel.',
  'pay.button': 'Betaal nou',
  'pay.demoNote': 'Demonstrasie. Geen werklike betaling word verwerk nie.',
  'pay.processing': 'Besig met betaling…',
  'pay.failed':
    'Die betaling het misluk of is gekanselleer. Jou bestelling bly behoue, jy kan dit hervat.',
  'pay.resume': 'Hervat betaling',
  'pay.reference': 'Verwysingsnommer',
  'pay.paid': 'Hierdie bestelling is reeds betaal.',
  'pay.noOrder': 'Ons kon nie ’n bestelling vind om te betaal nie.',

  // Step 6, een vorm per kaartjie.
  'entrant.title': 'Besonderhede van deelnemer',
  'entrant.formsTitle': 'Deelnemersvorms',
  'entrant.formsIntro':
    'Elke kaartjie het sy eie vorm. Die roete en tariefgroep is reeds by die kaartjie gekoop en kan hier nie verander word nie.',
  'entrant.route': 'Roete',
  'entrant.tariff': 'Tarief',
  'entrant.identity': 'Persoonlike besonderhede',
  'entrant.address': 'Adres',
  'entrant.emergency': 'Noodkontak',
  'entrant.medicalTitle': 'Mediese inligting',
  'entrant.consents': 'Toestemmings',
  'entrant.sameAddress': 'Gebruik hierdie adres vir al die deelnemers',
  'entrant.locked':
    'Hierdie deelnemer se besonderhede is reeds ingedien. Kontak ons as iets verander moet word.',
  'entrant.entryNumber': 'Inskrywingsnommer',
  'entrant.firstName': 'Naam',
  'entrant.lastName': 'Van',
  'entrant.idNumber': 'Identiteitsnommer',
  'entrant.email': 'E-pos',
  'entrant.phone': 'Selfoon',
  'entrant.dob': 'Geboortedatum',
  'entrant.gender': 'Geslag',
  'entrant.male': 'Manlik',
  'entrant.female': 'Vroulik',
  'entrant.shirt': 'Hempgrootte',
  'entrant.emergencyName': 'Noodkontak, naam',
  'entrant.emergencyPhone': 'Noodkontak, selfoon',
  'entrant.emergencyRelation': 'Noodkontak, verhouding',
  'entrant.medical': 'Mediese toestande',
  'entrant.medicalHint': 'Allergieë en toestande waarvan die mediese span moet weet. Opsioneel.',
  'entrant.medication': 'Medikasie',
  'entrant.medicalScheme': 'Mediese fonds',
  'entrant.medicalSchemeNumber': 'Mediesefondsnommer',
  'entrant.street': 'Straatadres',
  'entrant.town': 'Dorp',
  'entrant.province': 'Provinsie',
  'entrant.provinceHint': 'Word slegs as ’n getal op die kaart gewys.',
  'entrant.postcode': 'Poskode',
  'entrant.club': 'Klub',
  'entrant.password': 'Wagwoord',
  'entrant.passwordHint': 'Minstens 8 karakters.',
  'entrant.consentTerms': 'Ek aanvaar die bepalings en voorwaardes en die vrywaring.',
  'entrant.consentTermsRequired': 'Die voorwaardes en vrywaring moet aanvaar word.',
  'entrant.consentGuardian':
    'Ek is die ouer of voog van hierdie minderjarige deelnemer en gee toestemming.',
  'entrant.guardianName': 'Naam van die ouer of voog',
  'entrant.minorNote':
    'Hierdie deelnemer is jonger as 18 op die dag van inskrywing, daarom word ’n ouer of voog se toestemming vereis.',
  'entrant.consentPhotos':
    'Foto’s waarop ek verskyn, mag vir die Vasbyt se bemarking gebruik word.',
  'entrant.save': 'Stoor deelnemer',
  'entrant.saveAndAccount': 'Skep rekening en stoor',
  'entrant.saving': 'Besig om te stoor…',

  'done.title': 'Inskrywing bevestig',
  'done.body':
    'Dankie, jou betaling is ontvang. Ons stuur ’n volledige e-posopsomming van die bestelling, deelnemers, produkte, skenking en betaling.',
  'done.allDone': 'Al die deelnemersvorms is voltooi.',
  'done.outstanding': 'Vorms wat nog uitstaan',
  'done.outstandingBody':
    'Jou betaling is klaar, maar hierdie vorms is nog leeg. Vul hulle in sodat elke deelnemer ’n inskrywingsnommer kan kry. Ons stuur ook ’n hervatskakel per e-pos.',
  'done.fillIn': 'Vul in',
  'done.viewAccount': 'Gaan na my rekening',

  // Die selfstandige skenkingsblad. Een skenking is ’n bestelling sonder kaartjies.
  // Die rekeningkaart op die bevestigingsblad. Heeltemal opsioneel, die bestelling is klaar.
  'claim.title': 'Hou hierdie bestelling op ’n rekening',
  'claim.body':
    'Kies ’n wagwoord en ons koppel hierdie bestelling aan ’n rekening, sodat jy dit later kan oopmaak sonder om die skakel te soek. Jou inskrywing is klaar, met of sonder ’n rekening.',
  'claim.existingHint':
    'As daar reeds ’n rekening vir hierdie e-pos is, teken dieselfde wagwoord jou net aan.',
  'claim.button': 'Skep rekening',
  'claim.saving': 'Besig om te koppel…',
  'claim.claimed': 'Hierdie bestelling is aan jou rekening gekoppel.',

  'skenk.details': 'Jou besonderhede',
  'skenk.reference': 'Jou skenking se verwysingsnommer',
};
