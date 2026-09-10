import { Injectable, computed, signal } from '@angular/core';
import { ProductRequest, TariffKind, TicketRequest } from './api.models';

const CART_KEY = 'vasbyt.cart';
const TOKEN_KEY = 'vasbyt.orderToken';
const SAME_ADDRESS_KEY = 'vasbyt.sameAddressForAll';

export interface Buyer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface Cart {
  tickets: TicketRequest[];
  products: ProductRequest[];
  donationZar: number;
  buyer: Buyer;
}

const EMPTY: Cart = {
  tickets: [],
  products: [],
  donationZar: 0,
  buyer: { firstName: '', lastName: '', email: '', phone: '' },
};

/**
 * The registration flow's state between the choose screen and payment.
 *
 * The cart is deliberately client-side until the review step: the spec only requires the order to
 * exist server-side before the user is sent to the payment portal, and holding it here means a
 * browser that wanders off never leaves a half-built Pending order behind. After the order is
 * created the token takes over as the browser's only handle on it, so that one must survive a
 * reload even though no account exists yet.
 *
 * Prices are never stored here. Every total shown comes from the server.
 */
@Injectable({ providedIn: 'root' })
export class OrderFlowService {
  private readonly state = signal<Cart>(load());

  readonly cart = this.state.asReadonly();
  readonly ticketCount = computed(() => this.state().tickets.reduce((n, t) => n + t.quantity, 0));
  readonly productCount = computed(() => this.state().products.reduce((n, p) => n + p.quantity, 0));
  readonly isEmpty = computed(
    () => this.ticketCount() === 0 && this.productCount() === 0 && this.state().donationZar === 0,
  );

  /** Sets a quantity outright rather than incrementing, because the choose grid is a number input. */
  setTicket(routeCategoryId: number, tariffKind: TariffKind, quantity: number) {
    this.patch((c) => ({
      ...c,
      tickets: upsert(
        c.tickets,
        (t) => t.routeCategoryId === routeCategoryId && t.tariffKind === tariffKind,
        { routeCategoryId, tariffKind, quantity },
        quantity,
      ),
    }));
  }

  ticketQuantity(routeCategoryId: number, tariffKind: TariffKind): number {
    return (
      this.state().tickets.find(
        (t) => t.routeCategoryId === routeCategoryId && t.tariffKind === tariffKind,
      )?.quantity ?? 0
    );
  }

  setProduct(productVariantId: number, quantity: number) {
    this.patch((c) => ({
      ...c,
      products: upsert(
        c.products,
        (p) => p.productVariantId === productVariantId,
        { productVariantId, quantity },
        quantity,
      ),
    }));
  }

  productQuantity(productVariantId: number): number {
    return this.state().products.find((p) => p.productVariantId === productVariantId)?.quantity ?? 0;
  }

  setDonation(amountZar: number) {
    this.patch((c) => ({ ...c, donationZar: Math.max(0, amountZar) }));
  }

  setBuyer(buyer: Buyer) {
    this.patch((c) => ({ ...c, buyer }));
  }

  clear() {
    this.state.set({ ...EMPTY, buyer: { ...EMPTY.buyer } });
    write(CART_KEY, null);
  }

  get token(): string | null {
    return read(TOKEN_KEY);
  }

  set token(value: string | null) {
    write(TOKEN_KEY, value);
  }

  /** Set by the toggle on entrant #1; later entrants prefill their address from the first person. */
  get sameAddressForAll(): boolean {
    return read(SAME_ADDRESS_KEY) === 'true';
  }

  set sameAddressForAll(value: boolean) {
    write(SAME_ADDRESS_KEY, value ? 'true' : null);
  }

  private patch(fn: (c: Cart) => Cart) {
    const next = fn(this.state());
    this.state.set(next);
    write(CART_KEY, JSON.stringify(next));
  }
}

/** Replaces a matching row, appends when there is none, and drops it when the quantity hits zero. */
function upsert<T>(rows: T[], match: (row: T) => boolean, row: T, quantity: number): T[] {
  const rest = rows.filter((r) => !match(r));
  return quantity > 0 ? [...rest, row] : rest;
}

function load(): Cart {
  const raw = read(CART_KEY);
  if (!raw) return { ...EMPTY, buyer: { ...EMPTY.buyer } };
  try {
    const parsed = JSON.parse(raw) as Partial<Cart>;
    return {
      tickets: parsed.tickets ?? [],
      products: parsed.products ?? [],
      donationZar: parsed.donationZar ?? 0,
      buyer: { ...EMPTY.buyer, ...parsed.buyer },
    };
  } catch {
    return { ...EMPTY, buyer: { ...EMPTY.buyer } };
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // ponytail: storage blocked means no resume-after-refresh. The flow itself still works.
  }
}
