import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Distance, VasbytEvent } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { I18nService } from '../i18n/i18n.service';
import { ElevationProfile } from '../shared/elevation-profile';
import { RouteMap } from '../shared/route-map';
import { Track, parseGpx } from '../shared/gpx';

@Component({
  selector: 'vb-routes-page',
  standalone: true,
  imports: [DecimalPipe, RouteMap, ElevationProfile],
  template: `
    <div class="container section">
      <h1>{{ i18n.t('routes.title') }}</h1>
      <p class="lead">{{ i18n.t('routes.intro') }}</p>

      <div class="tabs" role="tablist">
        @for (d of allDistances(); track d.id) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="selected()?.id === d.id"
            [class.is-active]="selected()?.id === d.id"
            (click)="select(d)"
          >
            {{ d.eventName }} — {{ d.name }}
          </button>
        }
      </div>

      @if (selected(); as d) {
        <div class="facts">
          <div>
            <span class="eyebrow">{{ i18n.t('routes.distance') }}</span>
            <strong>{{ track()?.distanceKm ?? d.distanceKm | number: '1.0-1' }} km</strong>
          </div>
          <div>
            <span class="eyebrow">{{ i18n.t('routes.climb') }}</span>
            <strong>{{ track()?.climbM ?? d.elevationGainM | number: '1.0-0' }} m</strong>
          </div>
        </div>

        @if (track(); as t) {
          <vb-route-map [track]="t" />
          <h2>{{ i18n.t('routes.elevation') }}</h2>
          <vb-elevation-profile [track]="t" />
        } @else {
          <p class="alert">{{ message() }}</p>
        }
      }
    </div>
  `,
  styles: `
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-bottom: var(--space-8);
      border-bottom: var(--border);
    }

    .tabs button {
      font-family: var(--font-body);
      font-size: 0.9375rem;
      font-weight: 500;
      background: none;
      border: 0;
      border-bottom: 2px solid transparent;
      padding: var(--space-3) var(--space-4);
      cursor: pointer;
      color: var(--ink-muted);

      &:hover {
        color: var(--ink);
      }

      &.is-active {
        color: var(--ink);
        border-bottom-color: var(--hm-orange);
        font-weight: 600;
      }
    }

    .facts {
      display: flex;
      gap: var(--space-12);
      margin-bottom: var(--space-6);
    }

    .facts > div {
      display: flex;
      flex-direction: column;
    }

    .facts strong {
      font-family: var(--font-display);
      font-size: 1.75rem;
      line-height: 1.1;
    }

    h2 {
      margin-top: var(--space-8);
    }
  `,
})
export class RoutesPage {
  protected readonly i18n = inject(I18nService);
  private api = inject(ApiService);

  protected readonly allDistances = signal<(Distance & { eventName: string })[]>([]);
  protected readonly selected = signal<(Distance & { eventName: string }) | null>(null);
  protected readonly track = signal<Track | null>(null);
  protected readonly message = signal('');

  constructor() {
    this.api.events().subscribe((events: VasbytEvent[]) => {
      const flat = events.flatMap((e) => e.distances.map((d) => ({ ...d, eventName: e.name })));
      this.allDistances.set(flat);
      if (flat.length) this.select(flat[0]);
    });
  }

  protected select(d: Distance & { eventName: string }) {
    this.selected.set(d);
    this.track.set(null);

    if (!d.hasRoute) {
      this.message.set(this.i18n.t('routes.noGpx'));
      return;
    }

    this.message.set(this.i18n.t('common.loading'));
    this.api.gpx(d.id).subscribe({
      next: (xml) => {
        try {
          this.track.set(parseGpx(xml));
        } catch (e) {
          this.message.set((e as Error).message);
        }
      },
      error: () => this.message.set(this.i18n.t('routes.noGpx')),
    });
  }
}
