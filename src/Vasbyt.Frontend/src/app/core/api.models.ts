export type Discipline = 'Run' | 'Cycle';
export type OrderStatus = 'Pending' | 'Paid' | 'Cancelled';

export interface AppConfig {
  googleMapsApiKey: string | null;
  demoPayments: boolean;
  /** Flat across all four events — which is what lets payment come before the choice. */
  entryFeeZar: number;
}

export interface Distance {
  id: number;
  name: string;
  distanceKm: number;
  elevationGainM: number;
  hasRoute: boolean;
}

export interface VasbytEvent {
  id: number;
  discipline: Discipline;
  name: string;
  blurb: string;
  startDateUtc: string;
  isOpen: boolean;
  distances: Distance[];
}

export interface EntrantSummary {
  id: number;
  firstName: string;
  lastName: string;
  town: string;
  province: string;
  eventName: string;
  distanceName: string;
  discipline: Discipline;
}

export interface Order {
  token: string;
  entrantCount: number;
  amountZar: number;
  entryFeeZar: number;
  status: OrderStatus;
  entrantsFilled: number;
  isClaimed: boolean;
  entrants: EntrantSummary[];
}

export interface EntrantForm {
  eventDistanceId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  shirtSize: string;
  emergencyName: string;
  emergencyPhone: string;
  medicalNotes: string | null;
  town: string;
  province: string;
  clubName: string | null;
}

export interface ProvinceCount {
  province: string;
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
  unfilledSlots: number;
  entryRevenueZar: number;
  donationRevenueZar: number;
  byDistance: { name: string; distance: string; count: number }[];
}

export interface AdminEntrant {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  town: string;
  province: string;
  shirtSize: string;
  clubName: string | null;
  medicalNotes: string | null;
  event: string;
  distance: string;
  orderStatus: OrderStatus;
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
