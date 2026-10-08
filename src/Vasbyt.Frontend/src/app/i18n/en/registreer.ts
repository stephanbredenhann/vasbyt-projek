// Serves the entry flow: choose, products, donation, review, pay, participant forms, confirmation.
export const registreer = {
  'reg.step': 'Step',
  'reg.of': 'of',
  'reg.step1': 'Choose',
  'reg.step2': 'Products',
  'reg.step3': "Donation",
  'reg.step4': "Overview",
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
  'reg.chooseTitle': "Choose your items",
  'reg.chooseIntro':
    "Choose how many entries you want in each category.",
  'reg.student': 'Student and scholar',
  'reg.normal': 'Standard',
  'reg.qty': 'Quantity',
  'reg.notOpen': 'Not open yet',
  'reg.notOpenHint': 'The distances for this route have not been confirmed yet.',
  'reg.entriesClosed': 'Entries are closed at the moment.',
  'reg.entriesClosedBody':
    'No fee window is open right now, so there is nothing to choose. Have a look at the routes in the meantime, we reopen as soon as the next window starts.',
  'reg.seeRoutes': 'See the routes',
  'reg.estimate': "Total",
  'reg.estimateHint': "",
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
    "Add something from our shop and get ready for Vasbyt 2027! (Optional)",
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
  'reg.donationTitle': "Make a difference",
  'reg.donationIntro':
    "Every cent goes to Orania Helpmekaar’s study fund. Your contribution can make a difference in a young person’s life. (Optional)",
  'reg.donation': 'Donation',
  'reg.donationNone': "None",
  'reg.donationOwn': 'Own amount',
  'reg.donationMin': 'The minimum donation is R10.',

  // Step 4, review and create the order.
  'reg.reviewTitle': "Your order overview",
  'reg.buyer': 'Buyer details',
  'reg.buyerIntro':
    "Fill in the details below to receive payment confirmation and your reference number.",
  'reg.emptyCart': 'Your cart is empty.',
  'reg.startOver': 'Start over',
  'reg.edit': 'Edit',
  'reg.createOrder': 'Save order and continue',
  'reg.creating': 'Saving…',
  'reg.orderSaved': 'Your order has been saved.',
  'reg.orderSavedBody':
    "Keep your reference number for enquiries. Save the link to this page to reopen your order. This browser also remembers your unfinished order.",
  'reg.toPayment': 'Go to payment',

  'pay.title': "Pay",
  'pay.summary': 'Summary',
  'pay.event': 'Event',
  'pay.entrants': 'Entrants',
  'pay.amount': 'Amount',
  'pay.warning':
    "",
  'pay.button': 'Pay now',
  'pay.demo': 'Demo payment',
  'pay.checkAgain': 'Check payment again',
  'pay.unconfirmed':
    'We have not received confirmation of your payment yet. If you paid, wait a moment and check again. Your order is kept.',
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
    "Complete the forms below for each participant.",
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
  'entrant.emergencyName': "Emergency contact: name",
  'entrant.emergencyPhone': "Emergency contact: phone",
  'entrant.emergencyRelation': "Emergency contact: relationship",
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
  'entrant.passwordHint': "At least 8 characters, including an uppercase letter, a lowercase letter and a number.",
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

  'done.title': "Your entry has been received!",
  'done.body':
    "Thank you, your payment has been received. Your entry and purchases are summarised below. Save your reference number and each participant’s QR pass.",
  'done.allDone': 'Every participant form is complete.',
  'done.outstanding': 'Forms still outstanding',
  'done.outstandingBody':
    "Your payment is complete, but these forms are still outstanding. Complete them so every participant can receive a QR pass.",
  'done.fillIn': 'Fill in',
  'done.viewAccount': 'Go to my account',

  // The standalone donation page. A donation is an order with no tickets on it.
  // The account card on the confirmation page. Entirely optional, the order is already complete.
  'claim.title': "Create an account (Optional)",
  'claim.body':
    "Create an account for easy access to your entry.",
  'claim.existingHint':
    'If an account already exists for this email, the same password simply signs you in.',
  'claim.button': 'Create account',
  'claim.saving': 'Linking…',
  'claim.claimed': 'This order is linked to your account.',

  'skenk.details': 'Your details',
  'skenk.reference': 'Your donation reference number',
};
