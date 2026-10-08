import { CurrencyPipe } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product, ProductVariant, Tariff } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { ImageSlot } from './image-slot';

const MAX_QTY = 20;

/**
 * The product grid the standalone shop and the entry flow share, so both edit the same basket.
 *
 * A card is a browse surface, not a form: quantities are picked in the dialog behind it. The cart
 * beside the grid carries any entries already chosen so the estimate reads in one go; the basket
 * page shows the server's figure.
 */
@Component({
  selector: 'vb-product-chooser',
  standalone: true,
  imports: [CurrencyPipe, ImageSlot, RouterLink],
  template: `
    @if (error()) {
      <p class="alert alert--error" role="alert">{{ error() }}</p>
    } @else if (!loaded()) {
      <p class="muted">{{ i18n.t('common.loading') }}</p>
    }

    <div class="split">
      <div>
        @if (loaded() && !error() && !products().length) {
          <p class="alert">{{ i18n.t('shop.empty') }}</p>
        }

        <div class="grid products">
          @for (p of products(); track p.id) {
            <button type="button" class="card product" (click)="open(p)">
              <vb-image [src]="p.imageUrl" [alt]="p.name" ratio="1 / 1" fit="contain" [label]="p.name" />
              <h2>{{ p.name }}</h2>
              <p class="product__price">
                {{ low(p) | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
                @if (high(p) > low(p)) {
                  <span class="product__to">{{ i18n.t('shop.to') }}</span>
                  {{ high(p) | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
                }
              </p>
              @if (chosen(p); as n) {
                <span class="chip chip--accent">{{ i18n.t('shop.inBasket') }} × {{ n }}</span>
              } @else if (soldOut(p)) {
                <span class="chip chip--quiet">{{ i18n.t('shop.soldOut') }}</span>
              } @else {
                <span class="chip chip--quiet">{{ i18n.t('reg.pick') }}</span>
              }
            </button>
          }
        </div>
      </div>

      <aside class="card cart" aria-live="polite">
        <h2>{{ i18n.t('reg.cart') }}</h2>
        <dl class="lines">
          @if (flow.ticketCount()) {
            <dt>
              {{ i18n.t('reg.entryFees') }}
              <span class="muted">× {{ flow.ticketCount() }}</span>
            </dt>
            <dd>{{ entryFees() | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</dd>
          }
          @for (l of lines(); track l.id) {
            <dt>
              {{ l.name }}
              <span class="muted">{{ l.variant }} × {{ l.quantity }}</span>
            </dt>
            <dd>{{ l.total | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</dd>
          } @empty {
            <dt class="muted">{{ i18n.t('reg.cartEmpty') }}</dt>
            <dd></dd>
          }
          @if (flow.cart().donationZar; as d) {
            <dt>{{ i18n.t('basket.donation') }}</dt>
            <dd>{{ d | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</dd>
          }
          <dt class="is-total">{{ i18n.t('reg.grandTotal') }}</dt>
          <dd class="is-total">{{ total() | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</dd>
        </dl>
        <a class="btn btn--accent btn--block" routerLink="/mandjie">{{ i18n.t('shop.viewBasket') }}</a>
      </aside>
    </div>

    <!-- Native dialog: the top layer, the backdrop, Escape, the focus trap and focus return come free. -->
    <dialog #dlg class="sheet" (close)="active.set(null)" (click)="dismiss($event)">
      @if (active(); as p) {
        <div class="sheet__body">
          <button type="button" class="sheet__x" [attr.aria-label]="i18n.t('reg.close')"
                  (click)="close()">×</button>
          <vb-image [src]="p.imageUrl" [alt]="p.name" ratio="4 / 3" fit="contain" [label]="p.name" [eager]="true" />
          <h2>{{ p.name }}</h2>
          <p class="muted">{{ p.description }}</p>

          <ul class="variants">
            @for (v of p.variants; track v.id) {
              <li>
                <span class="variants__label">{{ v.label }}</span>
                <span class="variants__price">
                  {{ v.priceZar | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
                </span>
                @if (limit(v) === 0) {
                  <span class="chip chip--quiet variants__out">{{ i18n.t('shop.soldOut') }}</span>
                } @else {
                  <span class="stepper" role="group"
                        [attr.aria-label]="i18n.t('reg.qty') + ': ' + v.label">
                    <button type="button" class="stepper__btn" [attr.aria-label]="i18n.t('reg.fewer')"
                            [disabled]="!flow.productQuantity(v.id)" (click)="bump(v, -1)">−</button>
                    <output class="stepper__value">{{ flow.productQuantity(v.id) }}</output>
                    <button type="button" class="stepper__btn" [attr.aria-label]="i18n.t('reg.more')"
                            [disabled]="flow.productQuantity(v.id) >= limit(v)"
                            (click)="bump(v, 1)">+</button>
                  </span>
                }
                @if (v.trackStock && v.stock > 0 && v.stock <= 5) {
                  <small class="muted variants__left">{{ v.stock }} {{ i18n.t('shop.left') }}</small>
                }
              </li>
            }
          </ul>

          <button type="button" class="btn btn--primary btn--block" (click)="close()">
            {{ i18n.t('reg.pickDone') }}
          </button>
        </div>
      }
    </dialog>
  `,
  styles: `
    .split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 19rem);
      gap: var(--space-6);
      align-items: start;
      margin-bottom: var(--space-8);
    }

    @media (max-width: 720px) {
      .split { grid-template-columns: 1fr; }
    }

    /* 160px keeps two tiles per row on a 390px phone and four beside the cart on a laptop. */
    .products {
      grid-template-columns: repeat(auto-fill, minmax(min(160px, 100%), 1fr));
      gap: var(--space-4);
    }

    /* A whole card is the target, so it is a button. Reset what the button UA style imposes. */
    .product {
      display: flex;
      flex-direction: column;
      width: 100%;
      padding: var(--space-4);
      border: 0;
      font: inherit;
      color: inherit;
      text-align: left;
      cursor: pointer;
      transition: box-shadow var(--dur) var(--ease);
    }

    .product:hover,
    .product:focus-visible { box-shadow: var(--shadow-2); }

    .product h2 {
      overflow-wrap: anywhere;
      hyphens: auto;
      font-size: 1.0625rem;
      margin: var(--space-3) 0 var(--space-1);
    }

    .product__price {
      font-family: var(--font-display);
      font-size: 1.25rem;
      line-height: 1;
      margin: 0 0 var(--space-3);
      font-variant-numeric: tabular-nums;
    }

    .product__to {
      color: var(--ink-muted);
      font-family: var(--font-body, inherit);
      font-size: 0.875rem;
      padding-inline: 0.15em;
    }

    /* Baselines the chips across a row whose titles wrap to different depths. */
    .product .chip {
      align-self: start;
      margin-top: auto;
    }

    /* Stays in view while the grid scrolls: the running total is the reason to pick anything. */
    .cart {
      position: sticky;
      top: var(--space-6);
      padding: var(--space-6);
    }

    .cart h2 { font-size: 1.375rem; }

    .lines {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--space-3) 0;
      margin: var(--space-6) 0 var(--space-4);
      font-size: 0.9375rem;
    }

    .lines dt { padding-right: var(--space-4); }

    .lines dt .muted {
      display: block;
      font-size: 0.8125rem;
    }

    .lines dd {
      margin: 0;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .lines .is-total {
      padding-top: var(--space-3);
      border-top: 1px solid var(--rule);
      font-family: var(--font-display);
      font-size: 1.375rem;
      line-height: 1.1;
    }

    .sheet {
      width: min(30rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      padding: 0;
      border: 0;
      border-radius: var(--r-lg);
      background: var(--paper);
      color: var(--ink);
      box-shadow: var(--shadow-3);
      overflow: auto;
    }

    .sheet::backdrop { background: rgb(29 30 88 / 45%); }

    .sheet[open] { animation: sheet-in 180ms var(--ease); }

    @media (prefers-reduced-motion: reduce) {
      .sheet[open] { animation: none; }
    }

    @keyframes sheet-in {
      from {
        opacity: 0;
        transform: translateY(0.75rem);
      }
    }

    .sheet__body {
      position: relative;
      padding: var(--space-6);
    }

    .sheet__x {
      position: absolute;
      z-index: 1; /* vb-image is positioned too, and it comes later in the markup */
      top: var(--space-4);
      right: var(--space-4);
      width: 2.25rem;
      height: 2.25rem;
      border: 0;
      border-radius: var(--r-pill);
      background: var(--karoo-sand-light);
      box-shadow: inset 0 0 0 1px var(--field-line);
      color: var(--ink);
      font-size: 1.5rem;
      line-height: 1;
      cursor: pointer;
      transition: background-color var(--dur) var(--ease), color var(--dur) var(--ease);
    }

    .sheet__x:hover {
      background: var(--indigo);
      color: var(--paper);
    }

    .sheet h2 {
      font-size: 1.5rem;
      margin: var(--space-4) 0 var(--space-2);
    }

    .variants {
      list-style: none;
      margin: var(--space-6) 0;
      padding: 0;
    }

    .variants li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--space-1) var(--space-4);
      padding-block: var(--space-3);
    }

    .variants li + li { border-top: 1px solid var(--rule); }

    .variants__label {
      font-size: 0.9375rem;
      font-weight: 600;
    }

    .variants__price {
      grid-column: 1;
      font-family: var(--font-display);
      font-size: 1.25rem;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .stepper,
    .variants__out {
      grid-column: 2;
      grid-row: 1 / span 2;
    }

    .variants__left {
      grid-column: 1 / -1;
      font-size: 0.8125rem;
    }
  `,
})
export class ProductChooser {
  protected readonly i18n = inject(I18nService);
  protected readonly flow = inject(OrderFlowService);
  private readonly api = inject(ApiService);

  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly products = signal<Product[]>([]);
  protected readonly loaded = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly active = signal<Product | null>(null);
  private readonly tariffs = signal<Tariff[]>([]);

  protected readonly entryFees = computed(() => {
    const prices = new Map(this.tariffs().map((t) => [t.kind, t.amountZar]));
    return this.flow.cart().tickets.reduce((sum, t) => sum + (prices.get(t.tariffKind) ?? 0) * t.quantity, 0);
  });

  protected readonly lines = computed(() => {
    const variants = new Map(this.products().flatMap((p) => p.variants.map((v) => [v.id, { p, v }] as const)));
    return this.flow.cart().products.flatMap((row) => {
      const hit = variants.get(row.productVariantId);
      return hit
        ? [{ id: row.productVariantId, name: hit.p.name, variant: hit.v.label, quantity: row.quantity, total: hit.v.priceZar * row.quantity }]
        : [];
    });
  });

  protected readonly total = computed(
    () => this.entryFees() + this.lines().reduce((sum, l) => sum + l.total, 0) + this.flow.cart().donationZar,
  );

  constructor() {
    this.api.products().subscribe({
      // A product with no variant has nothing to price and nothing to add, so it is not on offer.
      next: (p) => {
        this.products.set(p.filter((x) => x.variants.length > 0));
        this.loaded.set(true);
      },
      error: () => {
        this.error.set(this.i18n.t('common.error'));
        this.loaded.set(true);
      },
    });
    this.api.tariffs().subscribe({ next: (t) => this.tariffs.set(t), error: () => {} });
  }

  protected low(p: Product) { return Math.min(...p.variants.map((v) => v.priceZar)); }
  protected high(p: Product) { return Math.max(...p.variants.map((v) => v.priceZar)); }
  protected chosen(p: Product) { return p.variants.reduce((n, v) => n + this.flow.productQuantity(v.id), 0); }
  protected soldOut(p: Product) { return p.variants.every((v) => this.limit(v) === 0); }

  /** Untracked stock makes no promise; tracked stock caps the picker and zero means sold out. */
  protected limit(v: ProductVariant) { return v.trackStock ? Math.min(MAX_QTY, Math.max(0, v.stock)) : MAX_QTY; }

  protected bump(v: ProductVariant, by: number) {
    this.flow.setProduct(v.id, Math.min(this.limit(v), Math.max(0, this.flow.productQuantity(v.id) + by)));
  }

  protected open(p: Product) {
    this.active.set(p);
    this.dlg().nativeElement.showModal();
  }

  protected close() { this.dlg().nativeElement.close(); }

  /** A click that lands on the dialog itself landed on the backdrop: the body fills the box. */
  protected dismiss(event: MouseEvent) {
    if (event.target === this.dlg().nativeElement) this.close();
  }
}
