import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProvinceCount, VasbytEvent } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { I18nService } from '../i18n/i18n.service';
import { ImageSlot } from '../shared/image-slot';
import { ProvinceMap } from '../shared/province-map';

@Component({
  selector: 'vb-home',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, DatePipe, DecimalPipe, ProvinceMap, ImageSlot],
  template: `
    <section class="hero">
      <div class="container hero__inner">
        <div>
          <p class="eyebrow">{{ i18n.t('home.eyebrow') }}</p>
          <h1>{{ i18n.t('home.title') }}</h1>
          <p class="hero__sub">{{ i18n.t('home.subtitle') }}</p>
          <p class="lead">{{ i18n.t('home.intro') }}</p>
          <a class="btn btn--accent btn--lg" routerLink="/registreer">{{ i18n.t('nav.register') }}</a>
        </div>
        <!-- Drop the hero photograph in here once the images arrive. -->
        <vb-image ratio="4 / 3" label="Hero" />
      </div>
    </section>

    <section class="section">
      <div class="container">
        <h2>{{ i18n.t('home.events') }}</h2>
        <div class="grid grid--2">
          @for (e of events(); track e.id) {
            <article class="card">
              <vb-image ratio="16 / 9" [label]="e.name" />
              <p class="eyebrow">
                {{ i18n.t(e.discipline === 'Run' ? 'events.run' : 'events.cycle') }}
              </p>
              <h3>{{ e.name }}</h3>
              <p class="muted">{{ e.startDateUtc | date: 'd MMMM y' : undefined : i18n.locale() }}</p>
              <p>{{ e.blurb }}</p>
              <p class="fee">
                {{ fee() | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}
                <span class="muted">{{ i18n.t('reg.perEntrant') }}</span>
              </p>
              <ul class="distances">
                @for (d of e.distances; track d.id) {
                  <li>
                    <span>{{ d.name }}</span>
                    <span class="muted">
                      {{ d.distanceKm | number: '1.0-0' }} km · {{ d.elevationGainM | number }} m
                    </span>
                  </li>
                }
              </ul>
              <a class="btn btn--ghost" routerLink="/roetes">{{ i18n.t('nav.routes') }}</a>
            </article>
          }
        </div>
      </div>
    </section>

    <section class="section section--sand">
      <div class="container">
        <h2>{{ i18n.t('home.map') }}</h2>
        <p class="lead">{{ i18n.t('home.mapIntro') }}</p>
        <vb-province-map [counts]="counts()" />
      </div>
    </section>

    <section class="section">
      <div class="container donate-cta">
        <div>
          <h2>{{ i18n.t('home.donateTitle') }}</h2>
          <p class="lead">{{ i18n.t('home.donateBody') }}</p>
          <a class="btn btn--primary" routerLink="/skenk">{{ i18n.t('nav.donate') }}</a>
        </div>
        <vb-image ratio="1 / 1" label="Helpmekaar" />
      </div>
    </section>
  `,
  styles: `
    .hero {
      background: var(--karoo-sand-light);
      border-bottom: var(--border);
      padding-block: var(--space-16);
    }

    .hero__inner,
    .donate-cta {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      gap: var(--space-12);
      align-items: center;
    }

    @media (max-width: 800px) {
      .hero__inner,
      .donate-cta {
        grid-template-columns: 1fr;
      }
    }

    .hero__sub {
      font-family: var(--font-display);
      font-size: 1.375rem;
      color: var(--karoo-clay);
      margin-bottom: var(--space-6);
    }

    .card vb-image {
      display: block;
      margin: calc(var(--space-6) * -1) calc(var(--space-6) * -1) var(--space-6);
    }

    .fee {
      font-family: var(--font-display);
      font-size: 1.25rem;
      margin-bottom: var(--space-4);
    }

    .distances {
      list-style: none;
      margin: 0 0 var(--space-6);
      padding: 0;
      font-size: 0.9375rem;
    }

    .distances li {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-4);
      padding: var(--space-2) 0;
      border-bottom: var(--border);
    }
  `,
})
export class Home {
  protected readonly i18n = inject(I18nService);
  protected readonly events = signal<VasbytEvent[]>([]);
  protected readonly counts = signal<ProvinceCount[]>([]);
  protected readonly fee = signal(0);

  constructor() {
    const api = inject(ApiService);
    api.events().subscribe((e) => this.events.set(e));
    api.registrationsByProvince().subscribe((c) => this.counts.set(c));
    api.config().subscribe((c) => this.fee.set(c.entryFeeZar));
  }
}
