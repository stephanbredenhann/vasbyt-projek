import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RouteCategory, RouteCode } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';
import { DisciplineIcon } from '../shared/discipline-icon';
import { DifficultyMeter } from '../shared/difficulty-meter';
import { RouteGlance } from '../shared/route-glance';
import { RouteSwitch, groupRoutes, runWalkChoice } from '../shared/route-switch';

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
  imports: [DecimalPipe, RouterLink, DisciplineIcon, DifficultyMeter, RouteGlance, RouteSwitch],
  template: `
    <section class="section page-hero torn torn--to-sand">
      <img class="page-hero__photo" src="/foto/hero-roetes.webp" alt="" fetchpriority="high" />
      <div class="container">
        <p class="eyebrow">{{ i18n.t('home.eyebrow') }}</p>
        <h1>{{ i18n.t('routes.title') }}</h1>
        <p class="lead">{{ i18n.t('routes.intro') }}</p>
      </div>
    </section>

    <section class="section section--sand torn torn--to-canvas">
      <div class="container">
        <div class="grid grid--4">
          @for (g of groups(); track g.run.code) {
            @let r = sel.shown(g);
            <article class="card card--event card--lift route" [attr.data-event]="r.code">
              <div class="route__discipline"><vb-discipline-icon [discipline]="r.discipline" /><span>{{ i18n.t(disciplineKey[r.discipline]) }}</span></div>
              <h2><a [routerLink]="['/roetes', r.code]">{{ r.name }}</a></h2>
              @if (g.walk) {
                <vb-route-switch [options]="[g.run, g.walk]" [value]="r.code" (pick)="sel.choose(g, $event)" />
              }

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

              <p class="route__foot card__foot">
                <a class="btn btn--ghost" [routerLink]="['/roetes', r.code]">
                  {{ i18n.t('routes.view') }}
                </a>
                @if (r.difficulty) {
                  <vb-difficulty-meter [difficulty]="r.difficulty" />
                }
              </p>

              @defer (on viewport) {
                <vb-route-glance class="route__glance" [route]="r" [zoomable]="false" />
              } @placeholder {
                <div class="route__glance skeleton glance-placeholder" aria-hidden="true"></div>
              }
            </article>
          } @empty {
            @if (failed()) {
              <p class="muted">{{ i18n.t('common.error') }}</p>
            } @else {
              <p class="visually-hidden">{{ i18n.t('common.loading') }}</p>
              @for (i of [1, 2, 3, 4]; track i) { <div class="card skeleton" aria-hidden="true"></div> }
            }
          }
        </div>
      </div>
    </section>
  `,
  styles: `
    .route__discipline { display: flex; align-items: center; gap: .75rem; font-weight: 600; color: var(--ev); }
    .route__glance { display: block; width: 100%; min-height: 1px; }
    .route {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-4);
    }

    .route h2 {
      margin: 0;
      color: var(--ev);
      font-size: clamp(1.5rem, 3vw, 2rem);
    }

    .route h2 a { color: inherit; text-decoration: none; }
    .route h2 a:hover { text-decoration: underline; }

    /* Three digits and a decimal need a step down to sit inside the circle. */
    .route__figures .badge__value {
      font-size: 1.5rem;
    }

    .route__figures {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    /* The blurb takes the slack, so map, stats and footer line up across a row. */
    .route__blurb {
      flex: 1;
      margin: 0;
    }

    .route__foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-4);
      margin: 0;
      font-size: 0.9375rem;
    }
  `,
})
export class RoutesPage {
  protected readonly i18n = inject(I18nService);
  protected readonly routes = signal<RouteCategory[]>([]);
  protected readonly failed = signal(false);
  protected readonly key = routeKey;
  protected readonly disciplineKey = DISCIPLINE_KEY;
  protected readonly groups = computed(() => groupRoutes(this.routes()));
  protected readonly sel = runWalkChoice();

  constructor() {
    inject(ApiService)
      .routes()
      .subscribe({ next: (r) => this.routes.set(r), error: () => this.failed.set(true) });
  }
}
