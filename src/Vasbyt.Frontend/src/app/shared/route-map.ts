import {
  AfterViewInit, Component, ElementRef, OnDestroy, effect, inject, input, signal, viewChild,
} from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import * as L from 'leaflet';
import { Track } from './gpx';

const ROUTE_RED = '#d7191c';

/** The course line on an OpenStreetMap base — no API key, no billing account, no tile bill. */
@Component({
  selector: 'vb-route-map',
  standalone: true,
  template: `
    <div class="route-map" #host></div>
    <p class="touch-hint" [class.on]="hint()" aria-hidden="true">{{ i18n.t('routes.mapTouchHint') }}</p>
  `,
  styles: `
    :host { display: block; position: relative; }

    .touch-hint {
      position: absolute; inset: 0; z-index: 1; margin: 0; display: grid; place-items: center; padding: var(--space-4);
      border-radius: var(--r-md); background: rgb(29 42 74 / 55%); color: #fff; text-align: center;
      font-weight: 600; pointer-events: none; opacity: 0; transition: opacity 0.3s;
    }
    .touch-hint.on { opacity: 1; }

    /* Leaflet's panes run z-index 400 to 1000; isolate them so the sticky header stays on top. */
    .route-map {
      position: relative;
      z-index: 0;
      isolation: isolate;
      height: clamp(280px, 55vh, 460px);
      border-radius: var(--r-md);
      background: var(--karoo-sand-light);
    }

    :host ::ng-deep .leaflet-control-zoom a,
    :host ::ng-deep .leaflet-control-attribution {
      border-radius: var(--radius);
      font-family: var(--font-body);
    }
  `,
})
export class RouteMap implements AfterViewInit, OnDestroy {
  readonly track = input.required<Track>();
  /** Distance along the track to mark, driven by hovering the elevation profile. */
  readonly markerKm = input<number | null>(null);

  protected readonly i18n = inject(I18nService);
  protected readonly hint = signal(false);
  private hintTimer?: ReturnType<typeof setTimeout>;
  private host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private map?: L.Map;
  private layers?: L.LayerGroup;
  private marker?: L.CircleMarker;
  private resize?: ResizeObserver;

  constructor() {
    effect(() => {
      const track = this.track();
      if (this.map) this.draw(track);
    });
    effect(() => this.moveMarker(this.markerKm()));
  }

  ngAfterViewInit() {
    const el = this.host().nativeElement;
    // Wheel zoom only once the map has been clicked, so scrolling the page never gets stuck on it.
    // On touch screens one finger scrolls the page; two fingers pan and pinch the map.
    const touch = matchMedia('(pointer: coarse)').matches;
    this.map = L.map(el, { scrollWheelZoom: false, dragging: !touch });
    if (touch) el.addEventListener('touchstart', (e) => this.showHint(e.touches.length === 1), { passive: true });
    this.map.on('click', () => this.map?.scrollWheelZoom.enable());
    this.map.on('mouseout', () => this.map?.scrollWheelZoom.disable());
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '&copy; OpenStreetMap',
    }).addTo(this.map);
    this.draw(this.track());
    // Leaflet measures once; a dialog opening or a card resizing needs it to measure again.
    this.resize = new ResizeObserver(() => this.map?.invalidateSize());
    this.resize.observe(el);
  }

  private showHint(on: boolean) {
    clearTimeout(this.hintTimer);
    this.hint.set(on);
    if (on) this.hintTimer = setTimeout(() => this.hint.set(false), 1500);
  }

  ngOnDestroy() {
    clearTimeout(this.hintTimer);
    this.resize?.disconnect();
    this.map?.remove();
  }

  private draw(track: Track) {
    if (!this.map) return;
    this.layers?.remove();
    this.marker = undefined;

    const latLngs = track.points.map((p) => [p.lat, p.lon] as L.LatLngTuple);
    const casing = L.polyline(latLngs, { color: '#fff', weight: 8, opacity: 0.9, interactive: false });
    const line = L.polyline(latLngs, { color: ROUTE_RED, weight: 5 });
    const start = L.circleMarker(latLngs[0], { radius: 7, color: '#1d1e58', weight: 3, fillColor: '#fff', fillOpacity: 1 })
      .bindTooltip('Begin');
    const finish = L.circleMarker(latLngs.at(-1)!, { radius: 7, color: '#1d1e58', weight: 3, fillColor: '#1d1e58', fillOpacity: 1 })
      .bindTooltip('Einde');
    this.layers = L.layerGroup([casing, line, start, finish]).addTo(this.map);
    this.map.fitBounds(line.getBounds(), { padding: [24, 24] });
    this.moveMarker(this.markerKm());
  }

  private moveMarker(km: number | null) {
    if (!this.map || !this.layers) return;
    if (km === null) {
      this.marker?.remove();
      this.marker = undefined;
      return;
    }
    const points = this.track().points;
    const p = points.find((x) => x.km >= km) ?? points.at(-1)!;
    if (!this.marker) {
      this.marker = L.circleMarker([p.lat, p.lon], {
        radius: 8, color: '#fff', weight: 3, fillColor: ROUTE_RED, fillOpacity: 1,
      }).addTo(this.layers);
    } else {
      this.marker.setLatLng([p.lat, p.lon]);
    }
  }
}
