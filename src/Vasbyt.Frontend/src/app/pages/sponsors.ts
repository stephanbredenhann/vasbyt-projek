import { Component, inject, signal } from '@angular/core';
import { Advert } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { I18nService } from '../i18n/i18n.service';
import { ImageSlot } from '../shared/image-slot';

@Component({
  selector: 'vb-sponsors',
  standalone: true,
  imports: [ImageSlot],
  template: `
    <section class="section torn torn--to-sand">
      <div class="container">
        <p class="eyebrow">{{ i18n.t('home.eyebrow') }}</p>
        <h1>{{ i18n.t('sponsors.title') }}</h1>
        <p class="lead">{{ i18n.t('sponsors.intro') }}</p>
      </div>
    </section>

    <section class="section section--sand torn torn--to-canvas">
      <div class="container">
        @if (adverts().length) {
          <ul class="strip">
            @for (a of adverts(); track a.id) {
              <li class="card">
                <vb-image
                  class="logo"
                  [src]="a.imageUrl"
                  [alt]="a.name"
                  ratio="3 / 2"
                  fit="contain"
                  [label]="a.name"
                />
                <h2>{{ a.name }}</h2>
                @if (a.blurb) {
                  <p class="muted">{{ a.blurb }}</p>
                }
                @if (a.linkUrl) {
                  <a class="chip chip--quiet" [href]="a.linkUrl" rel="noopener">
                    {{ i18n.t('sponsors.visit') }}
                  </a>
                }
              </li>
            }
          </ul>
          <p class="thanks">{{ i18n.t('sponsors.thanks') }}</p>
        } @else {
          <p class="empty">{{ i18n.t('sponsors.empty') }}</p>
        }
      </div>
    </section>

    <section class="section">
      <div class="container">
        <article class="card card--accent become">
          <h2>{{ i18n.t('sponsors.becomeTitle') }}</h2>
          <p>{{ i18n.t('sponsors.becomeBody') }}</p>
          <p class="lines">
            <a [href]="'mailto:' + i18n.t('helpmekaar.email')">{{ i18n.t('helpmekaar.email') }}</a>
            <a [href]="'tel:' + i18n.t('helpmekaar.phone')">{{ i18n.t('helpmekaar.phone') }}</a>
          </p>
        </article>
      </div>
    </section>
  `,
  styles: `
    /* A logo is contained, never cropped, and the padded ground is the host, not the slot. */
    .logo {
      display: block;
      padding: var(--space-4);
      border-radius: var(--r-md);
      background: var(--karoo-sand-light);
      --slot-bg: transparent;
    }

    .strip {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
      gap: var(--space-6);
    }

    .strip .card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .strip .chip {
      margin-top: auto;
    }

    .strip .logo {
      align-self: stretch;
    }

    .strip h2 {
      font-size: 1.0625rem;
      letter-spacing: 0.06em;
      margin: var(--space-4) 0 var(--space-2);
    }

    .strip p {
      font-size: 0.9375rem;
    }

    .thanks {
      font-family: var(--font-display);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--indigo-deep);
      margin: var(--space-8) 0 0;
    }

    .empty {
      color: var(--ink-muted);
      text-align: center;
      padding-block: var(--space-16);
      margin: 0;
    }

    .become {
      max-width: 78ch;
    }

    .become h2 {
      font-size: 1.375rem;
    }

    .lines {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-6);
      margin: 0;
    }
  `,
})
export class Sponsors {
  protected readonly i18n = inject(I18nService);
  protected readonly adverts = signal<Advert[]>([]);

  constructor() {
    // The advert CMS is Wave 2: an empty list and a failed call land on the same empty state.
    inject(ApiService)
      .adverts('Sponsor')
      .subscribe({ next: (a) => this.adverts.set(a), error: () => this.adverts.set([]) });
  }
}
