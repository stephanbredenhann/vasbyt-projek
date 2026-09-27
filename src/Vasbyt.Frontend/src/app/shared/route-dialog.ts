import { DecimalPipe } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RouteCategory, RouteDay } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';
import { ElevationProfile } from './elevation-profile';
import { Track } from './gpx';
import { RouteMap } from './route-map';

/** One per page. A route card calls open(route) and gets the interactive map for each day. */
@Component({
  selector: 'vb-route-dialog',
  standalone: true,
  imports: [DecimalPipe, RouterLink, RouteMap, ElevationProfile],
  template: `
    <dialog #dlg class="explore" [attr.data-event]="route()?.code" (close)="route.set(null)" (click)="dismiss($event)">
      @if (route(); as r) {
        <div class="explore__body">
          <header class="explore__head">
            <h2>{{ r.name }}</h2>
            <button type="button" class="explore__x" [attr.aria-label]="i18n.t('reg.close')" (click)="close()">×</button>
          </header>

          <div class="tabs" role="tablist">
            @for (d of r.days; track d.dayNumber) {
              <button type="button" role="tab" class="chip" [attr.aria-selected]="d.dayNumber === day()"
                      (click)="pick(d.dayNumber)">{{ i18n.t(dayKey(d.dayNumber)) }}</button>
            }
          </div>

          @if (current(); as d) {
            <dl class="facts">
              <div><dt>{{ i18n.t('routes.start') }}</dt><dd>{{ d.startTimeLocal.slice(0, 5) }}</dd></div>
              <div><dt>{{ i18n.t('routes.distance') }}</dt><dd>{{ d.distanceKm | number: '1.0-1' }} km</dd></div>
              <div><dt>{{ i18n.t('routes.climb') }}</dt><dd>{{ d.elevationGainM | number: '1.0-0' }} m</dd></div>
              @if (track(); as t) {
                <div><dt>{{ i18n.t('routes.descent') }}</dt><dd>{{ t.descentM | number: '1.0-0' }} m</dd></div>
                <div><dt>{{ i18n.t('routes.highest') }}</dt><dd>{{ t.maxEleM | number: '1.0-0' }} m</dd></div>
                <div><dt>{{ i18n.t('routes.steepest') }}</dt><dd>{{ t.maxGradePct | number: '1.0-1' }}%</dd></div>
              }
            </dl>

            @if (track(); as t) {
              <vb-route-map [track]="t" [markerKm]="hoverKm()" />
              <p class="hint">{{ i18n.t('routes.mapHint') }}</p>
              <vb-elevation-profile [track]="t" (hoverKm)="hoverKm.set($event)" />
            } @else if (d.hasRoute && !failed()) {
              <p class="muted">{{ i18n.t('common.loading') }}</p>
            } @else {
              <p class="muted">{{ i18n.t('routes.noGpx') }}</p>
            }

            <p class="actions">
              @if (d.hasRoute) {
                <a class="btn btn--ghost" [href]="api.dayGpxUrl(r.code, d.dayNumber)"
                   [attr.download]="r.code + '-dag' + d.dayNumber + '.gpx'">{{ i18n.t('routes.downloadGpx') }}</a>
              }
              <a class="btn btn--ghost" [routerLink]="['/roetes', r.code]" (click)="close()">{{ i18n.t('routes.view') }}</a>
              @if (r.isOpen) {
                <a class="btn btn--accent" routerLink="/registreer" (click)="close()">{{ i18n.t('home.cta') }}</a>
              }
            </p>
          }
        </div>
      }
    </dialog>
  `,
  styles: `
    .explore {
      width: min(64rem, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); padding: 0; border: 0;
      border-radius: var(--r-lg); background: var(--paper); color: var(--ink); box-shadow: var(--shadow-3); overflow: auto;
    }
    .explore::backdrop { background: rgb(29 42 74 / 55%); }
    .explore[open] { animation: explore-in 180ms var(--ease); }
    @keyframes explore-in { from { opacity: 0; transform: translateY(.75rem); } }
    .explore__body { padding: var(--space-6); }
    .explore__head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); }
    .explore__head h2 { margin: 0; color: var(--ev); }
    .explore__x {
      flex: none; width: 2.75rem; height: 2.75rem; border: 0; border-radius: var(--r-pill); cursor: pointer;
      background: var(--karoo-sand-light); color: var(--ink); font-size: 1.6rem; line-height: 1;
    }
    .explore__x:hover { background: var(--ev); color: var(--paper); }
    .tabs { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: var(--space-4) 0; }
    .tabs .chip[aria-selected='true'] { background: var(--ev); color: var(--paper); }
    .facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr)); gap: var(--space-3); margin: 0 0 var(--space-4); }
    .facts div { background: var(--ev-tint); border-radius: var(--r-sm); padding: var(--space-2) var(--space-3); }
    .facts dt { font-size: .6875rem; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-muted); }
    .facts dd { margin: 0; font-family: var(--font-display); font-size: 1.25rem; font-variant-numeric: tabular-nums; }
    .hint { font-size: .8125rem; color: var(--ink-muted); margin: var(--space-2) 0 var(--space-4); }
    .actions { display: flex; flex-wrap: wrap; gap: var(--space-3); margin: var(--space-6) 0 0; }
    @media (max-width: 560px) { .explore__body { padding: var(--space-4); } }
  `,
})
export class RouteDialog {
  protected readonly i18n = inject(I18nService);
  protected readonly api = inject(ApiService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly route = signal<RouteCategory | null>(null);
  protected readonly day = signal(1);
  protected readonly track = signal<Track | null>(null);
  protected readonly failed = signal(false);
  protected readonly hoverKm = signal<number | null>(null);
  protected readonly current = computed<RouteDay | undefined>(() =>
    this.route()?.days.find((d) => d.dayNumber === this.day()));

  open(route: RouteCategory) {
    this.route.set(route);
    this.dlg().nativeElement.showModal();
    this.pick(route.days[0]?.dayNumber ?? 1);
  }

  protected pick(day: number) {
    const r = this.route();
    this.day.set(day);
    this.track.set(null);
    this.failed.set(false);
    this.hoverKm.set(null);
    if (!r || !this.current()?.hasRoute) return;
    this.api.dayTrack(r.code, day).then((t) => {
      if (this.route() !== r || this.day() !== day) return;
      this.track.set(t);
      this.failed.set(!t);
    });
  }

  protected dayKey(n: number): TranslationKey {
    return `routes.day${n}` as TranslationKey;
  }

  protected close() {
    this.dlg().nativeElement.close();
  }

  /** A click on the dialog element itself landed on the backdrop. */
  protected dismiss(event: MouseEvent) {
    if (event.target === this.dlg().nativeElement) this.close();
  }
}
