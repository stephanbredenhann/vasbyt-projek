import { Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Advert, ProvinceCount, RouteCategory, RouteCode } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';
import { ImageSlot } from '../shared/image-slot';
import { ProvinceMap } from '../shared/province-map';
import { DISCIPLINE_KEY, routeKey } from './routes-page';

/** Real photographs of previous Vasbyt events, per the functional description's opening gallery. */
const PHOTOS: { src: string; altKey: TranslationKey }[] = [
  { src: '/foto/fietsryers-sonsondergang.webp', altKey: 'home.photo1' },
  { src: '/foto/hardlopers-grondpad.webp', altKey: 'home.photo2' },
  { src: '/foto/fietsryer-kanaal.webp', altKey: 'home.photo3' },
  { src: '/foto/deelnemers-monument.webp', altKey: 'home.photo4' },
  { src: '/foto/fietsryer-wegspring.webp', altKey: 'home.photo5' },
  { src: '/foto/fietsryer-pad.webp', altKey: 'home.photo6' },
];

const AUTOPLAY_MS = 6000;

@Component({
  selector: 'vb-home',
  standalone: true,
  imports: [RouterLink, ProvinceMap, ImageSlot],
  template: `
    <section class="hero torn torn--to-canvas">
      <div class="container hero__copy">
        <p class="eyebrow">{{ i18n.t('home.eyebrow') }}</p>
        <h1>{{ i18n.t('home.title') }}</h1>
        <p class="hero__tagline">{{ i18n.t('home.tagline') }}</p>
        <p class="lead">{{ i18n.t('home.intro') }}</p>
        <p class="hero__actions">
          <a class="btn btn--accent btn--lg" routerLink="/registreer">{{ i18n.t('home.cta') }}</a>
          <span class="muted hero__dates">{{ i18n.t('home.dates') }}</span>
        </p>
      </div>

      <!-- Scroll-snap, so the browser does the sliding: no carousel library and no dependency. -->
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
          <a class="btn btn--ghost" routerLink="/oor-helpmekaar">{{ i18n.t('common.readMore') }}</a>
        </div>
        <vb-image src="/foto/deelnemers-monument.webp" [alt]="i18n.t('home.photo4')" ratio="4 / 5" />
      </div>
    </section>

    <section class="section section--sand torn torn--to-canvas">
      <div class="container">
        <h2>{{ i18n.t('home.routes') }}</h2>
        <p class="lead">{{ i18n.t('home.routesIntro') }}</p>

        <div class="grid grid--2 routes">
          @for (r of routes(); track r.code) {
            <article class="card route">
              <p class="chip chip--quiet">{{ i18n.t(disciplineKey[r.discipline]) }}</p>
              <h3>{{ i18n.t(key(r.code, 'name')) }}</h3>

              @if (r.isOpen) {
                <p class="route__count">
                  <strong>{{ count(r.code) }}</strong>
                  <span class="muted">{{ i18n.t('routes.entries') }}</span>
                </p>
                <a class="btn btn--accent" routerLink="/registreer">{{ i18n.t('home.cta') }}</a>
              } @else {
                <p class="chip chip--blue">{{ i18n.t('routes.openingSoon') }}</p>
              }

              <a class="route__more" [routerLink]="['/roetes', r.code]">{{ i18n.t('routes.view') }}</a>
            </article>
          } @empty {
            <p class="muted">{{ i18n.t(failed() ? 'common.error' : 'common.loading') }}</p>
          }
        </div>
      </div>
    </section>

    <section
      class="section torn"
      [class.torn--to-sand]="stays().length || sponsors().length"
      [class.torn--to-canvas]="!(stays().length || sponsors().length)"
    >
      <div class="container">
        <h2>{{ i18n.t('home.map') }}</h2>
        <vb-province-map [counts]="counts()" />
      </div>
    </section>

    @if (stays().length || sponsors().length) {
      <section class="section section--sand torn torn--to-canvas">
        <div class="container">
          @if (stays().length) {
            <h2>{{ i18n.t('home.stayTitle') }}</h2>
            <p class="lead">{{ i18n.t('stay.intro') }}</p>

            <div class="grid grid--3">
              @for (a of stays(); track a.id) {
                <article class="card advert">
                  <vb-image [src]="a.imageUrl" [alt]="a.name" ratio="4 / 3" />
                  <h3>{{ a.name }}</h3>
                  <p>{{ a.blurb }}</p>
                  @if (a.bookingUrl) {
                    <a class="btn btn--accent" [href]="a.bookingUrl" rel="noopener">
                      {{ i18n.t('stay.book') }}
                    </a>
                  }
                </article>
              }
            </div>

            <p class="more">
              <a class="btn btn--ghost" routerLink="/verblyf">{{ i18n.t('home.stayAll') }}</a>
            </p>
          }

          @if (sponsors().length) {
            <h2 [class.sponsors-head]="stays().length">{{ i18n.t('home.sponsorsTitle') }}</h2>
            <ul class="strip">
              @for (s of sponsors(); track s.id) {
                <li>
                  <vb-image
                    class="logo"
                    [src]="s.imageUrl"
                    [alt]="s.name"
                    ratio="3 / 2"
                    fit="contain"
                    [label]="s.name"
                  />
                </li>
              }
            </ul>

            <p class="more">
              <a class="btn btn--ghost" routerLink="/borge">{{ i18n.t('home.sponsorsAll') }}</a>
            </p>
          }
        </div>
      </section>
    }

    <section class="section">
      <div class="container donate">
        <div>
          <h2>{{ i18n.t('home.donateTitle') }}</h2>
          <p class="lead">{{ i18n.t('home.donateBody') }}</p>
          <a class="btn btn--primary btn--lg" routerLink="/skenk">{{ i18n.t('nav.donate') }}</a>
        </div>
        <vb-image
          src="/foto/fietsryers-sonsondergang.webp"
          [alt]="i18n.t('home.photo1')"
          ratio="4 / 3"
        />
      </div>
    </section>
  `,
  styles: `
    .hero {
      background: var(--karoo-sand-light);
      padding-block: var(--space-16) calc(var(--space-16) + var(--torn-h));
    }

    .hero__copy {
      max-width: 46rem;
      margin-bottom: var(--space-12);
    }

    .hero__tagline {
      font-family: var(--font-display);
      font-size: clamp(1.125rem, 2.4vw, 1.5rem);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--karoo-clay);
    }

    .hero__dates {
      font-size: 0.9375rem;
    }

    .hero__actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-4);
      margin: 0;
    }

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

    .about,
    .donate {
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
      margin: 0;
      flex: 1;
    }

    .route__count strong {
      font-family: var(--font-display);
      font-size: 2.25rem;
      line-height: 1;
      color: var(--indigo-deep);
    }

    .advert h3 {
      margin: var(--space-4) 0 var(--space-2);
    }

    /* A logo is contained, never cropped, and on sand the tile is paper, not sand on sand. */
    .logo {
      display: block;
      padding: var(--space-6);
      border-radius: var(--r-lg);
      background: var(--paper);
      --slot-bg: transparent;
    }

    .strip {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: var(--space-6);
    }

    .more {
      margin: var(--space-6) 0 0;
    }

    .sponsors-head {
      margin-top: var(--space-16);
    }

    @media (max-width: 719px) {
      .about,
      .donate {
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
  protected readonly stays = signal<Advert[]>([]);
  protected readonly sponsors = signal<Advert[]>([]);

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

    // The advert CMS is Wave 2, so an empty list and a failed call land on the same empty state.
    api.adverts('Accommodation').subscribe({
      next: (a) => this.stays.set(a.slice(0, 3)),
      error: () => this.stays.set([]),
    });
    api.adverts('Sponsor').subscribe({
      next: (a) => this.sponsors.set(a),
      error: () => this.sponsors.set([]),
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
