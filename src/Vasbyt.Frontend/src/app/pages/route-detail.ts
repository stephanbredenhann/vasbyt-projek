import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Discipline, RouteCategory, RouteCode, RouteDay } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';
import { ElevationProfile } from '../shared/elevation-profile';
import { ImageSlot } from '../shared/image-slot';
import { RouteMap } from '../shared/route-map';
import { RouteSwitch } from '../shared/route-switch';
import { Track } from '../shared/gpx';
import { DISCIPLINE_KEY, routeKey } from './routes-page';

/** The four 2026 categories are the only ones the brochure drew a per-day map for. */
const HAS_BROCHURE_MAP = new Set<string>(['ligdraf', 'vasbyt', 'ligtrap', 'vastrap']);

/** One photo per discipline, none of them used elsewhere on the site. */
const HERO_PHOTO: Record<Discipline, string> = {
  Cycle: '/foto/fietsryer-pad.webp',
  Run: '/foto/hardlopers-grondpad.webp',
  Walk: '/foto/deelnemers-monument.webp',
};

/** One day's map and height profile; hovering the profile moves a marker along the map. */
@Component({
  selector: 'vb-route-day-map',
  standalone: true,
  imports: [RouteMap, ElevationProfile],
  template: `
    @if (track(); as t) {
      <vb-route-map [track]="t" [markerKm]="hoverKm()" />
      <p class="hint">{{ i18n.t('routes.mapHint') }}</p>
      <vb-elevation-profile [track]="t" (hoverKm)="hoverKm.set($event)" />
      <p class="dl"><a class="btn btn--ghost" [href]="api.dayGpxUrl(code(), day())"
         [attr.download]="code() + '-dag' + day() + '.gpx'">{{ i18n.t('routes.downloadGpx') }}</a></p>
    } @else {
      <p class="muted">{{ i18n.t(loaded() ? 'routes.noGpx' : 'common.loading') }}</p>
    }
  `,
  styles: `
    :host { display: block; margin-top: var(--space-6); }
    .hint { font-size: .8125rem; color: var(--ink-muted); margin: var(--space-2) 0 var(--space-4); }
    .dl { margin: var(--space-4) 0 0; }
  `,
})
export class RouteDayMap {
  readonly code = input.required<RouteCode>();
  readonly day = input.required<number>();
  protected readonly i18n = inject(I18nService);
  protected readonly api = inject(ApiService);
  protected readonly track = signal<Track | null>(null);
  protected readonly loaded = signal(false);
  protected readonly hoverKm = signal<number | null>(null);

  constructor() {
    effect(() => {
      this.api.dayTrack(this.code(), this.day()).then((t) => {
        this.track.set(t);
        this.loaded.set(true);
      });
    });
  }
}

@Component({
  selector: 'vb-route-detail',
  standalone: true,
  imports: [DecimalPipe, RouterLink, ImageSlot, RouteDayMap, RouteSwitch],
  template: `
    @if (route(); as r) {
      <section class="section torn torn--to-sand detail-hero" [attr.data-event]="r.code"
               [style.--photo]="'url(' + heroPhoto[r.discipline] + ')'">
        <div class="container">
          <a class="chip" routerLink="/roetes">{{ i18n.t('routes.all') }}</a>
          <p class="eyebrow">{{ i18n.t(disciplineKey[r.discipline]) }}</p>
          <h1>{{ i18n.t(key(r.code, 'name')) }}</h1>
          <p class="lead">{{ i18n.t(key(r.code, 'blurb')) }}</p>
          @if (pair(); as p) {
            <vb-route-switch [options]="p" [value]="r.code" (pick)="go($event)" />
          }

          <div class="figures">
            @if (r.isOpen) {
              <span class="badge">
                <span class="badge__value">{{ r.totalDistanceKm | number: '1.0-1' }}</span>
                <span class="badge__unit">km</span>
              </span>
              <span class="badge badge--sand">
                <span class="badge__value">{{ r.elevationGainM | number: '1.0-0' }}</span>
                <span class="badge__unit">m {{ i18n.t('routes.climb') }}</span>
              </span>
              @if (r.difficulty) {
                <span class="chip chip--blue">{{ r.difficulty }}</span>
              }
              <a class="btn btn--accent" routerLink="/registreer" [queryParams]="{ roete: r.code }">{{ i18n.t('home.cta') }}</a>
            } @else {
              <span class="chip chip--blue">{{ i18n.t('routes.openingSoon') }}</span>
            }
          </div>
        </div>
      </section>

      <section class="section section--sand torn torn--to-canvas" [attr.data-event]="r.code">
        <div class="container">
          <h2>{{ i18n.t('routes.days') }}</h2>

          @for (d of r.days; track d.dayNumber) {
            <article class="card card--event day">
              <div class="day__head">
                <h3>{{ i18n.t(dayKey(d.dayNumber)) }}</h3>
                <span class="chip chip--blue">
                  {{ i18n.t('routes.start') }} {{ d.startTimeLocal.slice(0, 5) }}
                </span>
                <span class="chip">{{ d.distanceKm | number: '1.0-1' }} km</span>
                <span class="chip">{{ d.elevationGainM | number: '1.0-0' }} m</span>
              </div>
              <p>{{ i18n.t(noteKey(r, d)) }}</p>
              @if (d.hasRoute) {
                @defer (on viewport) {
                  <vb-route-day-map [code]="r.code" [day]="d.dayNumber" />
                } @placeholder {
                  <div class="day__map-ph"></div>
                }
              } @else if (hasMap(r.sharesRouteWithCode ?? r.code)) {
                <vb-image
                  [src]="'/roetes/' + (r.sharesRouteWithCode ?? r.code) + '-dag' + d.dayNumber + '.webp'"
                  [alt]="i18n.t('routes.brochureMap')"
                  ratio="16 / 9"
                />
              }
            </article>
          } @empty {
            <p class="muted">{{ i18n.t('routes.tbc') }}</p>
          }

          <p class="muted water">
            <strong>{{ i18n.t('routes.waterPoints') }}:</strong> {{ i18n.t('terms.t2') }}
          </p>
        </div>
      </section>

    } @else {
      <section class="section">
        <div class="container">
          <p class="muted">{{ message() }}</p>
        </div>
      </section>
    }
  `,
  styles: `
    .figures {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-4);
      margin-top: var(--space-6);
    }

    .day + .day {
      margin-top: var(--space-6);
    }

    .day__head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }

    .day__head h3 {
      margin: 0;
      margin-right: auto;
    }

    .day vb-image {
      display: block;
      margin-top: var(--space-6);
    }

    .water {
      margin: var(--space-8) 0 0;
      font-size: 0.9375rem;
    }

    .detail-hero { background: var(--photo) center 45% / cover; isolation: isolate; }
    .detail-hero::before {
      content: ''; position: absolute; inset: 0; z-index: -1;
      background: linear-gradient(100deg, color-mix(in srgb, var(--ev) 88%, black) 0%, color-mix(in srgb, var(--dusk) 60%, transparent) 100%);
    }
    .detail-hero h1, .detail-hero .lead, .detail-hero .eyebrow { color: var(--paper); }
    .detail-hero .badge:not(.badge--sand) { background: var(--paper); color: var(--ev); }

    .day__head h3 { color: var(--ev); }
    .day__map-ph { min-height: 320px; margin-top: var(--space-6); border-radius: var(--r-md); background: var(--karoo-sand-light); }
  `,
})
export class RouteDetail {
  protected readonly i18n = inject(I18nService);
  protected readonly route = signal<RouteCategory | null>(null);
  protected readonly heroPhoto = HERO_PHOTO;
  protected readonly message = signal('');
  protected readonly key = routeKey;
  protected readonly disciplineKey = DISCIPLINE_KEY;

  protected readonly pair = signal<RouteCategory[] | null>(null);

  private api = inject(ApiService);
  private router = inject(Router);
  private all: RouteCategory[] = [];

  constructor() {
    const params = inject(ActivatedRoute).params;
    this.message.set(this.i18n.t('common.loading'));

    params.subscribe((p) => {
      // Switching within a pair reuses the loaded list, so the radio keeps focus and nothing flashes.
      const known = this.all.find((r) => r.code === p['code']);
      if (known && this.pair()?.some((r) => r.code === known.code)) {
        this.route.set(known);
        return;
      }
      this.route.set(null);
      this.api.routes().subscribe({
        next: (all) => {
          this.all = all;
          const found = all.find((r) => r.code === p['code']) ?? null;
          const run = found?.sharesRouteWithCode ? all.find((r) => r.code === found.sharesRouteWithCode) : found;
          const walk = all.find((r) => r.sharesRouteWithCode === run?.code);
          this.pair.set(run && walk ? [run, walk] : null);
          this.load(found);
        },
        error: () => this.message.set(this.i18n.t('common.error')),
      });
    });
  }

  protected go(code: RouteCode) {
    this.router.navigate(['/roetes', code], { replaceUrl: true });
  }

  protected hasMap(code: RouteCode) {
    return HAS_BROCHURE_MAP.has(code);
  }

  protected dayKey(dayNumber: number): TranslationKey {
    return `routes.day${dayNumber}` as TranslationKey;
  }

  /** The brochure prints one note per day per discipline, with Vastrap's day two the exception. */
  protected noteKey(r: RouteCategory, d: RouteDay): TranslationKey {
    if (d.dayNumber === 2 && r.code === 'vastrap') return 'routes.noteDay2Vastrap';
    const leg = r.discipline === 'Cycle' ? 'Cycle' : 'Foot';
    return `routes.noteDay${d.dayNumber}${leg}` as TranslationKey;
  }

  private load(found: RouteCategory | null) {
    this.route.set(found);
    if (!found) {
      this.message.set(this.i18n.t('routes.notFound'));
      return;
    }
  }
}
