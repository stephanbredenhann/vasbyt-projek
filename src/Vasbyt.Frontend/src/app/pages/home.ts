import { Component, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProvinceCount, RouteCategory, RouteCode } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';
import { eventDateRange, eventDays, eventOver, eventStart } from '../shared/calendar';
import { AddCalendar } from '../shared/add-calendar';
import { ImageSlot } from '../shared/image-slot';
import { ProvinceMap } from '../shared/province-map';
import { DisciplineIcon } from '../shared/discipline-icon';
import { DifficultyMeter } from '../shared/difficulty-meter';
import { RouteDialog } from '../shared/route-dialog';
import { RouteGlance } from '../shared/route-glance';
import { groupRoutes } from '../shared/route-switch';
import { DISCIPLINE_KEY, routeKey } from './routes-page';

/** Real photographs of previous Vasbyt events, per the functional description's opening gallery. */
const PHOTOS: { src: string; altKey: TranslationKey }[] = [
  { src: '/foto/vasbyt-saam.webp', altKey: 'home.photo1' },
  { src: '/foto/vasbyt-draf.webp', altKey: 'home.photo2' },
  { src: '/foto/vasbyt-kanaal.webp', altKey: 'home.photo3' },
  { src: '/foto/vasbyt-stap.webp', altKey: 'home.photo4' },
  { src: '/foto/vasbyt-juig.webp', altKey: 'home.photo5' },
  { src: '/foto/vasbyt-fiets.webp', altKey: 'home.photo6' },
  { src: '/foto/vasbyt-nag-fiets.webp', altKey: 'home.photo7' },
  { src: '/foto/vasbyt-museum-draf.webp', altKey: 'home.photo8' },
  { src: '/foto/vasbyt-brug-fiets.webp', altKey: 'home.photo9' },
  { src: '/foto/vasbyt-nag-draf.webp', altKey: 'home.photo10' },
  { src: '/foto/vasbyt-kanaal-fiets.webp', altKey: 'home.photo11' },
  { src: '/foto/vasbyt-kleurvol.webp', altKey: 'home.photo12' },
  { src: '/foto/vasbyt-mis-fiets.webp', altKey: 'home.photo13' },
  { src: '/foto/vasbyt-kanaal-draf.webp', altKey: 'home.photo14' },
  { src: '/foto/vasbyt-kanaal-fietsryster.webp', altKey: 'home.photo15' },
  { src: '/foto/vasbyt-eindstreep.webp', altKey: 'home.photo16' },
  { src: '/foto/vasbyt-saam-draf.webp', altKey: 'home.photo17' },
  { src: '/foto/vasbyt-jong-fietsryers.webp', altKey: 'home.photo18' },
];

const AUTOPLAY_MS = 6000;

@Component({
  selector: 'vb-home',
  standalone: true,
  imports: [RouterLink, AddCalendar, ProvinceMap, ImageSlot, DisciplineIcon, DifficultyMeter, RouteGlance, RouteDialog],
  template: `
    <section class="hero torn torn--to-canvas">
      <img class="hero__photo" src="/foto/tuisblad-hero-3-flip.webp" [alt]="i18n.t('home.heroRider')" fetchpriority="high" width="2200" height="1467" />
      <div class="hero__shade" aria-hidden="true"></div>
      <div class="container hero__copy">
        <h1 [attr.aria-label]="i18n.t('home.title')"><span>Orania Helpmekaar</span>Vasbyt</h1>
        <p class="hero__tagline">{{ i18n.t('home.tagline') }}</p>
        <p class="hero__actions">
          <a class="btn btn--accent btn--lg" routerLink="/registreer">{{ i18n.t('home.cta') }}</a>
          @if (calendarOpen()) {
            <vb-add-calendar [days]="days()" [confirmed]="datesConfirmed() ?? false" buttonClass="btn btn--ghost btn--lg hero__calendar" />
          }
          @if (routesLoaded() && !days().length && !datesConfirmed()) { <span class="hero__dates">{{ i18n.t('home.dates') }}</span> }
        </p>
        @if (days().length) {
          <p class="hero__when">{{ eventDateRange(days(), i18n.locale(), i18n.t('done.to')) }} · {{ i18n.t('home.where') }}@if (datesConfirmed() === false) { ({{ i18n.t('home.provisional') }})}</p>
        }
        @if (countdown()) {
          <div class="hero__timing">
            @if (countdown(); as c) {
              <div class="countdown" role="group" [attr.aria-label]="countdownAria(c)">
                <p class="countdown__lead" aria-hidden="true">{{ i18n.t('home.cdLead') }}</p>
                <p class="countdown__part" aria-hidden="true"><b>{{ c.days }}</b><small>{{ unit(c.days, 'home.cdDay', 'home.cdDays') }}</small></p>
                <p class="countdown__part" aria-hidden="true"><b>{{ c.hours }}</b><small>{{ unit(c.hours, 'home.cdHour', 'home.cdHours') }}</small></p>
                <p class="countdown__part" aria-hidden="true"><b>{{ c.minutes }}</b><small>{{ unit(c.minutes, 'home.cdMinute', 'home.cdMinutes') }}</small></p>
                @if (datesConfirmed() === false) { <p class="countdown__note" aria-hidden="true">{{ i18n.t('home.provisional') }}</p> }
              </div>
            }
          </div>
        }
      </div>

    </section>

    <section class="section gallery-section">
      <div class="container gallery-heading">
        <div><h2>{{ i18n.t('home.galleryTitle') }}</h2><p class="muted">{{ i18n.t('home.galleryBody') }}</p></div>
      </div>
      <div
        class="gallery"
        (pointerenter)="pause()"
        (pointerleave)="resume()"
        (focusin)="pause()"
        (focusout)="resume()"
      >
        <div
          class="gallery__track"
          #track
          tabindex="0"
          role="group"
          [attr.aria-label]="i18n.t('home.galleryAlt')"
        >
          @for (p of photos; track p.src; let i = $index) {
            <div class="gallery__slide">
              <vb-image [src]="p.src" [alt]="i18n.t(p.altKey)" ratio="16 / 10" [eager]="i === 0" />
            </div>
          }
        </div>

        <button type="button" class="gallery__nav prev" (click)="step(-1)">
          <span class="visually-hidden">{{ i18n.t('home.prevPhoto') }}</span>
        </button>
        <button type="button" class="gallery__nav next" (click)="step(1)">
          <span class="visually-hidden">{{ i18n.t('home.nextPhoto') }}</span>
        </button>
      </div>
    </section>

    <section class="section torn torn--to-sand">
      <div class="container about">
        <div>
          <h2>{{ i18n.t('home.aboutTitle') }}</h2>
          <p class="lead">{{ i18n.t('home.aboutBody') }}</p>
          <p>{{ i18n.t('home.aboutImpact') }}</p>
          <a class="btn btn--ghost" routerLink="/oor-helpmekaar">{{ i18n.t('common.readMore') }}</a>
        </div>
        <vb-image src="/foto/vasbyt-trofees.webp" [alt]="i18n.t('home.trophiesPhoto')" ratio="4 / 5" />
      </div>
    </section>

    <section class="section section--sand torn torn--to-canvas">
      <div class="container">
        <h2>{{ i18n.t('home.routes') }}</h2>
        <p class="lead">{{ i18n.t('home.routesIntro') }}</p>

        <div class="grid grid--4 routes">
          @for (g of groups(); track g.run.code) {
            @let r = g.run;
            <article class="card card--event card--lift route" [attr.data-event]="r.code">
              <div class="route__discipline">
                <vb-discipline-icon [discipline]="r.discipline" />
                <span>{{ i18n.t(disciplineKey[r.discipline]) }}@if (g.walk) { / {{ i18n.t(disciplineKey[g.walk.discipline]) }}}</span>
              </div>
              <h3>{{ r.name }}@if (g.walk) { / {{ g.walk.name }}}</h3>
              @if (r.isOpen) { <p class="route__distance">{{ r.totalDistanceKm }} km / {{ r.elevationGainM }} m</p> }
              <vb-difficulty-meter [difficulty]="r.difficulty" />
              @defer (on viewport) {
                <vb-route-glance class="route__glance" [route]="r" (open)="dialog.open(r)" />
              } @placeholder {
                <div class="route__glance skeleton glance-placeholder" aria-hidden="true"></div>
              }

              @if (r.isOpen) {
                <p class="route__count card__foot">
                  @if (g.walk) {
                    <strong>{{ count(r.code) }}</strong><span class="muted">{{ i18n.t(disciplineKey[r.discipline]) }}</span>
                    <strong>{{ count(g.walk.code) }}</strong><span class="muted">{{ i18n.t(disciplineKey[g.walk.discipline]) }}</span>
                  } @else {
                    <strong>{{ count(r.code) }}</strong><span class="muted">{{ i18n.t('routes.entries') }}</span>
                  }
                </p>
              } @else {
                <p class="chip chip--blue card__foot">{{ i18n.t('routes.openingSoon') }}</p>
              }
            </article>
          } @empty {
            @if (failed()) {
              <p class="muted">{{ i18n.t('common.error') }}</p>
            } @else if (!routesLoaded()) {
              <p class="visually-hidden">{{ i18n.t('common.loading') }}</p>
              @for (i of [1, 2, 3, 4]; track i) { <div class="card skeleton" aria-hidden="true"></div> }
            }
          }
        </div>
      </div>
    </section>

    <section class="section map-section">
      @if (hasEntries()) {
        <div class="container">
          <h2>{{ i18n.t('home.map') }}</h2>
          <vb-province-map [counts]="counts()" />
        </div>
      }
      <!-- The holding page's cyclist, as a lazy image so it never competes with the page's own loading. -->
      <img class="ride" src="/fietsryer.svg" alt="" width="1200" height="420" loading="lazy" decoding="async" />
    </section>

    <vb-route-dialog #dialog />

    <button type="button" class="btn btn--accent ask" popovertarget="ask-menu">{{ i18n.t('home.ask') }}</button>
    <div id="ask-menu" class="ask__menu" popover>
      <a class="btn btn--ghost" href="https://wa.me/27795062090" target="_blank" rel="noopener">{{ i18n.t('home.askWhatsapp') }}</a>
      <a class="btn btn--ghost" [href]="'mailto:' + i18n.t('helpmekaar.email')">{{ i18n.t('home.askEmail') }}</a>
    </div>
  `,
  styles: `
    .ask { position: fixed; right: var(--space-4); bottom: var(--space-4); z-index: 50; box-shadow: 0 8px 24px rgb(0 0 0 / 25%); }
    .ask__menu { inset: auto var(--space-4) calc(var(--space-4) + 3.5rem) auto; margin: 0; padding: var(--space-3); flex-direction: column; gap: var(--space-2); border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--paper); box-shadow: 0 12px 32px rgb(0 0 0 / 22%); }
    .ask__menu:popover-open { display: flex; }
    .map-section { overflow-x: clip; padding-bottom: 0; }
    .ride { display: block; width: 100%; max-width: 1320px; height: auto; margin: var(--space-8) auto 0; mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent); }
    @media (max-width: 640px) { .ride { width: 185%; max-width: none; margin-left: -26%; mask-image: none; } }
    .hero { min-height: min(760px, calc(100svh - 64px)); display: flex; align-items: center; padding-block: 5rem; isolation: isolate; background: var(--indigo-deep); }
    .hero__photo, .hero__shade { position: absolute; inset: 0; width: 100%; height: 100%; }
    .hero__photo { object-fit: cover; object-position: 40% 55%; z-index: -2; }
    .hero__shade { background: linear-gradient(100deg, rgb(28 74 78 / 86%) 0%, rgb(29 42 74 / 55%) 50%, rgb(29 42 74 / 12%) 100%); z-index: -1; }
    .hero__copy { padding-block: 2rem; }
    /* The one orchestrated moment: hero copy settles in once on load. */
    .hero__copy > * { animation: hero-in var(--dur-page) var(--ease-out) backwards; }
    .hero__copy > :nth-child(2) { animation-delay: 60ms; }
    .hero__copy > :nth-child(3) { animation-delay: 120ms; }
    .hero__copy > :nth-child(n+4) { animation-delay: 180ms; }
    @keyframes hero-in { from { opacity: 0; transform: translateY(12px); } }
    .hero h1 { font-size: clamp(5rem, 13vw, 10rem); color: white; margin: 0; line-height: 1.02; max-width: 10ch; }
    .hero h1 span { display: block; font-size: clamp(1.5rem, 4vw, 2.75rem); margin-bottom: .6rem; font-weight: 500; letter-spacing: .015em; }
    .hero__tagline { font-family: var(--font-display); font-size: clamp(1.4rem, 3vw, 2rem); color: white; margin-block: 1.5rem 2rem; }
    .hero__dates { color: white; font-size: 0.9375rem; max-width: 24ch; }
    .hero__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3) var(--space-4); margin: 0; }
    .hero__actions .btn { border-color: white; box-shadow: 0 0 0 3px rgb(255 255 255 / 20%); }
    .hero__timing { display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--space-3) var(--space-6); margin-top: var(--space-6); }
    .countdown { display: grid; grid-template-columns: repeat(3, auto); gap: var(--space-3); padding: var(--space-4); color: white; background: rgb(29 30 88 / 62%); backdrop-filter: blur(10px); border: 1px solid rgb(255 255 255 / 18%); border-radius: var(--r-lg); box-shadow: 0 12px 32px rgb(0 0 0 / 28%); }
    .countdown__part { display: flex; flex-direction: column; align-items: center; min-width: 4.5rem; margin: 0; padding: var(--space-2) var(--space-3); background: rgb(255 255 255 / 10%); border-radius: var(--r-md); }
    .countdown__part:nth-child(2) { background: var(--orange-ink); }
    .countdown__part b { font-family: var(--font-display); font-size: clamp(2.25rem, 6.5vw, 3.25rem); font-weight: 400; line-height: 1; font-variant-numeric: tabular-nums; }
    .countdown__lead, .countdown__note { grid-column: 1 / -1; }
    .countdown__lead { margin: 0; font-weight: 700; font-size: 1rem; letter-spacing: .08em; text-transform: uppercase; }
    .countdown__part small { font-size: 0.9375rem; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; margin: 0; }
    @media (max-width: 400px) { .countdown { grid-template-columns: repeat(3, 1fr); } .countdown__part { min-width: 0; padding-inline: var(--space-2); } }
    .countdown__note { font-size: 0.9375rem; margin: 0; opacity: .92; }
    .hero__when { color: white; font-size: clamp(1.125rem, 0.95rem + 1vw, 1.5rem); max-width: 22ch; font-weight: 600; line-height: 1.3; text-wrap: balance; margin: var(--space-4) 0 0; }
    .hero__tagline, .hero__dates, .hero__when { text-shadow: 0 1px 10px rgb(0 0 0 / 40%); }
    /* The button lives inside vb-add-calendar, so the hero tint has to reach through its encapsulation. */
    :host ::ng-deep .hero__calendar { margin: 0; color: white; border-color: white; background: rgb(20 30 40 / 35%); }
    .gallery-heading { display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); margin-bottom: var(--space-6); flex-wrap: wrap; }
    .gallery-heading h2 { font-size: 2rem; margin-bottom: .5rem; }
    .gallery-heading p { margin-bottom: 0; }

    .gallery {
      position: relative;
    }

    .gallery__track {
      display: flex;
      gap: var(--space-4);
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scroll-padding-inline: var(--space-6);
      padding-inline: var(--space-6);
      scrollbar-width: none;
    }

    .gallery__track::-webkit-scrollbar {
      display: none;
    }

    .gallery__slide {
      flex: 0 0 min(90%, 1000px);
      scroll-snap-align: center;
    }

    .gallery__nav {
      position: absolute;
      top: 50%;
      translate: 0 -50%;
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: var(--r-pill);
      background: var(--paper);
      box-shadow: var(--shadow-2);
      cursor: pointer;
      color: var(--ink);
    }

    /* A CSS chevron: no icon font, no SVG, no emoji. */
    .gallery__nav::before {
      content: '';
      width: 10px;
      height: 10px;
      border-left: 2px solid currentColor;
      border-bottom: 2px solid currentColor;
    }

    .prev {
      left: var(--space-2);
    }
    .prev::before {
      rotate: 45deg;
      margin-left: 4px;
    }

    .next {
      right: var(--space-2);
    }
    .next::before {
      rotate: -135deg;
      margin-right: 4px;
    }

    .about {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      gap: var(--space-12);
      align-items: center;
    }

    .routes {
      margin-top: var(--space-8);
    }

    .route {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-3);
    }

    .route h3 {
      margin: 0;
    }

    .route__count {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
      margin-bottom: 0;
    }

    .route__count span + strong { margin-left: var(--space-3); }

    .route__count strong {
      font-family: var(--font-display);
      font-size: 2.25rem;
      line-height: 1;
      color: var(--ev);
    }

    .route h3 { color: var(--ev); }
    /* Four across, "Ligdraf / Ligstap" must still fit on one line. */
    @media (min-width: 1100px) { .route h3 { font-size: 1.25rem; } }
    .route__glance { display: block; width: 100%; }
    .route__discipline { display: flex; align-items: center; gap: .75rem; font-weight: 600; color: var(--ev); }
    .route__distance { margin: 0; font-size: 0.9375rem; color: var(--ink-muted); }

    @media (max-width: 719px) {
      .about {
        grid-template-columns: 1fr;
      }

      .gallery__slide {
        flex: 0 0 min(88%, 640px);
      }
    }
  `,
})
export class Home implements OnDestroy {
  protected readonly i18n = inject(I18nService);
  protected readonly photos = PHOTOS;
  protected readonly key = routeKey;
  protected readonly disciplineKey = DISCIPLINE_KEY;
  protected readonly groups = computed(() => groupRoutes(this.routes()));
  protected readonly days = computed(() => eventDays(this.routes()));
  /** Minutes until the first event day starts, or null once it has started. */
  protected readonly countdown = computed(() => {
    const start = eventStart(this.days());
    const mins = start ? Math.floor((start.getTime() - this.now()) / 60_000) : 0;
    if (mins <= 0) return null;
    return { days: Math.floor(mins / 1440), hours: Math.floor((mins % 1440) / 60), minutes: mins % 60 };
  });
  /** The calendar entry stays until the last event day is over. */
  protected readonly calendarOpen = computed(() => this.days().length > 0 && !eventOver(this.days(), this.now()));

  protected readonly routes = signal<RouteCategory[]>([]);
  protected readonly failed = signal(false);
  protected readonly routesLoaded = signal(false);
  protected readonly eventDateRange = eventDateRange;
  protected readonly counts = signal<ProvinceCount[]>([]);
  protected readonly hasEntries = computed(() => this.counts().some((c) => c.count > 0));
  /** Null until the config loads, so the provisional wording never flashes before the real answer. */
  protected readonly datesConfirmed = signal<boolean | null>(null);
  /** Refreshed once a minute: the countdown shows no seconds, so nothing ticks faster. */
  protected readonly now = signal(Date.now());

  private readonly track = viewChild.required<ElementRef<HTMLDivElement>>('track');
  private readonly byRoute = signal(new Map<string, number>());
  private timer?: ReturnType<typeof setInterval>;
  private clock?: ReturnType<typeof setInterval>;

  constructor() {
    const api = inject(ApiService);
    api.routes().subscribe({ next: (r) => { this.routes.set(r); this.routesLoaded.set(true); }, error: () => { this.failed.set(true); this.routesLoaded.set(true); } });
    this.clock = setInterval(() => this.now.set(Date.now()), 60_000);
    api.config().subscribe({ next: (c) => this.datesConfirmed.set(c.datesConfirmed), error: () => {} });

    // A missing counter is a zero on the map and on the cards, never a broken page.
    api.registrationsByProvince().subscribe({ next: (c) => this.counts.set(c), error: () => {} });
    api.registrationsByRoute().subscribe({
      next: (r) => this.byRoute.set(new Map(r.map((x) => [x.code, x.count]))),
      error: () => {},
    });

    this.resume();
  }

  ngOnDestroy() {
    this.pause();
    clearInterval(this.clock);
  }

  protected count(code: RouteCode) {
    return this.byRoute().get(code) ?? 0;
  }

  protected unit(n: number, one: TranslationKey, many: TranslationKey) {
    return this.i18n.t(n === 1 ? one : many);
  }

  protected countdownAria(c: { days: number; hours: number; minutes: number }) {
    const sentence = this.i18n.t('home.countdownAria')
      .replace('{d}', String(c.days)).replace('{dl}', this.unit(c.days, 'home.cdDay', 'home.cdDays'))
      .replace('{h}', String(c.hours)).replace('{hl}', this.unit(c.hours, 'home.cdHour', 'home.cdHours'))
      .replace('{m}', String(c.minutes)).replace('{ml}', this.unit(c.minutes, 'home.cdMinute', 'home.cdMinutes'));
    return this.datesConfirmed() !== false ? sentence : `${sentence} ${this.i18n.t('home.countdownProvisional')}`;
  }

  protected step(direction: number) {
    const el = this.track().nativeElement;
    const slide = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth;
    const max = el.scrollWidth - el.clientWidth;
    let left = el.scrollLeft + direction * (slide + 16);
    if (left > max - 4) left = 0;
    if (left < 0) left = max;
    el.scrollTo({ left, behavior: this.reduced() ? 'auto' : 'smooth' });
  }

  protected pause() {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** No autoplay at all when the visitor asked for reduced motion. */
  protected resume() {
    if (this.timer || this.reduced()) return;
    this.timer = setInterval(() => this.step(1), AUTOPLAY_MS);
  }

  private reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
