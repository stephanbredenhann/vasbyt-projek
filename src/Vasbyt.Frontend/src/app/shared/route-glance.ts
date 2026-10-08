import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { RouteCategory } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { I18nService } from '../i18n/i18n.service';
import { Track, thin } from './gpx';

const W = 300;
const H = 170;
const EH = 54;
const PAD = 10;

/** All three days' courses and one height line, drawn from the GPX with no map tiles. */
@Component({
  selector: 'vb-route-glance',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    @if (tracks().length) {
      <button type="button" class="glance" (click)="open.emit()"
              [attr.aria-label]="i18n.t('routes.openMap') + ': ' + route().name">
        <svg class="glance__trace" [attr.viewBox]="'0 0 ' + W + ' ' + H" aria-hidden="true">
          @for (d of traces(); track d.day) {
            <path [attr.d]="d.path" [class]="'day day--' + d.day" />
          }
          @if (ends(); as e) {
            <circle class="start" [attr.cx]="e.x" [attr.cy]="e.y" r="4.5" />
          }
        </svg>
        <svg class="glance__elev" [attr.viewBox]="'0 0 ' + W + ' ' + EH" preserveAspectRatio="none" aria-hidden="true">
          <path class="area" [attr.d]="profile().area" />
          <path class="line" [attr.d]="profile().line" />
          @for (x of profile().dividers; track x) {
            <line [attr.x1]="x" [attr.x2]="x" y1="0" [attr.y2]="EH" />
          }
        </svg>
        <span class="glance__cta">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
          {{ i18n.t('routes.openMap') }}
        </span>
      </button>
      <dl class="glance__stats">
        <div><dt>{{ i18n.t('routes.highest') }}</dt><dd>{{ stats().highest | number: '1.0-0' }} m</dd></div>
        <div><dt>{{ i18n.t('routes.descent') }}</dt><dd>{{ stats().descent | number: '1.0-0' }} m</dd></div>
        <div><dt>{{ i18n.t('routes.steepest') }}</dt><dd>{{ stats().steepest | number: '1.0-1' }}%</dd></div>
      </dl>
    }
  `,
  styles: `
    :host { display: block; }
    .glance {
      display: block; width: 100%; padding: var(--space-3); border: 0; border-radius: var(--r-md);
      background: var(--paper); color: var(--ink); font: inherit; cursor: pointer; text-align: left;
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ev, var(--indigo)) 18%, transparent);
      transition: box-shadow var(--dur-ui) var(--ease-out);
    }
    .glance:hover { box-shadow: inset 0 0 0 2px var(--ev, var(--indigo)); }
    svg { display: block; width: 100%; }
    .glance__trace { height: auto; aspect-ratio: 300 / 170; }
    .day { fill: none; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
    .day--1 { stroke: color-mix(in srgb, var(--ev) 40%, var(--paper)); }
    .day--2 { stroke: color-mix(in srgb, var(--ev) 70%, var(--paper)); }
    .day--3 { stroke: var(--ev); }
    .start { fill: var(--paper); stroke: var(--indigo-deep); stroke-width: 2.5; }
    .glance__elev { height: 54px; margin-top: var(--space-2); }
    .area { fill: var(--ev); opacity: .22; }
    .line { fill: none; stroke: var(--ev); stroke-width: 1.6; vector-effect: non-scaling-stroke; }
    .glance__elev line { stroke: var(--ink-muted); stroke-dasharray: 2 3; stroke-width: 1; vector-effect: non-scaling-stroke; opacity: .5; }
    .glance__cta {
      display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-2);
      font-size: 0.9375rem; font-weight: 600; color: var(--ev, var(--indigo));
    }
    .glance__cta svg { width: 1.1rem; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; }
    .glance__stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); margin: var(--space-3) 0 0; }
    .glance__stats dt { font-size: 0.9375rem; color: var(--ink-muted); }
    .glance__stats dd { margin: 0; font-family: var(--font-display); font-size: 1.125rem; font-variant-numeric: tabular-nums; }
  `,
})
export class RouteGlance {
  readonly route = input.required<RouteCategory>();
  readonly open = output<void>();

  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  protected readonly W = W;
  protected readonly H = H;
  protected readonly EH = EH;
  protected readonly tracks = signal<{ day: number; track: Track }[]>([]);

  constructor() {
    effect(() => {
      const r = this.route();
      const days = r.days.filter((d) => d.hasRoute);
      Promise.all(days.map((d) => this.api.dayTrack(r.code, d.dayNumber).then((track) => ({ day: d.dayNumber, track }))))
        .then((loaded) => this.tracks.set(loaded.filter((x): x is { day: number; track: Track } => !!x.track)));
    });
  }

  private readonly thinned = computed(() => this.tracks().map((t) => ({ day: t.day, points: thin(t.track.points, 300) })));

  /** Equirectangular with the longitude squeezed by cos(latitude): true shape at Orania's scale. */
  private readonly project = computed(() => {
    const all = this.thinned().flatMap((t) => t.points);
    const k = Math.cos((all.reduce((s, p) => s + p.lat, 0) / all.length) * (Math.PI / 180));
    const xs = all.map((p) => p.lon * k);
    const ys = all.map((p) => -p.lat);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const scale = Math.min((W - 2 * PAD) / (x1 - x0 || 1), (H - 2 * PAD) / (y1 - y0 || 1));
    const ox = (W - (x1 - x0) * scale) / 2;
    const oy = (H - (y1 - y0) * scale) / 2;
    return (lat: number, lon: number) => ({ x: ox + (lon * k - x0) * scale, y: oy + (-lat - y0) * scale });
  });

  protected readonly traces = computed(() => {
    const at = this.project();
    return this.thinned().map((t) => ({
      day: t.day,
      path: t.points.map((p, i) => {
        const { x, y } = at(p.lat, p.lon);
        return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(''),
    }));
  });

  protected readonly ends = computed(() => {
    const first = this.thinned()[0]?.points[0];
    return first ? this.project()(first.lat, first.lon) : null;
  });

  /** The three days laid end to end, with a dashed line where one day stops and the next starts. */
  protected readonly profile = computed(() => {
    const days = this.tracks();
    const total = days.reduce((s, d) => s + d.track.distanceKm, 0) || 1;
    const lo = Math.min(...days.map((d) => d.track.minEleM));
    const hi = Math.max(...days.map((d) => d.track.maxEleM));
    const span = Math.max(hi - lo, 30);
    const pts: string[] = [];
    const dividers: number[] = [];
    let offset = 0;
    for (const d of days) {
      for (const p of thin(d.track.points, 150)) {
        const x = ((offset + p.km) / total) * W;
        const y = EH - 4 - ((p.ele - lo) / span) * (EH - 8);
        pts.push(`${pts.length ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`);
      }
      offset += d.track.distanceKm;
      if (offset < total) dividers.push((offset / total) * W);
    }
    const line = pts.join('');
    return { line, area: line ? `${line}L${W},${EH}L0,${EH}Z` : '', dividers };
  });

  protected readonly stats = computed(() => {
    const t = this.tracks().map((d) => d.track);
    return {
      highest: Math.max(...t.map((x) => x.maxEleM)),
      descent: t.reduce((s, x) => s + x.descentM, 0),
      steepest: Math.max(...t.map((x) => x.maxGradePct)),
    };
  });
}
