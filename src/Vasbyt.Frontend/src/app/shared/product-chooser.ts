import { CurrencyPipe } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product, ProductVariant, Tariff } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { ImageSlot } from './image-slot';

/** Tracked stock caps a pick at what is left; untracked stock makes no promise, so the order cap applies. */
export function maxQuantity(v: ProductVariant) { return v.trackStock ? Math.max(0, v.stock) : 20; }

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
        @if (loaded() && !error() && !offered().length) {
          <p class="alert">{{ i18n.t('shop.empty') }}</p>
        }

        <div class="grid products">
          @for (p of offered(); track p.id) {
            @if (single(p); as v) {
              <!-- One thing to pick: add it straight from the card. The photo and name still open the
                   dialog, which is where the description and the other photos are. -->
              <article class="card product">
                <button type="button" class="product__open" (click)="open(p)"
                        [attr.aria-label]="i18n.t('shop.details') + ': ' + p.name">
                  <span class="product__media">
                    <vb-image [src]="p.imageUrl" [alt]="p.name" ratio="4 / 3" [label]="p.name" />
                    @if (photosOf(p).length > 1) {
                      <span class="chip product__count">{{ photosOf(p).length }} {{ i18n.t('shop.photos') }}</span>
                    }
                  </span>
                  <h2>{{ p.name }}</h2>
                </button>
                <span class="product__row">
                  <span class="product__price">
                    {{ v.priceZar | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
                    @if (v.label) { <span class="product__to">{{ v.label }}</span> }
                  </span>
                  @if (soldOut(v)) {
                    <span class="btn btn--ghost sold-out">{{ i18n.t('shop.soldOut') }}</span>
                  } @else if (flow.productQuantity(v.id)) {
                    <span class="stepper" role="group" [attr.aria-label]="i18n.t('reg.qty') + ': ' + p.name">
                      <button type="button" class="stepper__btn" [attr.aria-label]="i18n.t('reg.fewer')" (click)="bump(p, v, -1)">−</button>
                      <output class="stepper__value">{{ flow.productQuantity(v.id) }}</output>
                      <button type="button" class="stepper__btn" [attr.aria-label]="i18n.t('reg.more')"
                              [disabled]="flow.productQuantity(v.id) >= limit(v)" (click)="bump(p, v, 1)">+</button>
                    </span>
                  } @else {
                    <button type="button" class="btn btn--ghost product__add" (click)="bump(p, v, 1)">{{ i18n.t('shop.add') }}</button>
                  }
                </span>
                @if (v.trackStock && v.stock > 0 && v.stock <= 5) {
                  <small class="muted">{{ v.stock }} {{ i18n.t('shop.left') }}</small>
                }
              </article>
            } @else {
              <button type="button" class="card product product--pick" (click)="open(p)">
                <span class="product__media">
                  <vb-image [src]="p.imageUrl" [alt]="p.name" ratio="4 / 3" [label]="p.name" />
                  @if (photosOf(p).length > 1) {
                    <span class="chip product__count">{{ photosOf(p).length }} {{ i18n.t('shop.photos') }}</span>
                  }
                </span>
                <h2>{{ p.name }}</h2>
                <span class="product__row">
                  <span class="product__price">
                    {{ low(p) | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
                    @if (high(p) > low(p)) {
                      <span class="product__to">{{ i18n.t('shop.to') }}</span>
                      {{ high(p) | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
                    }
                  </span>
                  @if (!availableVariants(p).length) {
                    <span class="btn btn--ghost sold-out">{{ i18n.t('shop.soldOut') }}</span>
                  } @else if (chosen(p); as n) {
                    <span class="btn btn--primary product__cta">{{ i18n.t('shop.inBasket') }} × {{ n }}</span>
                  } @else {
                    <span class="btn btn--ghost product__cta">{{ i18n.t('reg.pick') }}</span>
                  }
                </span>
              </button>
            }
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
              @if (l.soldOut) {
                <span class="chip chip--quiet">{{ i18n.t('shop.soldOut') }}</span>
              }
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
    <dialog #dlg class="sheet" (close)="active.set(null)" (click)="dismiss($event)"
            (keydown.arrowleft)="step(-1)" (keydown.arrowright)="step(1)">
      @if (active(); as p) {
        @let shots = photosOf(p);
        <div class="sheet__body">
          <button type="button" class="sheet__x" [attr.aria-label]="i18n.t('reg.close')"
                  (click)="close()">×</button>
          <div class="gallery" (touchstart)="swipeFrom = $event.changedTouches[0].clientX"
               (touchend)="swiped($event.changedTouches[0].clientX)">
            <vb-image [src]="shots[photo()]" [alt]="p.name" ratio="4 / 3" [label]="p.name" [eager]="true" />
            @if (shots.length > 1) {
              <button type="button" class="gallery__nav gallery__nav--prev" [attr.aria-label]="i18n.t('shop.photoPrev')"
                      (click)="step(-1)">‹</button>
              <button type="button" class="gallery__nav gallery__nav--next" [attr.aria-label]="i18n.t('shop.photoNext')"
                      (click)="step(1)">›</button>
              <span class="chip gallery__count" aria-live="polite">{{ photo() + 1 }} / {{ shots.length }}</span>
            }
          </div>
          @if (shots.length > 1) {
            <div class="thumbs">
              @for (src of shots; track src; let i = $index) {
                <button type="button" class="thumb" [class.is-on]="i === photo()" [attr.aria-current]="i === photo() || null"
                        [attr.aria-label]="i18n.t('shop.photo') + ' ' + (i + 1) + ' ' + i18n.t('shop.photoOf') + ' ' + shots.length"
                        (click)="photo.set(i)">
                  <img [src]="src" alt="" loading="lazy" decoding="async" />
                </button>
              }
            </div>
          }
          <h2>{{ p.name }}</h2>
          <p class="muted">{{ p.description }}</p>

          <ul class="variants">
            @for (v of p.variants; track v.id) {
              <li>
                <span class="variants__label">{{ v.label }}</span>
                <span class="variants__price">
                  {{ v.priceZar | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
                </span>
                @if (soldOut(v)) {
                  <span class="btn btn--ghost sold-out">{{ i18n.t('shop.soldOut') }}</span>
                } @else {
                <span class="stepper" role="group"
                      [attr.aria-label]="i18n.t('reg.qty') + ': ' + v.label">
                  <button type="button" class="stepper__btn" [attr.aria-label]="i18n.t('reg.fewer')"
                          [disabled]="!flow.productQuantity(v.id)" (click)="bump(p, v, -1)">−</button>
                  <output class="stepper__value">{{ flow.productQuantity(v.id) }}</output>
                  <button type="button" class="stepper__btn" [attr.aria-label]="i18n.t('reg.more')"
                          [disabled]="flow.productQuantity(v.id) >= limit(v)"
                          (click)="bump(p, v, 1)">+</button>
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

    /* Two tiles per row from a 480px phone, two or three beside the cart on a laptop. */
    .products {
      grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
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
      transition: box-shadow var(--dur-ui) var(--ease-out);
    }

    .product--pick { cursor: pointer; }

    .product--pick:hover,
    .product--pick:focus-visible,
    .product:has(.product__open:hover),
    .product:has(.product__open:focus-visible) { box-shadow: var(--shadow-2); }

    /* Looks like the card it sits in; only the pointer and the focus ring say it opens. */
    .product__open {
      display: flex;
      flex-direction: column;
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }

    .product__media {
      position: relative;
      display: block;
    }

    .product__count {
      position: absolute;
      z-index: 1; /* vb-image is positioned too */
      left: var(--space-2);
      bottom: var(--space-2);
      pointer-events: none;
    }

    .product h2 {
      overflow-wrap: anywhere;
      hyphens: auto;
      font-size: 1.1875rem;
      margin: var(--space-3) 0 var(--space-1);
    }

    .product__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      flex-wrap: wrap;
      margin-top: auto;
      padding-top: var(--space-3);
    }

    .product__price {
      font-family: var(--font-display);
      font-size: 1.375rem;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }

    .product__cta { pointer-events: none; min-height: var(--touch); padding-inline: var(--space-4); }
    .product__add { min-height: var(--touch); padding-inline: var(--space-4); }

    /* Sits where the add button would, in the same pill, but is not a control. */
    .sold-out {
      min-height: var(--touch);
      padding-inline: var(--space-4);
      color: var(--danger);
      cursor: default;
      pointer-events: none;
    }

    .product__to {
      color: var(--ink-muted);
      font-family: var(--font-body, inherit);
      font-size: 0.9375rem;
      padding-inline: 0.15em;
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
      font-size: 0.9375rem;
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
      overflow: hidden; /* the body scrolls, so the scrollbar sits inside the rounded corners */
    }

    .sheet::backdrop { background: rgb(29 30 88 / 45%); }

    .sheet[open] { animation: sheet-in var(--dur-panel) var(--ease-out); }

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
      max-height: calc(100dvh - 2rem);
      overflow: auto;
      scrollbar-width: thin;
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
      transition: background-color var(--dur-ui) var(--ease-out), color var(--dur-ui) var(--ease-out);
    }

    .sheet__x:hover {
      background: var(--indigo);
      color: var(--paper);
    }

    .gallery {
      position: relative;
      touch-action: pan-y;
    }

    .gallery__nav {
      position: absolute;
      z-index: 1;
      top: 50%;
      translate: 0 -50%;
      width: var(--touch);
      height: var(--touch);
      border: 0;
      border-radius: var(--r-pill);
      background: var(--paper);
      box-shadow: var(--shadow-2);
      color: var(--ink);
      font-size: 1.75rem;
      line-height: 1;
      cursor: pointer;
      transition: background-color var(--dur-ui) var(--ease-out), color var(--dur-ui) var(--ease-out);
    }

    .gallery__nav:hover {
      background: var(--indigo);
      color: var(--paper);
    }

    .gallery__nav--prev { left: var(--space-2); }
    .gallery__nav--next { right: var(--space-2); }

    .gallery__count {
      position: absolute;
      z-index: 1;
      left: var(--space-2);
      bottom: var(--space-2);
      font-variant-numeric: tabular-nums;
    }

    .thumbs {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-3);
      overflow-x: auto;
      padding: 4px; /* room for the outline */
      scrollbar-width: thin;
    }

    .thumb {
      flex: none;
      width: 4rem;
      aspect-ratio: 4 / 3;
      padding: 0;
      border: 0;
      border-radius: var(--r-xs);
      overflow: hidden;
      background: var(--karoo-sand);
      opacity: 0.6;
      cursor: pointer;
      transition: opacity var(--dur-ui) var(--ease-out);
    }

    .thumb img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .thumb:hover { opacity: 0.85; }
    /* An outline, not an inset shadow: the photo would paint over a shadow. */
    .thumb.is-on {
      opacity: 1;
      outline: 2px solid var(--indigo);
      outline-offset: 2px;
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

    .stepper, .variants .sold-out {
      grid-column: 2;
      grid-row: 1 / span 2;
    }

    .variants__left {
      grid-column: 1 / -1;
      font-size: 0.9375rem;
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
  /** Which of the open product's photos is showing. */
  protected readonly photo = signal(0);
  protected swipeFrom = 0;
  private readonly tariffs = signal<Tariff[]>([]);

  protected readonly entryFees = computed(() => {
    const prices = new Map(this.tariffs().map((t) => [t.kind, t.amountZar]));
    return this.flow.cart().tickets.reduce((sum, t) => sum + (prices.get(t.tariffKind) ?? 0) * t.quantity, 0);
  });

  /** Every product, sold out or not: a sold-out one shows as such instead of disappearing. */
  protected readonly offered = this.products;

  protected readonly lines = computed(() => {
    const variants = new Map(this.products().flatMap((p) => p.variants.map((v) => [v.id, { p, v }] as const)));
    return this.flow.cart().products.flatMap((row) => {
      const hit = variants.get(row.productVariantId);
      return hit && !this.soldOut(hit.v)
        ? [{ id: row.productVariantId, name: hit.p.name, variant: hit.v.label, quantity: row.quantity, total: hit.v.priceZar * row.quantity, soldOut: false }]
        // A sold-out or withdrawn variant stays as a line, marked unavailable at no cost.
        : this.loaded() ? [{ id: row.productVariantId, name: row.name ?? '', variant: row.variant ?? '', quantity: row.quantity, total: 0, soldOut: true }] : [];
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

  protected low(p: Product) { return Math.min(...this.priced(p).map((v) => v.priceZar)); }
  protected high(p: Product) { return Math.max(...this.priced(p).map((v) => v.priceZar)); }
  /** The price range of what is left, or of everything once it has all sold out. */
  private priced(p: Product) { const v = this.availableVariants(p); return v.length ? v : p.variants; }
  protected chosen(p: Product) { return p.variants.reduce((n, v) => n + this.flow.productQuantity(v.id), 0); }
  protected soldOut(v: ProductVariant) { return v.trackStock && v.stock <= 0; }
  protected availableVariants(p: Product) { return p.variants.filter((v) => !this.soldOut(v)); }
  /** The product's only variant, or null when the buyer has a choice to make. */
  protected single(p: Product) { return p.variants.length === 1 ? p.variants[0] : null; }

  protected limit(v: ProductVariant) { return maxQuantity(v); }

  protected bump(p: Product, v: ProductVariant, by: number) {
    this.flow.setProduct(v.id, Math.min(this.limit(v), Math.max(0, this.flow.productQuantity(v.id) + by)), { name: p.name, variant: v.label });
  }

  /** The cover first, then the rest. Only the cover ever shows on a card. */
  protected photosOf(p: Product) {
    return [p.imageUrl, ...(p.galleryUrls ?? [])].filter((u): u is string => !!u);
  }

  /** Wraps round, so the last photo's next is the first. */
  protected step(by: number) {
    const p = this.active();
    const n = p ? this.photosOf(p).length : 0;
    if (n > 1) this.photo.update((i) => (i + by + n) % n);
  }

  protected swiped(to: number) {
    const dx = to - this.swipeFrom;
    if (Math.abs(dx) > 40) this.step(dx < 0 ? 1 : -1);
  }

  protected open(p: Product) {
    this.photo.set(0);
    this.active.set(p);
    this.dlg().nativeElement.showModal();
  }

  protected close() { this.dlg().nativeElement.close(); }

  /** A click that lands on the dialog itself landed on the backdrop: the body fills the box. */
  protected dismiss(event: MouseEvent) {
    if (event.target === this.dlg().nativeElement) this.close();
  }
}
