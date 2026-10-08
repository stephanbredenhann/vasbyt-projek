import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Track, parseGpx } from '../shared/gpx';
import {
  Advert, AdvertKind, AdminEntrant, AdminOrder, AdminStats, AppConfig, CreateOrderRequest,
  CurrentUser, Discipline, EntrantForm, Order, Paged, PricingRule, Product, ProvinceCount,
  RouteCategory, RouteCode, RouteCount, Tariff, ProgrammeDay, ScanResult, Quote,
} from './api.models';

/** Same-origin in production (the SPA ships inside wwwroot); proxied to :5080 by ng serve. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private tracks = new Map<string, Promise<Track | null>>();

  // --- Public -------------------------------------------------------------

  config() {
    return this.http.get<AppConfig>('/api/config');
  }

  tariffs() {
    return this.http.get<Tariff[]>('/api/tariffs');
  }

  routes() {
    return this.http.get<RouteCategory[]>('/api/routes');
  }

  programme() {
    return this.http.get<ProgrammeDay[]>('/api/programme');
  }

  adminSaveProgramme(days: ProgrammeDay[]) {
    return this.http.put<ProgrammeDay[]>('/api/admin/programme', days);
  }

  adminScan(code: string) {
    return this.http.post<ScanResult>('/api/admin/scan', { code });
  }

  adminEntrant(id: number) {
    return this.http.get<ScanResult>(`/api/admin/entrants/${id}`);
  }

  adminCheckIn(id: number) {
    return this.http.post<ScanResult>(`/api/admin/entrants/${id}/check-in`, {});
  }

  adminUndoCheckIn(id: number) {
    return this.http.delete<ScanResult>(`/api/admin/entrants/${id}/check-in`);
  }

  products() {
    return this.http.get<Product[]>('/api/products');
  }

  adverts(kind?: AdvertKind) {
    const params = kind ? new HttpParams().set('kind', kind) : undefined;
    return this.http.get<Advert[]>('/api/adverts', { params });
  }

  registrationsByProvince() {
    return this.http.get<ProvinceCount[]>('/api/registrations/by-province');
  }

  registrationsByRoute() {
    return this.http.get<RouteCount[]>('/api/registrations/by-route');
  }

  gpx(routeCategoryId: number) {
    return this.http.get(`/api/routes/${routeCategoryId}/gpx`, { responseType: 'text' });
  }

  dayGpxUrl(code: RouteCode, day: number) {
    return `/api/routes/${code}/days/${day}/gpx`;
  }

  /** One parse per file per page load: the cards, the map dialog and the detail page share it. */
  dayTrack(code: RouteCode, day: number): Promise<Track | null> {
    const url = this.dayGpxUrl(code, day);
    let hit = this.tracks.get(url);
    if (!hit) {
      hit = firstValueFrom(this.http.get(url, { responseType: 'text' }))
        .then(parseGpx)
        .catch(() => null);
      this.tracks.set(url, hit);
    }
    return hit;
  }

  // --- Orders -------------------------------------------------------------

  /** The whole cart in one call. Every price is looked up server-side. */
  createOrder(body: CreateOrderRequest) {
    return this.http.post<Order>('/api/orders', body);
  }

  quoteOrder(body: Partial<CreateOrderRequest>) { return this.http.post<Quote>('/api/orders/quote', body); }

  updateOrder(token: string, body: CreateOrderRequest & { version: number; expectedTotalZar?: number }) {
    return this.http.put<Order>(`/api/orders/${token}`, body);
  }

  linkOrder(token: string) { return this.http.post<Order>(`/api/orders/${token}/link`, {}); }

  order(token: string) {
    return this.http.get<Order>(`/api/orders/${token}`);
  }

  /** ponytail: demo payment. Swap for the PSP redirect; the Paid transition stays server-side. */
  payOrder(token: string, intent: { version: number; expectedTotalZar: number }) {
    return this.http.post<Order>(`/api/orders/${token}/pay-demo`, intent);
  }

  /** Kwik hosted checkout URL to redirect the browser to. */
  startPayment(token: string, intent: { version: number; expectedTotalZar: number }) {
    return this.http.post<{ url: string }>(`/api/orders/${token}/pay`, intent);
  }

  /** Asks the server to check Kwik after the redirect back. Returns the order either way. */
  verifyPayment(token: string) {
    return this.http.post<Order>(`/api/orders/${token}/pay/verify`, {});
  }

  /** Fills a form payment already created. Sends no route and no tariff: the ticket knows. */
  saveEntrant(token: string, entrantId: number, entrant: EntrantForm) {
    return this.http.put<Order>(`/api/orders/${token}/entrants/${entrantId}`, entrant);
  }

  retryConfirmation(token: string) { return this.http.post<Order>(`/api/orders/${token}/confirmation-email`, {}); }

  myOrders() {
    return this.http.get<Order[]>('/api/my/orders');
  }

  // --- Auth ---------------------------------------------------------------

  login(email: string, password: string) {
    return this.http.post<CurrentUser>('/api/auth/login', { email, password });
  }

  logout() {
    return this.http.post('/api/auth/logout', {});
  }

  me() {
    return this.http.get<CurrentUser>('/api/auth/me');
  }

  createAccount(body: { firstName: string; lastName: string; email: string; password: string }) {
    return this.http.post<CurrentUser>('/api/auth/register', body);
  }

  forgotPassword(email: string) { return this.http.post('/api/auth/forgot-password', { email }); }
  resetPassword(email: string, token: string, password: string) {
    return this.http.post('/api/auth/reset-password', { email, token, password });
  }

  // --- Admin --------------------------------------------------------------

  adminStats() {
    return this.http.get<AdminStats>('/api/admin/stats');
  }

  adminEntrants(q: string, page: number, size = 25, incompleteOnly = false) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (q) params = params.set('q', q);
    if (incompleteOnly) params = params.set('incompleteOnly', true);
    return this.http.get<Paged<AdminEntrant>>('/api/admin/entrants', { params });
  }

  adminResendPass(id: number) {
    return this.http.post<{ sent: number }>(`/api/admin/entrants/${id}/resend-pass`, {});
  }

  /** Every field, always: the server record takes null for a missing one and blanks the column. */
  adminUpdateEntrant(id: number, body: EntrantPatch) {
    return this.http.patch<void>(`/api/admin/entrants/${id}`, body);
  }

  adminOrders(page: number, size = 25) {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Paged<AdminOrder>>('/api/admin/orders', { params });
  }

  adminCollect(orderId: number, lines: { orderLineId: number; collectedQuantity: number }[]) {
    return this.http.put<{ lines: { orderLineId: number; collectedQuantity: number; quantity: number }[] }>(
      `/api/admin/orders/${orderId}/collection`, { lines });
  }

  /** Downloads as text so the caller can hand it to a Blob without a second request. */
  adminExportEntrants(routeCode?: string) {
    const params = routeCode ? new HttpParams().set('routeCode', routeCode) : undefined;
    return this.http.get('/api/admin/entrants/export', { params, responseType: 'text' });
  }

  // --- Admin CMS ----------------------------------------------------------

  /** Multipart. The server renames to a Guid and validates magic bytes, not the declared type. */
  adminUpload(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<Upload>('/api/admin/uploads', form);
  }

  adminPricingRules() {
    return this.http.get<PricingRule[]>('/api/admin/pricing-rules');
  }

  adminSavePricingRule(rule: PricingRuleBody) {
    return rule.id
      ? this.http.put<PricingRule>(`/api/admin/pricing-rules/${rule.id}`, rule)
      : this.http.post<PricingRule>('/api/admin/pricing-rules', rule);
  }

  adminDeletePricingRule(id: number) {
    return this.http.delete<Deleted>(`/api/admin/pricing-rules/${id}`);
  }

  adminProducts() {
    return this.http.get<AdminProduct[]>('/api/admin/products');
  }

  adminSaveProduct(product: ProductBody) {
    return product.id
      ? this.http.put<Saved>(`/api/admin/products/${product.id}`, product)
      : this.http.post<Saved>('/api/admin/products', product);
  }

  adminDeleteProduct(id: number) {
    return this.http.delete<Deleted>(`/api/admin/products/${id}`);
  }

  adminSaveVariant(productId: number, variant: VariantBody) {
    return variant.id
      ? this.http.put<Saved>(`/api/admin/products/${productId}/variants/${variant.id}`, variant)
      : this.http.post<Saved>(`/api/admin/products/${productId}/variants`, variant);
  }

  adminDeleteVariant(productId: number, variantId: number) {
    return this.http.delete<Deleted>(`/api/admin/products/${productId}/variants/${variantId}`);
  }

  adminAdverts(kind?: AdvertKind) {
    const params = kind ? new HttpParams().set('kind', kind) : undefined;
    return this.http.get<AdminAdvert[]>('/api/admin/adverts', { params });
  }

  adminSaveAdvert(advert: AdvertBody) {
    return advert.id
      ? this.http.put<Saved>(`/api/admin/adverts/${advert.id}`, advert)
      : this.http.post<Saved>('/api/admin/adverts', advert);
  }

  adminDeleteAdvert(id: number) {
    return this.http.delete<Deleted>(`/api/admin/adverts/${id}`);
  }

  adminRoutes() {
    return this.http.get<AdminRouteCategory[]>('/api/admin/routes');
  }

  /** Update only. The six categories are fixed by the spec, so there is no create or delete. */
  adminSaveRoute(route: RouteBody) {
    return this.http.put<void>(`/api/admin/routes/${route.id}`, route);
  }

  /** Days are the exception; a walk's days belong to its run route. */
  adminSaveRouteDay(routeId: number, day: RouteDayBody & { id?: number; dayNumber?: number }) {
    return day.id
      ? this.http.put<Saved>(`/api/admin/routes/${routeId}/days/${day.id}`, day)
      : this.http.post<Saved>(`/api/admin/routes/${routeId}/days`, day);
  }

  adminDeleteRouteDay(routeId: number, dayId: number) {
    return this.http.delete<Deleted>(`/api/admin/routes/${routeId}/days/${dayId}`);
  }
}

// --- Admin-only shapes ----------------------------------------------------
// The CMS projections carry imageFileName, sortOrder and isActive, which the public ones drop.
// They live here rather than in api.models.ts so the public model file stays the public contract.

export interface Upload {
  fileName: string;
  url: string;
}

/** Every admin DELETE answers this. The endpoint decides; a referenced row deactivates instead. */
export interface Deleted {
  hardDeleted: boolean;
}

/** POST answers { id }, PUT answers 204 with an empty body. One type keeps the callers simple. */
export interface Saved {
  id?: number;
}

export interface AdminVariant {
  id: number;
  label: string;
  priceZar: number;
  stock: number;
  isActive: boolean;
  version: number;
  trackStock: boolean;
}

export interface AdminProduct {
  id: number;
  name: string;
  description: string;
  imageFileName: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  variants: AdminVariant[];
}

export interface AdminAdvert {
  id: number;
  kind: AdvertKind;
  name: string;
  blurb: string;
  imageFileName: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  bookingUrl: string | null;
  phone: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface AdminRouteDay {
  id: number;
  dayNumber: number;
  dateLocal: string;
  distanceKm: number;
  elevationGainM: number;
  startTimeLocal: string;
  description: string;
  gpxFileName: string | null;
}

export interface AdminRouteCategory {
  id: number;
  code: RouteCode;
  name: string;
  discipline: Discipline;
  blurb: string;
  totalDistanceKm: number;
  elevationGainM: number;
  difficulty: string;
  gpxFileName: string | null;
  sortOrder: number;
  isOpen: boolean;
  sharesRouteWithCode: RouteCode | null;
  days: AdminRouteDay[];
}

export type EntrantPatch = Pick<
  AdminEntrant,
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'shirtSize'
  | 'streetAddress'
  | 'town'
  | 'province'
  | 'postalCode'
  | 'clubName'
  | 'medicalConditions'
  | 'medication'
  | 'medicalFund'
  | 'medicalFundNumber'
  | 'emergencyName'
  | 'emergencyRelationship'
  | 'emergencyPhone'
>;

export type PricingRuleBody = { id?: number } & Omit<PricingRule, 'id'>;

export type ProductBody = {
  id?: number;
  name: string;
  description: string;
  imageFileName: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type VariantBody = { id?: number } & Omit<AdminVariant, 'id'>;

export type AdvertBody = { id?: number } & Omit<AdminAdvert, 'id' | 'imageUrl'>;

export type RouteBody = Pick<
  AdminRouteCategory,
  'id' | 'name' | 'blurb' | 'totalDistanceKm' | 'elevationGainM' | 'difficulty' | 'isOpen' | 'sortOrder'
>;

export type RouteDayBody = Pick<
  AdminRouteDay,
  'dateLocal' | 'distanceKm' | 'elevationGainM' | 'startTimeLocal' | 'description'
>;
