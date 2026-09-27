import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { I18nService } from './i18n/i18n.service';

@Component({
  selector: 'vb-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a class="skip" href="#inhoud">Spring na inhoud</a>

    <header class="site-header">
      <div class="container site-header__inner">
        <a class="brand" routerLink="/">
          <img class="brand__logo" src="/merk/vasbyt-logo.svg" alt="Orania Helpmekaar Vasbyt" width="88" height="86" />
        </a>

        <button
          type="button"
          class="hamburger"
          aria-controls="site-nav"
          [attr.aria-expanded]="menuOpen()"
          (click)="menuOpen.set(!menuOpen())"
        >
          <span class="visually-hidden">{{ i18n.t('nav.menu') }}</span>
          <span class="hamburger__bars" aria-hidden="true"></span>
        </button>

        <!-- One handler on the wrapper closes the panel on any link tap by bubbling. -->
        <div id="site-nav" class="site-nav" [class.is-open]="menuOpen()" (click)="menuOpen.set(false)">
          <nav aria-label="Hoof">
            <a routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }">
              {{ i18n.t('nav.home') }}
            </a>
            <a routerLink="/roetes" routerLinkActive="is-active">{{ i18n.t('nav.routes') }}</a>
            <a routerLink="/program" routerLinkActive="is-active">{{ i18n.t('nav.programme') }}</a>
            <a routerLink="/verblyf" routerLinkActive="is-active">{{ i18n.t('nav.accommodation') }}</a>
            @if (auth.isAdmin()) {
              <a routerLink="/admin" routerLinkActive="is-active">{{ i18n.t('nav.admin') }}</a>
            }
            @if (auth.isSignedIn()) {
              <a routerLink="/rekening" routerLinkActive="is-active">{{ i18n.t('nav.account') }}</a>
            } @else {
              <a routerLink="/teken-aan" routerLinkActive="is-active">{{ i18n.t('nav.login') }}</a>
            }
          </nav>

          <div class="site-header__actions">
            <button
              type="button"
              class="lang"
              (click)="i18n.toggle()"
              [attr.aria-label]="i18n.locale() === 'af' ? 'Switch to English' : 'Skakel na Afrikaans'"
            >
              {{ i18n.locale() === 'af' ? 'EN' : 'AF' }}
            </button>

            @if (auth.isSignedIn()) {
              <button type="button" class="btn btn--ghost" (click)="signOut()">
                {{ i18n.t('nav.logout') }}
              </button>
            }
            <a class="btn btn--ghost" routerLink="/skenk">{{ i18n.t('nav.donate') }}</a>
            <a class="btn btn--accent" routerLink="/registreer">{{ i18n.t('nav.register') }}</a>
          </div>
        </div>
      </div>
    </header>

    <main id="inhoud">
      <router-outlet />
    </main>

    <footer class="site-footer torn torn--up torn--to-canvas">
      <div class="container site-footer__inner">
        <p>
          <strong>Vasbyt</strong> · Orania, Noord-Kaap<br />
          {{ i18n.t('common.footerBlurb') }}
        </p>
        <nav class="site-footer__nav" aria-label="Meer">
          <a routerLink="/oor-helpmekaar">{{ i18n.t('nav.about') }}</a>
          <a routerLink="/borge">{{ i18n.t('nav.sponsors') }}</a>
          <a routerLink="/vrae">{{ i18n.t('nav.faq') }}</a>
        </nav>
        <p>
          {{ i18n.t('common.footerProceeds') }}<br />
          <a href="https://oraniahelpmekaar.co.za" rel="noopener" target="_blank">
            oraniahelpmekaar.co.za
          </a>
        </p>
      </div>
    </footer>
  `,
  styles: `
    .skip {
      position: absolute;
      left: -9999px;

      &:focus {
        left: var(--space-4);
        top: var(--space-4);
        z-index: 10;
        background: var(--paper);
        padding: var(--space-3);
        border-radius: var(--r-sm);
        box-shadow: var(--shadow-2);
      }
    }

    .site-header {
      background: var(--paper);
      box-shadow: var(--shadow-1);
      position: sticky;
      top: 0;
      z-index: 5;
    }

    .site-header__inner {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      min-height: 76px;
      flex-wrap: nowrap;
      max-width: 1320px;
    }

    .brand {
      text-decoration: none;
      color: var(--ink);
      line-height: 1.1;
      margin-right: auto;
      flex-shrink: 0;
    }

    .brand__logo { width: 88px; height: 86px; object-fit: contain; padding-block: 5px; }

    .brand__mark {
      display: block;
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .brand__sub {
      display: block;
      font-size: 0.6875rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--karoo-stone);
    }

    /* display: contents keeps nav and actions as direct flex children of the header on desktop,
       so wrapping them for the mobile panel costs the desktop layout nothing. */
    .site-nav {
      display: contents;
    }

    nav {
      display: flex;
      gap: var(--space-1);
      font-size: 0.9375rem;
      font-weight: 500;
      white-space: nowrap;
    }

    nav a {
      color: var(--ink);
      text-decoration: none;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--r-pill);
      transition: background-color var(--dur) var(--ease), color var(--dur) var(--ease);

      &:hover {
        background: var(--orange);
        color: var(--ink);
      }

      &.is-active {
        background: var(--indigo);
        color: var(--paper);
      }
    }

    .site-header__actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      white-space: nowrap;
    }

    .lang {
      font-family: var(--font-body);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      background: var(--karoo-sand-light);
      border: 0;
      border-radius: var(--r-pill);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      color: var(--ink);

      &:hover {
        background: var(--karoo-sand);
      }
    }

    /* Three CSS bars in a 44px touch target: no icon font, no SVG. */
    .hamburger {
      display: none;
      width: 44px;
      height: 44px;
      align-items: center;
      justify-content: center;
      background: none;
      border: 0;
      border-radius: var(--r-pill);
      cursor: pointer;
      color: var(--ink);
    }

    .hamburger__bars {
      position: relative;
    }

    .hamburger__bars,
    .hamburger__bars::before,
    .hamburger__bars::after {
      display: block;
      width: 22px;
      height: 2px;
      border-radius: var(--r-pill);
      background: currentColor;
    }

    .hamburger__bars::before,
    .hamburger__bars::after {
      content: '';
      position: absolute;
      left: 0;
    }

    .hamburger__bars::before {
      top: -7px;
    }

    .hamburger__bars::after {
      top: 7px;
    }

    @media (max-width: 1199px) {
      .hamburger {
        display: inline-flex;
      }

      .site-nav {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        flex-direction: column;
        align-items: stretch;
        gap: var(--space-4);
        padding: var(--space-4) var(--space-6) var(--space-6);
        background: var(--paper);
        border-radius: 0 0 var(--r-lg) var(--r-lg);
        box-shadow: var(--shadow-2);
      }

      .site-nav.is-open {
        display: flex;
      }

      nav {
        flex-direction: column;
        gap: var(--space-1);
      }

      .site-header__actions {
        flex-wrap: wrap;
      }
    }

    .site-footer {
      margin-top: var(--space-20);
      background: var(--contours) center / 480px 240px, linear-gradient(160deg, var(--river-deep), var(--dusk));
      color: rgb(255 255 255 / 78%);
      padding-block: var(--space-12);
      font-size: 0.875rem;
    }

    .site-footer a {
      color: var(--paper); /* --orange-ink is unreadable on the deep indigo fill */
    }

    .site-footer__nav {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .site-footer__inner {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: var(--space-6);
    }

    .site-footer p {
      margin: 0;
    }
  `,
})
export class App {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly menuOpen = signal(false);

  protected signOut() {
    this.auth.signOut().subscribe();
  }
}
