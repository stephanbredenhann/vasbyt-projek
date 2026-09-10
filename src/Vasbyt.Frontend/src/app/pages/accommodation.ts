import { Component, inject, signal } from '@angular/core';
import { Advert } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { I18nService } from '../i18n/i18n.service';
import { ImageSlot } from '../shared/image-slot';

@Component({
  selector: 'vb-accommodation',
  standalone: true,
  imports: [ImageSlot],
  template: `
    <section class="section torn torn--to-sand">
      <div class="container">
        <p class="eyebrow">{{ i18n.t('home.eyebrow') }}</p>
        <h1>{{ i18n.t('stay.title') }}</h1>
        <p class="lead">{{ i18n.t('stay.intro') }}</p>
      </div>
    </section>

    <section class="section section--sand torn torn--to-canvas">
      <div class="container">
        @if (adverts().length) {
          <!-- Paid placements, so each one gets a photo, a description and its own booking link. -->
          <div class="listings">
            @for (a of adverts(); track a.id) {
              <article class="card listing">
                <vb-image
                  [src]="a.imageUrl"
                  [alt]="a.name"
                  ratio="4 / 3"
                  [label]="i18n.t('stay.title')"
                />
                <div class="listing__body">
                  <h2>{{ a.name }}</h2>
                  <p>{{ a.blurb }}</p>
                  <p class="listing__links">
                    @if (a.bookingUrl) {
                      <a class="btn btn--accent" [href]="a.bookingUrl" rel="noopener">
                        {{ i18n.t('stay.book') }}
                      </a>
                    }
                    @if (a.linkUrl) {
                      <a class="btn btn--ghost" [href]="a.linkUrl" rel="noopener">
                        {{ i18n.t('stay.website') }}
                      </a>
                    }
                    @if (a.phone) {
                      <a class="btn btn--ghost" [href]="'tel:' + a.phone">{{ a.phone }}</a>
                    }
                  </p>
                </div>
              </article>
            }
          </div>
        } @else {
          <p class="empty">{{ i18n.t('stay.empty') }}</p>
        }
      </div>
    </section>

    <section class="section">
      <div class="container">
        <article class="card card--accent advertise">
          <h2>{{ i18n.t('stay.advertise') }}</h2>
          <p>{{ i18n.t('stay.advertiseBody') }}</p>
          <p class="lines">
            <a [href]="'mailto:' + i18n.t('helpmekaar.email')">{{ i18n.t('helpmekaar.email') }}</a>
            <a [href]="'tel:' + i18n.t('helpmekaar.phone')">{{ i18n.t('helpmekaar.phone') }}</a>
          </p>
        </article>
      </div>
    </section>
  `,
  styles: `
    .listings {
      display: grid;
      gap: var(--space-6);
    }

    .listing {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr);
      gap: var(--space-8);
      align-items: center;
    }

    .listing h2 {
      font-size: clamp(1.375rem, 3vw, 1.75rem);
      margin-bottom: var(--space-3);
    }

    .listing__body {
      min-width: 0;
    }

    .listing__links {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin: 0;
    }

    .empty {
      color: var(--ink-muted);
      text-align: center;
      padding-block: var(--space-16);
      margin: 0;
    }

    .advertise {
      max-width: 78ch;
    }

    .advertise h2 {
      font-size: 1.375rem;
    }

    .lines {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-6);
      margin: 0;
    }

    @media (max-width: 719px) {
      .listing {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Accommodation {
  protected readonly i18n = inject(I18nService);
  protected readonly adverts = signal<Advert[]>([]);

  constructor() {
    // The advert CMS is Wave 2: an empty list and a failed call land on the same empty state.
    inject(ApiService)
      .adverts('Accommodation')
      .subscribe({ next: (a) => this.adverts.set(a), error: () => this.adverts.set([]) });
  }
}
