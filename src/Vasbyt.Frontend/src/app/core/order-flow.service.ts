import { Injectable, computed, signal } from '@angular/core';
import { EntrantForm, Order, ProductRequest, TariffKind, TicketRequest } from './api.models';

const CART_KEY = 'vasbyt.cart';
const TOKEN_KEY = 'vasbyt.orderToken';
const PENDING_KEY = 'vasbyt.pendingOrder';
const CHECKOUT_KEY = 'vasbyt.checkoutKey';

export interface Buyer { firstName: string; lastName: string; email: string; phone: string }
export interface Cart { tickets: TicketRequest[]; products: ProductRequest[]; donationZar: number; buyer: Buyer; revision: string }
export interface PendingOrder { token: string; version: number; submittedRevision: string }

const emptyBuyer = (): Buyer => ({ firstName: '', lastName: '', email: '', phone: '' });
const emptyCart = (): Cart => ({ tickets: [], products: [], donationZar: 0, buyer: emptyBuyer(), revision: crypto.randomUUID() });
const validQty = (n: unknown) => Number.isInteger(n) && Number(n) > 0 && Number(n) <= 20;
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string | null) => {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* In-memory state remains usable. */ }
};
const str = (v: unknown) => typeof v === 'string' ? v : '';

function loadCart(): Cart {
  try {
    const c = JSON.parse(read(CART_KEY) ?? 'null');
    if (!c || typeof c !== 'object') return emptyCart();
    const tickets = Array.isArray(c.tickets) ? c.tickets.filter((x: TicketRequest) =>
      Number.isInteger(x.routeCategoryId) && x.routeCategoryId > 0 &&
      (x.tariffKind === 'Student' || x.tariffKind === 'Normal') && validQty(x.quantity)) : [];
    const products = Array.isArray(c.products) ? c.products.filter((x: ProductRequest) =>
      Number.isInteger(x.productVariantId) && x.productVariantId > 0 && validQty(x.quantity)) : [];
    const uniqueTickets = new Map<string, TicketRequest>();
    for (const t of tickets) uniqueTickets.set(`${t.routeCategoryId}:${t.tariffKind}`, t);
    const uniqueProducts = new Map<number, ProductRequest>();
    for (const p of products) uniqueProducts.set(p.productVariantId, p);
    const donation = Number(c.donationZar);
    return {
      tickets: [...uniqueTickets.values()], products: [...uniqueProducts.values()],
      donationZar: Number.isFinite(donation) && donation >= 0 ? donation : 0,
      buyer: { firstName: str(c.buyer?.firstName), lastName: str(c.buyer?.lastName), email: str(c.buyer?.email), phone: str(c.buyer?.phone) },
      revision: str(c.revision) || crypto.randomUUID(),
    };
  } catch { return emptyCart(); }
}

@Injectable({ providedIn: 'root' })
export class OrderFlowService {
  private readonly state = signal<Cart>(loadCart());
  private tokenMemory: string | null = read(TOKEN_KEY);
  private pendingMemory: PendingOrder | null = this.loadPending();
  private keyMemory: { fingerprint: string; key: string } | null = this.loadKey();
  private readonly drafts = new Map<string, EntrantForm>();
  private readonly addresses = new Map<string, Pick<EntrantForm, 'streetAddress' | 'town' | 'province' | 'postalCode'>>();

  readonly cart = this.state.asReadonly();
  readonly ticketCount = computed(() => this.state().tickets.reduce((n, t) => n + t.quantity, 0));
  readonly productCount = computed(() => this.state().products.reduce((n, p) => n + p.quantity, 0));
  /** What the header badge shows: a donation counts as one item so a donation-only basket never reads 0. */
  readonly itemCount = computed(() => this.ticketCount() + this.productCount() + (this.state().donationZar > 0 ? 1 : 0));
  readonly isEmpty = computed(() => !this.ticketCount() && !this.productCount() && !this.state().donationZar);

  constructor() {
    if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
      if (event.key === CART_KEY) this.state.set(loadCart());
      if (event.key === TOKEN_KEY) this.tokenMemory = read(TOKEN_KEY);
      if (event.key === PENDING_KEY) this.pendingMemory = this.loadPending();
    });
  }
  setTicket(routeCategoryId: number, tariffKind: TariffKind, quantity: number) {
    if (!Number.isInteger(routeCategoryId) || routeCategoryId <= 0) return;
    const q = Math.min(20, Math.max(0, Math.trunc(quantity) || 0));
    this.patch(c => ({ ...c, tickets: [...c.tickets.filter(t => t.routeCategoryId !== routeCategoryId || t.tariffKind !== tariffKind), ...(q ? [{ routeCategoryId, tariffKind, quantity: q }] : [])] }));
  }
  ticketQuantity(id: number, kind: TariffKind) { return this.state().tickets.find(t => t.routeCategoryId === id && t.tariffKind === kind)?.quantity ?? 0; }
  setProduct(productVariantId: number, quantity: number) {
    if (!Number.isInteger(productVariantId) || productVariantId <= 0) return;
    const q = Math.min(20, Math.max(0, Math.trunc(quantity) || 0));
    this.patch(c => ({ ...c, products: [...c.products.filter(p => p.productVariantId !== productVariantId), ...(q ? [{ productVariantId, quantity: q }] : [])] }));
  }
  productQuantity(id: number) { return this.state().products.find(p => p.productVariantId === id)?.quantity ?? 0; }
  setDonation(value: number) { this.patch(c => ({ ...c, donationZar: Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0 })); }
  setBuyer(buyer: Buyer) { this.patch(c => ({ ...c, buyer: { ...buyer } })); }
  prefillBuyer(profile: { firstName: string; lastName: string; email: string }) {
    const b = this.state().buyer;
    this.setBuyer({ firstName: b.firstName || profile.firstName, lastName: b.lastName || profile.lastName, email: b.email || profile.email, phone: b.phone });
  }
  clearIfRevision(revision: string): boolean {
    if (this.state().revision !== revision) return false;
    this.state.set(emptyCart());
    write(CART_KEY, JSON.stringify(this.state()));
    this.rotateKey();
    return true;
  }
  clear() { this.state.set(emptyCart()); write(CART_KEY, JSON.stringify(this.state())); this.rotateKey(); }
  get token() { return this.tokenMemory; }
  set token(value: string | null) { this.tokenMemory = value; write(TOKEN_KEY, value); }
  get pending() { return this.pendingMemory; }
  savePending(order: Order, submittedRevision: string) {
    this.pendingMemory = { token: order.token, version: order.version, submittedRevision };
    write(PENDING_KEY, JSON.stringify(this.pendingMemory));
    this.token = order.token;
  }
  clearPending(token: string) {
    if (this.pendingMemory?.token === token) { this.pendingMemory = null; write(PENDING_KEY, null); }
    if (this.token === token) this.token = null;
  }
  checkoutKey(): string {
    const c = this.state();
    const fingerprint = JSON.stringify([c.tickets, c.products, c.donationZar, c.buyer]);
    if (this.keyMemory?.fingerprint !== fingerprint) {
      this.keyMemory = { fingerprint, key: crypto.randomUUID() };
      write(CHECKOUT_KEY, JSON.stringify(this.keyMemory));
    }
    return this.keyMemory.key;
  }
  private rotateKey() { this.keyMemory = null; write(CHECKOUT_KEY, null); }
  signOut() {
    this.state.update(c => ({ ...c, buyer: emptyBuyer(), revision: crypto.randomUUID() }));
    write(CART_KEY, JSON.stringify(this.state()));
    this.token = null;
    this.pendingMemory = null;
    write(PENDING_KEY, null);
    this.rotateKey();
    this.drafts.clear();
    this.addresses.clear();
  }
  draft(token: string, entrantId: number) { return this.drafts.get(`${token}:${entrantId}`); }
  saveDraft(token: string, entrantId: number, form: EntrantForm) { this.drafts.set(`${token}:${entrantId}`, { ...form }); }
  clearDraft(token: string, entrantId: number) { this.drafts.delete(`${token}:${entrantId}`); }
  address(token: string) { return this.addresses.get(token); }
  setAddress(token: string, address: Pick<EntrantForm, 'streetAddress' | 'town' | 'province' | 'postalCode'> | null) {
    if (address) this.addresses.set(token, address); else this.addresses.delete(token);
  }
  private patch(fn: (c: Cart) => Cart) {
    const current = this.state();
    const next = fn(current);
    if (JSON.stringify({ ...current, revision: '' }) === JSON.stringify({ ...next, revision: '' })) return;
    next.revision = crypto.randomUUID();
    this.state.set(next);
    write(CART_KEY, JSON.stringify(next));
    this.rotateKey();
  }
  private loadPending(): PendingOrder | null {
    try { const p = JSON.parse(read(PENDING_KEY) ?? 'null'); return p && typeof p.token === 'string' && Number.isInteger(p.version) && typeof p.submittedRevision === 'string' ? p : null; } catch { return null; }
  }
  private loadKey(): { fingerprint: string; key: string } | null {
    try { const k = JSON.parse(read(CHECKOUT_KEY) ?? 'null'); return k && typeof k.fingerprint === 'string' && typeof k.key === 'string' ? k : null; } catch { return null; }
  }
}
