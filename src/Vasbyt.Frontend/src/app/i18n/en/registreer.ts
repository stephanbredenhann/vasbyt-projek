// Serves the entry flow: choose, products, donation, review, pay, participant forms, confirmation.
export const registreer = {
  'reg.step': 'Step',
  'reg.of': 'of',
  'reg.step1': 'Choose',
  'reg.step2': 'Products',
  'reg.step3': 'Donation',
  'reg.step4': 'Review',
  'reg.step5': 'Pay',
  'reg.step6': 'Forms',
  'reg.step7': 'Done',

  'reg.entrant': 'Entrant',
  'reg.continue': 'Continue',
  'reg.back': 'Back',
  'reg.skip': 'Skip',
  'reg.total': 'Total',
  'reg.perEntrant': 'per entrant',

  // Step 1, the one choose screen. Six route categories across two fee groups.
  'reg.chooseTitle': 'Choose your entries',
  'reg.chooseIntro':
    'Pick a quantity for each route and fee group. One order may carry more than one route.',
  'reg.student': 'Student and scholar',
  'reg.normal': 'Standard',
  'reg.qty': 'Quantity',
  'reg.notOpen': 'Not open yet',
  'reg.notOpenHint': 'The distances for this route have not been confirmed yet.',
  'reg.entriesClosed': 'Entries are closed at the moment.',
  'reg.entriesClosedBody':
    'No fee window is open right now, so there is nothing to choose. Have a look at the routes in the meantime, we reopen as soon as the next window starts.',
  'reg.seeRoutes': 'See the routes',
  'reg.estimate': 'Estimated total',
  'reg.estimateHint': 'This is an estimate. The server recalculates every amount before you pay.',
  'reg.pickOne': 'Please choose at least one entry.',
  'reg.max20': 'At most 20 entries per order.',
  'reg.tickets': 'Entries',

  // Fee labels only. The amounts live in the API so one place sets the price.
  'reg.tariffs': 'Fees',
  'reg.tariffStudent': 'Student and scholar',
  'reg.tariffLateStudent': 'Late student and scholar entry',
  'reg.tariffEarly': 'Early standard entry',
  'reg.tariffNormal': 'Standard entry',
  'reg.tariffLate': 'Late entry',
  'reg.tariffNote': 'The fee is applied automatically from the entry date and the entrant type.',

  // Step 2, the shop add-on.
  'reg.productsTitle': 'Add to your order',
  'reg.productsIntro':
    'Vasbyt goods alongside your entry. This step is optional, feel free to skip it.',
  'reg.productsNone': 'There are no products available yet.',
  'reg.products': 'Products',
  'reg.pick': 'Choose',
  'reg.more': 'One more',
  'reg.fewer': 'One fewer',
  'reg.close': 'Close',
  'reg.pickDone': 'Done',
  'reg.cart': 'Your order',
  'reg.cartEmpty': 'No products chosen yet.',
  'reg.entryFees': 'Entry fees',
  'reg.grandTotal': 'Grand total',

  // Step 3, the donation.
  'reg.donationTitle': 'Donate to Orania Helpmekaar',
  'reg.donationIntro':
    'Every cent goes to the Orania Helpmekaar study fund. Choose an amount, enter your own, or skip the step.',
  'reg.donation': 'Donation',
  'reg.donationNone': 'No donation this time',
  'reg.donationOwn': 'Own amount',
  'reg.donationMin': 'The minimum donation is R10.',

  // Step 4, review and create the order.
  'reg.reviewTitle': 'Check your order',
  'reg.buyer': 'Buyer details',
  'reg.buyerIntro':
    'We send the confirmation and the reference number here. The participant forms are filled in after payment.',
  'reg.emptyCart': 'Your cart is empty.',
  'reg.startOver': 'Start over',
  'reg.edit': 'Edit',
  'reg.createOrder': 'Save order and continue',
  'reg.creating': 'Saving…',
  'reg.orderSaved': 'Your order has been saved.',
  'reg.orderSavedBody':
    'Keep this reference number. If the payment is interrupted you can resume it with this, without building the cart again.',
  'reg.toPayment': 'Go to payment',

  'pay.title': 'Pay for your order',
  'pay.summary': 'Summary',
  'pay.event': 'Event',
  'pay.entrants': 'Entrants',
  'pay.amount': 'Amount',
  'pay.warning':
    'After payment one participant form is created for every entry. Each ticket’s route and fee group is fixed from then on.',
  'pay.button': 'Pay now',
  'pay.demoNote': 'Demonstration. No real payment is processed.',
  'pay.processing': 'Processing payment…',
  'pay.failed': 'The payment failed or was cancelled. Your order is kept and you can resume it.',
  'pay.resume': 'Resume payment',
  'pay.reference': 'Reference number',
  'pay.paid': 'This order has already been paid.',
  'pay.noOrder': 'We could not find an order to pay for.',

  // Step 6, one form per ticket.
  'entrant.title': 'Entrant details',
  'entrant.formsTitle': 'Participant forms',
  'entrant.formsIntro':
    'Every ticket has its own form. The route and fee group were bought with the ticket and cannot be changed here.',
  'entrant.route': 'Route',
  'entrant.tariff': 'Fee',
  'entrant.identity': 'Personal details',
  'entrant.address': 'Address',
  'entrant.emergency': 'Emergency contact',
  'entrant.medicalTitle': 'Medical information',
  'entrant.consents': 'Consents',
  'entrant.sameAddress': 'Use this address for every entrant',
  'entrant.locked':
    'This entrant has already been submitted. Contact us if something needs to change.',
  'entrant.entryNumber': 'Entry number',
  'entrant.firstName': 'First name',
  'entrant.lastName': 'Surname',
  'entrant.idNumber': 'Identity number',
  'entrant.email': 'Email',
  'entrant.phone': 'Mobile',
  'entrant.dob': 'Date of birth',
  'entrant.gender': 'Gender',
  'entrant.male': 'Male',
  'entrant.female': 'Female',
  'entrant.shirt': 'Shirt size',
  'entrant.emergencyName': 'Emergency contact, name',
  'entrant.emergencyPhone': 'Emergency contact, mobile',
  'entrant.emergencyRelation': 'Emergency contact, relationship',
  'entrant.medical': 'Medical conditions',
  'entrant.medicalHint': 'Allergies and conditions the medical team should know about. Optional.',
  'entrant.medication': 'Medication',
  'entrant.medicalScheme': 'Medical scheme',
  'entrant.medicalSchemeNumber': 'Medical scheme number',
  'entrant.street': 'Street address',
  'entrant.town': 'Town',
  'entrant.province': 'Province',
  'entrant.provinceHint': 'Shown on the map only as a count.',
  'entrant.postcode': 'Postal code',
  'entrant.club': 'Club',
  'entrant.password': 'Password',
  'entrant.passwordHint': 'At least 8 characters.',
  'entrant.consentTerms': 'I accept the terms and conditions and the indemnity.',
  'entrant.consentTermsRequired': 'The terms and the indemnity have to be accepted.',
  'entrant.consentGuardian': 'I am the parent or guardian of this minor entrant and give consent.',
  'entrant.guardianName': 'Name of the parent or guardian',
  'entrant.minorNote':
    'This entrant is under 18 on the day of entry, so a parent or guardian consent is required.',
  'entrant.consentPhotos': 'Photographs I appear in may be used to promote the Vasbyt.',
  'entrant.save': 'Save entrant',
  'entrant.saveAndAccount': 'Create account and save',
  'entrant.saving': 'Saving…',

  'done.title': 'Entry confirmed',
  'done.body':
    'Thank you, your payment came through. A full email summary of the order, entrants, products, donation and payment is on its way.',
  'done.allDone': 'Every participant form is complete.',
  'done.outstanding': 'Forms still outstanding',
  'done.outstandingBody':
    'Your payment is done, but these forms are still empty. Fill them in so every entrant gets an entry number. We also email a resume link.',
  'done.fillIn': 'Fill in',
  'done.viewAccount': 'Go to my account',

  // The standalone donation page. A donation is an order with no tickets on it.
  // The account card on the confirmation page. Entirely optional, the order is already complete.
  'claim.title': 'Keep this order on an account',
  'claim.body':
    'Choose a password and we attach this order to an account, so you can open it later without hunting for the link. Your entry is complete either way.',
  'claim.existingHint':
    'If an account already exists for this email, the same password simply signs you in.',
  'claim.button': 'Create account',
  'claim.saving': 'Linking…',
  'claim.claimed': 'This order is linked to your account.',

  'skenk.details': 'Your details',
  'skenk.reference': 'Your donation reference number',
};
