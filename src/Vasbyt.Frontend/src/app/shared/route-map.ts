import {
  AfterViewInit, Component, ElementRef, OnDestroy, effect, input, viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { Track } from './gpx';

/** The course line on an OpenStreetMap base — no API key, no billing account, no tile bill. */
@Component({
  selector: 'vb-route-map',
  standalone: true,
  template: `<div class="route-map" #host></div>`,
  styles: `
    .route-map {
      height: 420px;
      border: var(--border);
      border-radius: var(--radius);
    }

    /* Leaflet's default controls are rounded and shadowed; square them off to match everything else. */
    :host ::ng-deep .leaflet-control-zoom a,
    :host ::ng-deep .leaflet-control-attribution {
      border-radius: var(--radius);
      font-family: var(--font-body);
    }
  `,
})
export class RouteMap implements AfterViewInit, OnDestroy {
  readonly track = input.required<Track>();

  private host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private map?: L.Map;
  private line?: L.Polyline;

  constructor() {
    effect(() => {
      const track = this.track();
      if (this.map) this.draw(track);
    });
  }

  ngAfterViewInit() {
    this.map = L.map(this.host().nativeElement, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '&copy; OpenStreetMap',
    }).addTo(this.map);
    this.draw(this.track());
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  private draw(track: Track) {
    if (!this.map) return;
    this.line?.remove();

    const latLngs = track.points.map((p) => [p.lat, p.lon] as L.LatLngTuple);
    this.line = L.polyline(latLngs, { color: '#F26624', weight: 4 }).addTo(this.map);

    const start = latLngs[0];
    const finish = latLngs.at(-1)!;
    L.circleMarker(start, { radius: 6, color: '#2A3B90', fillColor: '#fff', fillOpacity: 1 })
      .bindTooltip('Begin')
      .addTo(this.map);
    L.circleMarker(finish, { radius: 6, color: '#2A3B90', fillColor: '#2A3B90', fillOpacity: 1 })
      .bindTooltip('Einde')
      .addTo(this.map);

    this.map.fitBounds(this.line.getBounds(), { padding: [24, 24] });
  }
}
