import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RouteCategory, RouteCode, RouteDay } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';
import { ElevationProfile } from '../shared/elevation-profile';
import { ImageSlot } from '../shared/image-slot';
import { RouteMap } from '../shared/route-map';
import { Track, parseGpx } from '../shared/gpx';
import { DISCIPLINE_KEY, routeKey } from './routes-page';

/** The four 2026 categories are the only ones the brochure drew a per-day map for. */
const HAS_BROCHURE_MAP = new Set<string>(['ligdraf', 'vasbyt', 'ligtrap', 'vastrap']);

@Component({
  selector: 'vb-route-detail',
  standalone: true,
  imports: [DecimalPipe, RouterLink, ImageSlot, RouteMap, ElevationProfile],
  template: `
    @if (route(); as r) {
      <section class="section torn torn--to-sand">
        <div class="container">
          <a class="chip chip--quiet" routerLink="/roetes">{{ i18n.t('routes.all') }}</a>
          <p class="eyebrow">{{ i18n.t(disciplineKey[r.discipline]) }}</p>
          <h1>{{ i18n.t(key(r.code, 'name')) }}</h1>
          <p class="lead">{{ i18n.t(key(r.code, 'blurb')) }}</p>

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
              <a class="btn btn--accent" routerLink="/registreer">{{ i18n.t('home.cta') }}</a>
            } @else {
              <span class="chip chip--blue">{{ i18n.t('routes.openingSoon') }}</span>
            }
          </div>
        </div>
      </section>

      <section class="section section--sand torn torn--to-canvas">
        <div class="container">
          <h2>{{ i18n.t('routes.days') }}</h2>

          @for (d of r.days; track d.dayNumber) {
            <article class="card day">
              <div class="day__head">
                <h3>{{ i18n.t(dayKey(d.dayNumber)) }}</h3>
                <span class="chip chip--blue">
                  {{ i18n.t('routes.start') }} {{ d.startTimeLocal.slice(0, 5) }}
                </span>
                <span class="chip">{{ d.distanceKm | number: '1.0-1' }} km</span>
                <span class="chip">{{ d.elevationGainM | number: '1.0-0' }} m</span>
              </div>
              <p>{{ i18n.t(noteKey(r, d)) }}</p>
              @if (hasMap(r.code)) {
                <vb-image
                  [src]="'/roetes/' + r.code + '-dag' + d.dayNumber + '.webp'"
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

      @if (track(); as t) {
        <section class="section">
          <div class="container">
            <h2>{{ i18n.t('routes.map') }}</h2>
            <vb-route-map [track]="t" />
            <h2 class="elev-head">{{ i18n.t('routes.elevation') }}</h2>
            <vb-elevation-profile [track]="t" />
          </div>
        </section>
      }
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

    .elev-head {
      margin-top: var(--space-12);
    }
  `,
})
export class RouteDetail {
  protected readonly i18n = inject(I18nService);
  protected readonly route = signal<RouteCategory | null>(null);
  protected readonly track = signal<Track | null>(null);
  protected readonly message = signal('');
  protected readonly key = routeKey;
  protected readonly disciplineKey = DISCIPLINE_KEY;

  private api = inject(ApiService);

  constructor() {
    const params = inject(ActivatedRoute).params;
    this.message.set(this.i18n.t('common.loading'));

    params.subscribe((p) => {
      this.route.set(null);
      this.track.set(null);
      this.api.routes().subscribe({
        next: (all) => this.load(all.find((r) => r.code === p['code']) ?? null),
        error: () => this.message.set(this.i18n.t('common.error')),
      });
    });
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
    // Only ligdraf has a GPX today; everything else falls back to the brochure map images.
    if (!found.hasRoute) return;

    this.api.gpx(found.id).subscribe({
      next: (xml) => {
        try {
          this.track.set(parseGpx(xml));
        } catch {
          this.track.set(null);
        }
      },
      error: () => this.track.set(null),
    });
  }
}
