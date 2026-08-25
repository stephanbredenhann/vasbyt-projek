import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  AdminEntrant, AdminStats, AppConfig, CurrentUser, EntrantForm, Order, ProvinceCount, VasbytEvent,
} from './api.models';

/** Same-origin in production (the SPA ships inside wwwroot); proxied to :5080 by ng serve. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  config() {
    return this.http.get<AppConfig>('/api/config');
  }

  events() {
    return this.http.get<VasbytEvent[]>('/api/events');
  }

  registrationsByProvince() {
    return this.http.get<ProvinceCount[]>('/api/registrations/by-province');
  }

  gpx(distanceId: number) {
    return this.http.get(`/api/routes/${distanceId}/gpx`, { responseType: 'text' });
  }

  createOrder(entrantCount: number) {
    return this.http.post<Order>('/api/orders', { entrantCount });
  }

  order(token: string) {
    return this.http.get<Order>(`/api/orders/${token}`);
  }

  payOrder(token: string) {
    return this.http.post<Order>(`/api/orders/${token}/pay-demo`, {});
  }

  addEntrant(token: string, entrant: EntrantForm) {
    return this.http.post<Order>(`/api/orders/${token}/entrants`, entrant);
  }

  claimOrder(token: string, body: { email: string; password: string; firstName: string; lastName: string }) {
    return this.http.post<Order>(`/api/orders/${token}/claim`, body);
  }

  myOrders() {
    return this.http.get<Order[]>('/api/my/orders');
  }

  donate(body: { amountZar: number; name?: string; email?: string; message?: string }) {
    return this.http.post<{ token: string; amountZar: number }>('/api/donations', body);
  }

  payDonation(token: string) {
    return this.http.post<{ status: string; amountZar: number }>(`/api/donations/${token}/pay-demo`, {});
  }

  login(email: string, password: string) {
    return this.http.post<CurrentUser>('/api/auth/login', { email, password });
  }

  logout() {
    return this.http.post('/api/auth/logout', {});
  }

  me() {
    return this.http.get<CurrentUser>('/api/auth/me');
  }

  adminStats() {
    return this.http.get<AdminStats>('/api/admin/stats');
  }

  adminEntrants(q: string, page: number, size = 25) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (q) params = params.set('q', q);
    return this.http.get<{ total: number; page: number; size: number; items: AdminEntrant[] }>(
      '/api/admin/entrants', { params },
    );
  }
}
