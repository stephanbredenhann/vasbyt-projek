import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { I18nService } from '../i18n/i18n.service';
import { ImageSlot } from '../shared/image-slot';

@Component({
  selector: 'vb-shop',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, ImageSlot],
  template: `
    <section class="section torn torn--to-sand">
      <div class="container">
        <p class="eyebrow">{{ i18n.t('home.eyebrow') }}</p>
        <h1>{{ i18n.t('shop.title') }}</h1>
        <p class="lead">{{ i18n.t('shop.intro') }}</p>
        <p class="muted">{{ i18n.t('shop.collectNote') }}</p>
      </div>
    </section>

    <section class="section section--sand torn torn--to-canvas">
      <div class="container">
        @if (products().length) {
          <div class="grid products">
            @for (p of products(); track p.id) {
              <article class="card product">
                <vb-image [src]="p.imageUrl" [alt]="p.name" ratio="1 / 1" [label]="p.name" />
                <h2>{{ p.name }}</h2>
                <p>{{ p.description }}</p>

                <ul class="variants">
                  @for (v of p.variants; track v.id) {
                    <li>
                      <span>{{ v.label }}</span>
                      <span class="variants__price">
                        {{ v.priceZar | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
                      </span>
                    </li>
                  }
                </ul>
              </article>
            }
          </div>

          <!-- The cart lives in the entry flow, so the shop points at it rather than owning one. -->
          <div class="card card--accent order">
            <p>{{ i18n.t('shop.buyVia') }}</p>
            <a class="btn btn--accent" routerLink="/registreer">{{ i18n.t('shop.addToOrder') }}</a>
          </div>
        } @else {
          <p class="empty">{{ i18n.t('shop.empty') }}</p>
        }
      </div>
    </section>
  `,
  styles: `
    .products {
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    }

    /* Thumbnail, not a hero: the range is browsed at a glance, then bought in the entry flow. */
    .product vb-image {
      display: block;
      max-width: 7.5rem;
    }

    .product h2 {
      font-size: 1.125rem;
      margin: var(--space-4) 0 var(--space-2);
    }

    .product p {
      font-size: 0.9375rem;
    }

    .variants {
      list-style: none;
      margin: var(--space-4) 0 0;
      padding: 0;
      font-size: 0.9375rem;
    }

    .variants li {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding-block: var(--space-2);
    }

    .variants li + li {
      border-top: 1px solid var(--rule);
    }

    .variants__price {
      margin-left: auto;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .order {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-6);
      margin-top: var(--space-8);
    }

    .order p {
      margin: 0;
    }

    .empty {
      color: var(--ink-muted);
      text-align: center;
      padding-block: var(--space-16);
      margin: 0;
    }
  `,
})
export class Shop {
  protected readonly i18n = inject(I18nService);
  protected readonly products = signal<Product[]>([]);

  constructor() {
    // The product CMS is Wave 2: an empty list and a failed call land on the same empty state.
    inject(ApiService)
      .products()
      .subscribe({ next: (p) => this.products.set(p), error: () => this.products.set([]) });
  }
}
