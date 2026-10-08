import { Component, computed, input, signal } from '@angular/core';
import { ProvinceCount } from '../core/api.models';
import { SA_PROVINCE_PATHS, SA_VIEWBOX } from './sa-provinces.data';

/**
 * Choropleth of entrant counts per province, drawn as inline SVG — no map library, no tiles.
 *
 * POPIA: the API only ever hands this component a province and a count. There is no name, town or
 * coordinate to leak here, by construction rather than by filtering.
 */
@Component({
  selector: 'vb-province-map',
  standalone: true,
  template: `
    <div class="province-map">
      <svg [attr.viewBox]="viewBox" role="img" [attr.aria-label]="ariaLabel()">
        @for (p of provinces(); track p.name) {
          <path
            [attr.d]="p.d"
            [attr.fill]="p.fill"
            [class.is-active]="hovered() === p.name"
            (mouseenter)="hovered.set(p.name)"
            (mouseleave)="hovered.set(null)"
          >
            <title>{{ p.name }} — {{ p.count }}</title>
          </path>
        }
      </svg>

      <ol class="province-map__legend">
        @for (p of ranked(); track p.name) {
          <li
            [class.is-active]="hovered() === p.name"
            (mouseenter)="hovered.set(p.name)"
            (mouseleave)="hovered.set(null)"
          >
            <span class="province-map__swatch" [style.background]="p.fill"></span>
            <span class="province-map__name">{{ p.name }}</span>
            <span class="province-map__count">{{ p.count }}</span>
          </li>
        }
      </ol>
    </div>
  `,
  styles: `
    .province-map {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(200px, 1fr);
      gap: var(--space-8);
      align-items: center;
    }

    @media (max-width: 720px) {
      .province-map {
        grid-template-columns: 1fr;
      }
    }

    svg {
      width: 100%;
      height: auto;
      display: block;
    }

    path {
      stroke: var(--paper);
      stroke-width: 2;
      stroke-linejoin: round;
      transition: fill var(--dur-press) var(--ease-out);
      cursor: default;
    }

    path.is-active {
      stroke: var(--ink);
      stroke-width: 2.5;
    }

    .province-map__legend {
      list-style: none;
      margin: 0;
      padding: 0;
      font-size: 0.9375rem;
    }

    .province-map__legend li {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-2);
      border-bottom: var(--border);
    }

    .province-map__legend li.is-active {
      background: var(--karoo-sand-light);
    }

    .province-map__swatch {
      width: 0.75rem;
      height: 0.75rem;
      flex: none;
      border: 1px solid var(--karoo-line);
    }

    .province-map__name {
      flex: 1;
    }

    .province-map__count {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
  `,
})
export class ProvinceMap {
  readonly counts = input<ProvinceCount[]>([]);

  protected readonly viewBox = SA_VIEWBOX;
  protected readonly hovered = signal<string | null>(null);

  private readonly byProvince = computed(() => {
    const map = new Map<string, number>();
    for (const c of this.counts()) map.set(c.province, c.count);
    return map;
  });

  /** Scaled against the busiest province, so the map still reads when the whole field is twelve people. */
  private readonly busiest = computed(() =>
    Math.max(1, ...this.counts().map((c) => c.count)),
  );

  protected readonly provinces = computed(() =>
    Object.entries(SA_PROVINCE_PATHS).map(([name, d]) => {
      const count = this.byProvince().get(name) ?? 0;
      return { name, d, count, fill: this.shade(count) };
    }),
  );

  protected readonly ranked = computed(() =>
    [...this.provinces()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  );

  protected readonly ariaLabel = computed(
    () =>
      'Inskrywings per provinsie: ' +
      this.ranked()
        .map((p) => `${p.name} ${p.count}`)
        .join(', '),
  );

  /** Flat sand for zero, then five steps of the Helpmekaar orange — stepped rather than
      continuous so neighbouring provinces stay tellable apart. */
  private shade(count: number): string {
    if (count === 0) return 'var(--karoo-sand)';
    const step = Math.ceil((count / this.busiest()) * 5);
    return `color-mix(in srgb, var(--hm-orange) ${step * 20}%, var(--karoo-sand))`;
  }
}
