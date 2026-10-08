import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RouteCategory, RouteCode } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';
import { DisciplineIcon } from '../shared/discipline-icon';
import { DifficultyMeter } from '../shared/difficulty-meter';
import { RouteDialog } from '../shared/route-dialog';
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
  imports: [DecimalPipe, RouterLink, DisciplineIcon, DifficultyMeter, RouteGlance, RouteDialog, RouteSwitch],
  template: `
    <section class="section route-hero torn torn--to-sand">
      <div class="container">
        <p class="eyebrow">{{ i18n.t('home.eyebrow') }}</p>
        <h1>{{ i18n.t('routes.title') }}</h1>
        <p class="lead">{{ i18n.t('routes.intro') }}</p>
      </div>
    </section>

    <section class="section section--sand torn torn--to-canvas">
      <div class="container">
        <div class="grid grid--2">
          @for (g of groups(); track g.run.code) {
            @let r = sel.shown(g);
            <article class="card card--event card--lift route" [attr.data-event]="r.code">
              <div class="route__discipline"><vb-discipline-icon [discipline]="r.discipline" /><span>{{ i18n.t(disciplineKey[r.discipline]) }}</span></div>
              <h2>{{ r.name }}</h2>
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

              @defer (on viewport) {
                <vb-route-glance class="route__glance" [route]="r" (open)="dialog.open(r)" />
              } @placeholder {
                <div class="route__glance"></div>
              }

              <p class="route__foot card__foot">
                <a class="btn btn--ghost" [routerLink]="['/roetes', r.code]">
                  {{ i18n.t('routes.view') }}
                </a>
                @if (r.isOpen) {
                  <a class="btn btn--accent" routerLink="/registreer" [queryParams]="{ roete: r.code }">{{ i18n.t('home.cta') }}</a>
                }
                @if (r.difficulty) {
                  <vb-difficulty-meter [difficulty]="r.difficulty" />
                }
              </p>
            </article>
          } @empty {
            <p class="muted">{{ i18n.t(failed() ? 'common.error' : 'common.loading') }}</p>
          }
        </div>
      </div>
    </section>

    <vb-route-dialog #dialog />
  `,
  styles: `
    .route-hero { background: url('/foto/fietsryers-sonsondergang.webp') center 55% / cover; isolation: isolate; min-height: 360px; display: flex; align-items: center; }
    .route-hero::before { content: ''; position: absolute; inset: 0; background: linear-gradient(100deg, rgb(28 74 78 / 82%), rgb(29 42 74 / 45%)); z-index: -1; }
    .route-hero h1, .route-hero .lead, .route-hero .eyebrow { color: white; }
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
    }

    .route__foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-4);
      margin: auto 0 0;
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
  protected readonly groups = computed(() => groupRoutes(this.routes()));
  protected readonly sel = runWalkChoice();

  constructor() {
    inject(ApiService)
      .routes()
      .subscribe({ next: (r) => this.routes.set(r), error: () => this.failed.set(true) });
  }
}
