import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { Track } from './gpx';

const W = 1000;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 24, left: 40 };

/** Elevation profile as inline SVG. No chart library — it is one polygon and a crosshair. */
@Component({
  selector: 'vb-elevation-profile',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <figure class="elev">
      <svg
        [attr.viewBox]="'0 0 ' + W + ' ' + H"
        preserveAspectRatio="none"
        role="img"
        [attr.aria-label]="ariaLabel()"
        (pointermove)="onMove($event)"
        (pointerdown)="onMove($event)"
        (pointerleave)="leave()"
      >
        <g class="elev__grid">
          @for (tick of yTicks(); track tick.m) {
            <line [attr.x1]="pad.left" [attr.x2]="W - pad.right" [attr.y1]="tick.y" [attr.y2]="tick.y" />
            <text [attr.x]="pad.left - 6" [attr.y]="tick.y + 4" text-anchor="end">{{ tick.m }}</text>
          }
        </g>

        <path class="elev__area" [attr.d]="area()" />
        <path class="elev__line" [attr.d]="line()" />

        @if (cursor(); as c) {
          <line class="elev__crosshair" [attr.x1]="c.x" [attr.x2]="c.x" [attr.y1]="pad.top" [attr.y2]="H - pad.bottom" />
          <circle class="elev__dot" [attr.cx]="c.x" [attr.cy]="c.y" r="4" />
        }

        <text class="elev__axis" [attr.x]="pad.left" [attr.y]="H - 6">0 km</text>
        <text class="elev__axis" [attr.x]="W - pad.right" [attr.y]="H - 6" text-anchor="end">
          {{ track().distanceKm | number: '1.0-1' }} km
        </text>
      </svg>

      <figcaption>
        @if (cursor(); as c) {
          {{ c.km | number: '1.0-1' }} km · {{ c.ele | number: '1.0-0' }} m
        } @else {
          {{ track().minEleM | number: '1.0-0' }}–{{ track().maxEleM | number: '1.0-0' }} m
        }
      </figcaption>
    </figure>
  `,
  styles: `
    .elev {
      margin: 0;
    }

    svg {
      width: 100%;
      height: 220px;
      display: block;
      background: var(--karoo-sand-light);
      border-radius: var(--r-md);
      touch-action: pan-y; /* a finger sliding sideways scrubs the profile, vertical still scrolls */
    }

    .elev__area {
      fill: var(--ev, var(--karoo-clay));
      opacity: 0.25;
    }

    .elev__line {
      fill: none;
      stroke: var(--ev, var(--karoo-clay));
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
    }

    .elev__grid line {
      stroke: var(--karoo-line);
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }

    .elev__grid text,
    .elev__axis {
      font-family: var(--font-body);
      font-size: 11px;
      fill: var(--ink-muted);
    }

    .elev__crosshair {
      stroke: var(--indigo-deep);
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }

    .elev__dot {
      fill: var(--indigo-deep);
    }

    figcaption {
      margin-top: var(--space-2);
      font-size: 0.875rem;
      font-variant-numeric: tabular-nums;
      color: var(--ink-muted);
    }
  `,
})
export class ElevationProfile {
  readonly track = input.required<Track>();
  /** The km under the pointer, or null when it leaves, so a map can follow along. */
  readonly hoverKm = output<number | null>();

  protected readonly W = W;
  protected readonly H = H;
  protected readonly pad = PAD;
  protected readonly cursor = signal<{ x: number; y: number; km: number; ele: number } | null>(null);

  /** A metre of altitude is worthless at Karoo scale — pad the band so a flat route is not a flat line. */
  private readonly band = computed(() => {
    const t = this.track();
    const span = Math.max(t.maxEleM - t.minEleM, 50);
    return { lo: t.minEleM - span * 0.1, hi: t.maxEleM + span * 0.1 };
  });

  private readonly plotted = computed(() => {
    const t = this.track();
    const { lo, hi } = this.band();
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const totalKm = Math.max(t.distanceKm, 0.001);

    // One point per horizontal pixel is plenty; a 40 km GPX has tens of thousands of them.
    const step = Math.max(1, Math.floor(t.points.length / innerW));
    const sampled = t.points.filter((_, i) => i % step === 0);
    if (sampled.at(-1) !== t.points.at(-1)) sampled.push(t.points.at(-1)!);

    return sampled.map((p) => ({
      x: PAD.left + (p.km / totalKm) * innerW,
      y: PAD.top + innerH - ((p.ele - lo) / (hi - lo)) * innerH,
      km: p.km,
      ele: p.ele,
    }));
  });

  protected readonly line = computed(() =>
    this.plotted()
      .map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(''),
  );

  protected readonly area = computed(() => {
    const points = this.plotted();
    if (!points.length) return '';
    const floor = H - PAD.bottom;
    return `${this.line()}L${points.at(-1)!.x.toFixed(1)},${floor}L${points[0].x.toFixed(1)},${floor}Z`;
  });

  protected readonly yTicks = computed(() => {
    const { lo, hi } = this.band();
    const innerH = H - PAD.top - PAD.bottom;
    return [0, 0.5, 1].map((f) => ({
      m: Math.round(lo + (hi - lo) * (1 - f)),
      y: PAD.top + innerH * f,
    }));
  });

  protected leave() {
    this.cursor.set(null);
    this.hoverKm.emit(null);
  }

  protected onMove(event: PointerEvent) {
    const svg = event.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const points = this.plotted();
    if (!points.length) return;

    let nearest = points[0];
    for (const p of points) if (Math.abs(p.x - x) < Math.abs(nearest.x - x)) nearest = p;
    this.cursor.set(nearest);
    this.hoverKm.emit(nearest.km);
  }

  protected readonly ariaLabel = computed(() => {
    const t = this.track();
    return `Hoogteprofiel: ${t.distanceKm.toFixed(1)} kilometer, ${t.climbM} meter klim, `
      + `laagste punt ${Math.round(t.minEleM)} meter, hoogste punt ${Math.round(t.maxEleM)} meter.`;
  });
}
