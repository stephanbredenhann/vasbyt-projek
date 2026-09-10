/* Mirrors the API contract. Every enum travels as its name, not its number, because the server
   registers JsonStringEnumConverter globally. */

export type Discipline = 'Run' | 'Cycle' | 'Walk';
export type OrderStatus = 'Pending' | 'Paid' | 'Cancelled';
export type TariffKind = 'Student' | 'Normal';
export type OrderLineKind = 'Ticket' | 'Product' | 'Donation';
export type AdvertKind = 'Accommodation' | 'Sponsor';

/** The six categories the 2027 spec fixes. Stable strings, safe to switch on. */
export type RouteCode = 'ligtrap' | 'vastrap' | 'ligstap' | 'vasstap' | 'ligdraf' | 'vasbyt';

export interface AppConfig {
  googleMapsApiKey: string | null;
  demoPayments: boolean;
  eventYear: number;
}

/** What one ticket of each kind costs right now. The client never computes a price. */
export interface Tariff {
  kind: TariffKind;
  amountZar: number;
  label: string;
  validFromUtc: string;
  validToUtc: string;
}

export interface RouteDay {
  dayNumber: number;
  dateLocal: string;
  distanceKm: number;
  elevationGainM: number;
  startTimeLocal: string;
  description: string;
  hasRoute: boolean;
}

export interface RouteCategory {
  id: number;
  code: RouteCode;
  name: string;
  discipline: Discipline;
  blurb: string;
  totalDistanceKm: number;
  elevationGainM: number;
  difficulty: string;
  hasRoute: boolean;
  /** ligstap and vasstap are false until the organisers confirm their distances. */
  isOpen: boolean;
  days: RouteDay[];
}

export interface ProductVariant {
  id: number;
  label: string;
  priceZar: number;
  stock: number;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  imageUrl: string | null;
  variants: ProductVariant[];
}

export interface Advert {
  id: number;
  kind: AdvertKind;
  name: string;
  blurb: string;
  imageUrl: string | null;
  linkUrl: string | null;
  bookingUrl: string | null;
  phone: string | null;
}

export interface OrderLine {
  id: number;
  kind: OrderLineKind;
  description: string;
  quantity: number;
  unitPriceZar: number;
  lineTotalZar: number;
  routeCode: RouteCode | null;
  tariffKind: TariffKind | null;
}

/** POPIA: this shape carries no identity number and no medical field, by construction. */
export interface EntrantSummary {
  id: number;
  orderLineId: number;
  routeCode: RouteCode;
  routeName: string;
  tariffKind: TariffKind;
  firstName: string;
  lastName: string;
  isComplete: boolean;
  entryNumber: string | null;
}

export interface Order {
  token: string;
  reference: string;
  status: OrderStatus;
  totalZar: number;
  createdUtc: string;
  buyerFirstName: string;
  buyerLastName: string;
  buyerEmail: string;
  isClaimed: boolean;
  lines: OrderLine[];
  /** Empty until the order is paid: payment is what creates one form per ticket. */
  entrants: EntrantSummary[];
}

export interface TicketRequest {
  routeCategoryId: number;
  tariffKind: TariffKind;
  quantity: number;
}

export interface ProductRequest {
  productVariantId: number;
  quantity: number;
}

export interface CreateOrderRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  tickets?: TicketRequest[];
  products?: ProductRequest[];
  donationZar?: number;
}

/** Fills a form payment already created. It carries no route and no tariff: the ticket knows. */
export interface EntrantForm {
  firstName: string;
  lastName: string;
  idNumber: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  shirtSize: string;
  streetAddress: string;
  town: string;
  province: string;
  postalCode: string;
  medicalConditions: string | null;
  medication: string | null;
  medicalFund: string | null;
  medicalFundNumber: string | null;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  clubName: string | null;
  acceptTerms: boolean;
  guardianConsentName: string | null;
  photoConsent: boolean;
}

export interface ProvinceCount {
  province: string;
  count: number;
}

export interface RouteCount {
  code: RouteCode;
  name: string;
  count: number;
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}

export interface AdminStats {
  entrants: number;
  paidOrders: number;
  pendingOrders: number;
  unfilledForms: number;
  totalRevenueZar: number;
  entryRevenueZar: number;
  productRevenueZar: number;
  donationRevenueZar: number;
  byRoute: RouteCount[];
}

/** The one projection that carries the sensitive fields, and only behind the Admin role. */
export interface AdminEntrant {
  id: number;
  firstName: string;
  lastName: string;
  idNumber: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  shirtSize: string;
  streetAddress: string;
  town: string;
  province: string;
  postalCode: string;
  medicalConditions: string | null;
  medication: string | null;
  medicalFund: string | null;
  medicalFundNumber: string | null;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  clubName: string | null;
  entryNumber: string | null;
  isComplete: boolean;
  route: string;
  routeCode: RouteCode;
  tariff: TariffKind;
  orderReference: string;
  orderStatus: OrderStatus;
}

export interface AdminOrder {
  id: number;
  reference: string;
  status: OrderStatus;
  totalZar: number;
  createdUtc: string;
  paidUtc: string | null;
  paymentReference: string | null;
  buyerFirstName: string;
  buyerLastName: string;
  buyerEmail: string;
  buyerPhone: string;
  lines: OrderLine[];
}

export interface PricingRule {
  id: number;
  tariffKind: TariffKind;
  validFromUtc: string;
  validToUtc: string;
  amountZar: number;
  label: string;
  isActive: boolean;
}

export interface Paged<T> {
  total: number;
  page: number;
  size: number;
  items: T[];
}

/** The nine provinces, in the Afrikaans spellings the map SVG is keyed on. */
export const PROVINCES = [
  'Oos-Kaap',
  'Vrystaat',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Noord-Kaap',
  'Noordwes',
  'Wes-Kaap',
] as const;
