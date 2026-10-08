import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Quote } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { Steps } from './steps';

/**
 * The one basket the shop, the entry flow and the donation page all fill. Every amount on it is the
 * server's quote, so a missing product or a changed price shows up here rather than at payment.
 */
@Component({
  selector: 'vb-basket',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, Steps],
  template: `
    <div class="container section">
      <vb-steps current="basket" [tickets]="flow.ticketCount() > 0" />
      <h1>{{ i18n.t('basket.title') }}</h1>
      @if (flow.isEmpty()) {
        <div class="card empty">
          <p class="lead">{{ i18n.t('basket.empty') }}</p>
          <div class="extras">
            <a class="btn btn--accent" routerLink="/winkel">{{ i18n.t('basket.toShop') }}</a>
            <a class="btn btn--primary" routerLink="/registreer">{{ i18n.t('basket.addTickets') }}</a>
          </div>
        </div>
      } @else {
        <div class="split">
          <div class="card">
            @if (flow.cart().tickets.length) {
              <h2>{{ i18n.t('basket.entries') }}</h2>
              @for (t of flow.cart().tickets; track t.routeCategoryId + ':' + t.tariffKind) {
                <div class="line">
                  <span>{{ label('Ticket', t.routeCategoryId, t.tariffKind) }}</span>
                  <span class="stepper" role="group" [attr.aria-label]="i18n.t('reg.qty') + ': ' + label('Ticket', t.routeCategoryId, t.tariffKind)">
                    <button type="button" class="stepper__btn" [attr.aria-label]="i18n.t('reg.fewer')" (click)="flow.setTicket(t.routeCategoryId, t.tariffKind, t.quantity - 1)">−</button>
                    <output class="stepper__value">{{ t.quantity }}</output>
                    <button type="button" class="stepper__btn" [attr.aria-label]="i18n.t('reg.more')" [disabled]="flow.ticketCount() >= 20" (click)="flow.setTicket(t.routeCategoryId, t.tariffKind, t.quantity + 1)">+</button>
                  </span>
                </div>
              }
              <p class="muted note">{{ i18n.t('basket.formsNote') }}</p>
            }
            @if (flow.cart().products.length) {
              <h2>{{ i18n.t('basket.products') }}</h2>
              @for (p of flow.cart().products; track p.productVariantId) {
                <div class="line">
                  <span>
                    {{ label('Product', p.productVariantId) }}
                    @if (soldOutIds().includes(p.productVariantId)) {
                      <span class="chip chip--quiet">{{ i18n.t('shop.soldOut') }}</span>
                    }
                  </span>
                  <span class="stepper" role="group" [attr.aria-label]="i18n.t('reg.qty') + ': ' + label('Product', p.productVariantId)">
                    <button type="button" class="stepper__btn" [attr.aria-label]="i18n.t('reg.fewer')" (click)="flow.setProduct(p.productVariantId, p.quantity - 1)">−</button>
                    <output class="stepper__value">{{ p.quantity }}</output>
                    <button type="button" class="stepper__btn" [attr.aria-label]="i18n.t('reg.more')" [disabled]="p.quantity >= 20" (click)="flow.setProduct(p.productVariantId, p.quantity + 1)">+</button>
                  </span>
                </div>
              }
              <p class="muted note">{{ i18n.t('shop.collectNote') }}</p>
            }

            <h2>{{ i18n.t('reg.donationTitle') }}</h2>
            <p class="muted">{{ i18n.t('basket.donationIntro') }}</p>
            <div class="chips">
              <button type="button" class="chip" [attr.aria-pressed]="flow.cart().donationZar === 0" (click)="flow.setDonation(0)">
                {{ i18n.t('reg.donationNone') }}
              </button>
              @for (p of presets; track p) {
                <button type="button" class="chip" [attr.aria-pressed]="flow.cart().donationZar === p" (click)="flow.setDonation(p)">
                  {{ p | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
                </button>
              }
            </div>
            <label class="field donation">
              <span>{{ i18n.t('reg.donationOwn') }}</span>
              <input type="number" min="10" step="10" inputmode="numeric" [value]="flow.cart().donationZar || ''" (change)="donate($event)" />
              @if (flow.cart().donationZar > 0 && flow.cart().donationZar < 10) {
                <small class="field__error">{{ i18n.t('reg.donationMin') }}</small>
              }
            </label>

            <div class="extras">
              <a class="btn btn--ghost" routerLink="/winkel">{{ i18n.t('basket.addProducts') }}</a>
              <a class="btn btn--ghost" routerLink="/registreer">{{ i18n.t(flow.ticketCount() ? 'basket.editTickets' : 'basket.addTickets') }}</a>
            </div>
          </div>

          <aside class="card summary" aria-live="polite">
            <h2>{{ i18n.t('pay.summary') }}</h2>
            @if (soldOutIds().length) {
              <p class="alert alert--error" role="alert">{{ i18n.t('basket.soldOutBlock') }}</p>
              <p class="muted">{{ i18n.t('basket.fixLines') }}</p>
            } @else if (error()) {
              <p class="alert alert--error" role="alert">{{ error() }}</p>
              <p class="muted">{{ i18n.t('basket.fixLines') }}</p>
            } @else if (quote(); as q) {
              <dl class="lines">
                @for (l of q.lines; track $index) {
                  <dt>{{ l.description }} <span class="muted">× {{ l.quantity }}</span></dt>
                  <dd>{{ l.lineTotalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
                }
                <dt class="is-total">{{ i18n.t('reg.total') }}</dt>
                <dd class="is-total">{{ q.totalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
              </dl>
              <a class="btn btn--accent btn--lg btn--block" routerLink="/bestel">{{ i18n.t('basket.checkout') }}</a>
              <p class="muted small">{{ i18n.t('basket.guestNote') }}</p>
            } @else {
              <p class="muted">{{ i18n.t('common.loading') }}</p>
            }
          </aside>
        </div>
      }
    </div>
  `,
  styles: `
    .split { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(16rem, 1fr); gap: var(--space-6); align-items: start; }
    .card h2 { font-size: 1.375rem; margin-top: var(--space-6); }
    .card h2:first-child { margin-top: 0; }
    .line { display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); padding: var(--space-3) 0; border-bottom: 1px solid var(--rule); }
    .note { font-size: 0.875rem; margin-top: var(--space-3); }
    .chips { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-4); }
    .donation { max-width: 14rem; }
    .extras { display: flex; gap: var(--space-3); flex-wrap: wrap; margin-top: var(--space-6); }
    .empty { max-width: 36rem; }
    .summary { position: sticky; top: var(--space-6); }
    .lines { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-2) 0; margin: var(--space-4) 0 var(--space-6); font-size: 0.9375rem; }
    .lines dt { padding-right: var(--space-4); }
    .lines dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
    .lines .is-total { padding-top: var(--space-3); border-top: 1px solid var(--rule); font-family: var(--font-display); font-size: 1.375rem; line-height: 1.1; }
    .small { font-size: 0.8125rem; margin: var(--space-3) 0 0; }
    @media (max-width: 720px) { .split { grid-template-columns: 1fr; } .summary { position: static; } }
  `,
})
export class Basket {
  protected readonly i18n = inject(I18nService);
  protected readonly flow = inject(OrderFlowService);
  private readonly api = inject(ApiService);
  protected readonly presets = [100, 250, 500, 1000];
  protected readonly quote = signal<Quote | null>(null);
  protected readonly error = signal<string | null>(null);
  private readonly offeredIds = signal<Set<number> | null>(null);
  /** Basket products no longer on offer. Empty until the shop list has loaded, so nothing is blocked early. */
  protected readonly soldOutIds = computed(() => {
    const offered = this.offeredIds();
    return offered ? this.flow.cart().products.map((p) => p.productVariantId).filter((id) => !offered.has(id)) : [];
  });
  private request = 0;

  constructor() {
    this.api.products().subscribe({
      next: (list) => this.offeredIds.set(new Set(list.flatMap((p) => p.variants.map((v) => v.id)))),
      error: () => {},
    });
    effect(() => {
      const c = this.flow.cart();
      const request = ++this.request;
      this.error.set(null);
      if (!c.tickets.length && !c.products.length && !c.donationZar) return;
      this.api.quoteOrder({ ...c.buyer, tickets: c.tickets, products: c.products, donationZar: c.donationZar }).subscribe({
        next: q => { if (request === this.request) this.quote.set(q); },
        error: e => { if (request === this.request) { this.quote.set(null); this.error.set(e.error?.detail ?? this.i18n.t('basket.quoteFailed')); } },
      });
    });
  }

  /** The quote's own description, so a line reads the same here, at payment and on the receipt. */
  protected label(kind: 'Ticket' | 'Product', id: number, tariff?: string) {
    const row = this.quote()?.lines.find(l => kind === 'Ticket'
      ? l.kind === kind && l.routeCategoryId === id && l.tariffKind === tariff
      : l.kind === kind && l.productVariantId === id);
    const stored = kind === 'Product' ? this.flow.cart().products.find(p => p.productVariantId === id) : undefined;
    const storedName = [stored?.name, stored?.variant].filter(Boolean).join(' - ');
    return row?.description ?? (storedName || this.i18n.t(kind === 'Ticket' ? 'reg.entryFees' : 'reg.products'));
  }

  protected donate(event: Event) { this.flow.setDonation(Number((event.target as HTMLInputElement).value)); }
}
