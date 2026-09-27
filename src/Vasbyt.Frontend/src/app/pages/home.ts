import { Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProvinceCount, RouteCategory, RouteCode } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';
import { ImageSlot } from '../shared/image-slot';
import { ProvinceMap } from '../shared/province-map';
import { DisciplineIcon } from '../shared/discipline-icon';
import { DifficultyMeter } from '../shared/difficulty-meter';
import { RouteDialog } from '../shared/route-dialog';
import { RouteGlance } from '../shared/route-glance';
import { DISCIPLINE_KEY, routeKey } from './routes-page';

/** Real photographs of previous Vasbyt events, per the functional description's opening gallery. */
const PHOTOS: { src: string; altKey: TranslationKey }[] = [
  { src: '/foto/vasbyt-saam.webp', altKey: 'home.photo1' },
  { src: '/foto/vasbyt-draf.webp', altKey: 'home.photo2' },
  { src: '/foto/vasbyt-kanaal.webp', altKey: 'home.photo3' },
  { src: '/foto/vasbyt-stap.webp', altKey: 'home.photo4' },
  { src: '/foto/vasbyt-juig.webp', altKey: 'home.photo5' },
  { src: '/foto/vasbyt-fiets.webp', altKey: 'home.photo6' },
];

const AUTOPLAY_MS = 6000;

@Component({
  selector: 'vb-home',
  standalone: true,
  imports: [RouterLink, ProvinceMap, ImageSlot, DisciplineIcon, DifficultyMeter, RouteGlance, RouteDialog],
  template: `
    <section class="hero torn torn--to-canvas">
      <img class="hero__photo" src="/foto/tuisblad-hero.webp" [alt]="i18n.t('home.heroRider')" fetchpriority="high" width="2200" height="1467" />
      <div class="hero__shade" aria-hidden="true"></div>
      <div class="container hero__copy">
        <p class="eyebrow">{{ i18n.t('home.eyebrow') }}</p>
        <h1 [attr.aria-label]="i18n.t('home.title')"><span>Orania Helpmekaar</span>Vasbyt</h1>
        <p class="hero__tagline">{{ i18n.t('home.tagline') }}</p>
        <p class="hero__actions">
          <a class="btn btn--accent btn--lg" routerLink="/registreer">{{ i18n.t('home.cta') }}</a>
          <span class="hero__dates">{{ i18n.t('home.dates') }}</span>
        </p>
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
        <vb-image src="/foto/helpmekaar-rivier.webp" [alt]="i18n.t('home.communityPhoto')" ratio="4 / 5" />
      </div>
    </section>

    <section class="section section--sand torn torn--to-canvas">
      <div class="container">
        <h2>{{ i18n.t('home.routes') }}</h2>
        <p class="lead">{{ i18n.t('home.routesIntro') }}</p>

        <div class="grid grid--2 routes">
          @for (r of routes(); track r.code) {
            <article class="card card--event card--lift route" [attr.data-event]="r.code">
              <div class="route__discipline"><vb-discipline-icon [discipline]="r.discipline" /><span>{{ i18n.t(disciplineKey[r.discipline]) }}</span></div>
              <h3>{{ r.name }}</h3>
              @if (r.isOpen) { <p class="route__distance">{{ r.totalDistanceKm }} km / {{ r.elevationGainM }} m</p> }
              <vb-difficulty-meter [difficulty]="r.difficulty" />
              @defer (on viewport) {
                <vb-route-glance class="route__glance" [route]="r" (open)="dialog.open(r)" />
              } @placeholder {
                <div class="route__glance"></div>
              }

              @if (r.isOpen) {
                <p class="route__count card__foot">
                  <strong>{{ count(r.code) }}</strong>
                  <span class="muted">{{ i18n.t('routes.entries') }}</span>
                </p>
                <a class="btn btn--accent" routerLink="/registreer">{{ i18n.t('home.cta') }}</a>
              } @else {
                <p class="chip chip--blue card__foot">{{ i18n.t('routes.openingSoon') }}</p>
              }

              <a class="route__more" [routerLink]="['/roetes', r.code]">{{ i18n.t('routes.view') }}</a>
            </article>
          } @empty {
            <p class="muted">{{ i18n.t(failed() ? 'common.error' : 'common.loading') }}</p>
          }
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <h2>{{ i18n.t('home.map') }}</h2>
        <vb-province-map [counts]="counts()" />
      </div>
    </section>

    <vb-route-dialog #dialog />
  `,
  styles: `
    .hero { min-height: min(760px, calc(100svh - 76px)); display: flex; align-items: center; padding-block: 5rem; isolation: isolate; background: var(--indigo-deep); }
    .hero__photo, .hero__shade { position: absolute; inset: 0; width: 100%; height: 100%; }
    .hero__photo { object-fit: cover; object-position: 40% 55%; z-index: -2; }
    .hero__shade { background: linear-gradient(100deg, rgb(28 74 78 / 72%) 0%, rgb(29 42 74 / 38%) 55%, rgb(29 42 74 / 12%) 100%); z-index: -1; }
    .hero__copy { padding-block: 2rem; }
    .hero .eyebrow { color: white; font-size: .875rem; }
    .hero h1 { font-size: clamp(5rem, 13vw, 10rem); color: white; margin: 0; line-height: 1.02; max-width: 10ch; }
    .hero h1 span { display: block; font-size: clamp(1.5rem, 4vw, 2.75rem); margin-bottom: .6rem; font-weight: 500; letter-spacing: .015em; }
    .hero__tagline { font-family: var(--font-display); font-size: clamp(1.4rem, 3vw, 2rem); color: white; margin-block: 1.5rem 2rem; }
    .hero__dates { color: white; font-size: .875rem; max-width: 24ch; }
    .hero__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-6); margin: 0; }
    .hero__actions .btn { border-color: white; box-shadow: 0 0 0 4px rgb(255 255 255 / 20%); }
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
      flex: 0 0 min(86%, 640px);
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

    .route__count strong {
      font-family: var(--font-display);
      font-size: 2.25rem;
      line-height: 1;
      color: var(--ev);
    }

    .route h3 { color: var(--ev); }
    .route__glance { display: block; width: 100%; }
    .route__discipline { display: flex; align-items: center; gap: .75rem; font-weight: 600; color: var(--ev); }
    .route__distance { margin: 0; font-size: .875rem; color: var(--ink-muted); }

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

  protected readonly routes = signal<RouteCategory[]>([]);
  protected readonly failed = signal(false);
  protected readonly counts = signal<ProvinceCount[]>([]);

  private readonly track = viewChild.required<ElementRef<HTMLDivElement>>('track');
  private readonly byRoute = signal(new Map<string, number>());
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    const api = inject(ApiService);
    api.routes().subscribe({ next: (r) => this.routes.set(r), error: () => this.failed.set(true) });

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
  }

  protected count(code: RouteCode) {
    return this.byRoute().get(code) ?? 0;
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
