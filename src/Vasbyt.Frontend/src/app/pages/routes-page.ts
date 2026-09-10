import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RouteCategory, RouteCode } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';

/** The dictionary is flat and dotted, so a per-route key is a template literal, not a lookup table. */
export function routeKey(code: RouteCode, part: string): TranslationKey {
  return `routes.${code}.${part}` as TranslationKey;
}

export const DISCIPLINE_KEY = {
  Run: 'events.run',
  Walk: 'events.walk',
  Cycle: 'events.cycle',
} as const;

@Component({
  selector: 'vb-routes-page',
  standalone: true,
  imports: [DecimalPipe, RouterLink],
  template: `
    <section class="section torn torn--to-sand">
      <div class="container">
        <p class="eyebrow">{{ i18n.t('home.eyebrow') }}</p>
        <h1>{{ i18n.t('routes.title') }}</h1>
        <p class="lead">{{ i18n.t('routes.intro') }}</p>
      </div>
    </section>

    <section class="section section--sand torn torn--to-canvas">
      <div class="container">
        <div class="grid grid--2">
          @for (r of routes(); track r.code) {
            <article class="card route">
              <p class="chip chip--quiet">{{ i18n.t(disciplineKey[r.discipline]) }}</p>
              <h2>{{ i18n.t(key(r.code, 'name')) }}</h2>

              @if (r.isOpen) {
                <div class="route__figures">
                  <span class="badge">
                    <span class="badge__value">{{ r.totalDistanceKm | number: '1.0-1' }}</span>
                    <span class="badge__unit">km</span>
                  </span>
                  <span class="badge badge--sand">
                    <span class="badge__value">{{ r.elevationGainM | number: '1.0-0' }}</span>
                    <span class="badge__unit">m {{ i18n.t('routes.climb') }}</span>
                  </span>
                </div>
              } @else {
                <p class="chip chip--blue">{{ i18n.t('routes.openingSoon') }}</p>
              }

              <p class="route__blurb">{{ i18n.t(key(r.code, 'blurb')) }}</p>

              <p class="route__foot">
                <a class="btn btn--ghost" [routerLink]="['/roetes', r.code]">
                  {{ i18n.t('routes.view') }}
                </a>
                @if (r.difficulty) {
                  <span class="muted">{{ i18n.t('routes.difficulty') }}: {{ r.difficulty }}</span>
                }
              </p>
            </article>
          } @empty {
            <p class="muted">{{ i18n.t(failed() ? 'common.error' : 'common.loading') }}</p>
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    .route {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-4);
    }

    .route h2 {
      margin: 0;
      font-size: clamp(1.5rem, 3vw, 2rem);
    }

    /* Three digits and a decimal need a step down to sit inside the circle. */
    .route__figures .badge__value {
      font-size: 1.5rem;
    }

    .route__figures {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    .route__blurb {
      margin: 0;
      flex: 1;
    }

    .route__foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-4);
      margin: 0;
      font-size: 0.875rem;
    }
  `,
})
export class RoutesPage {
  protected readonly i18n = inject(I18nService);
  protected readonly routes = signal<RouteCategory[]>([]);
  protected readonly failed = signal(false);
  protected readonly key = routeKey;
  protected readonly disciplineKey = DISCIPLINE_KEY;

  constructor() {
    inject(ApiService)
      .routes()
      .subscribe({ next: (r) => this.routes.set(r), error: () => this.failed.set(true) });
  }
}
