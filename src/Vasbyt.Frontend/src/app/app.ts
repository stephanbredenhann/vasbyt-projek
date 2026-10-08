import { Component, DestroyRef, DOCUMENT, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/auth.service';
import { OrderFlowService } from './core/order-flow.service';
import { I18nService } from './i18n/i18n.service';

@Component({
  selector: 'vb-root',
  standalone: true,
  host: { '(document:keydown.escape)': 'onEscape()', '(document:click)': 'onDocClick($event)' },
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <a class="skip" href="#inhoud">Spring na inhoud</a>

    <header class="site-header">
      <div class="container site-header__inner">
        <a class="brand" routerLink="/">
          <img class="brand__logo" src="/merk/vasbyt-logo.svg" alt="Orania Helpmekaar Vasbyt" width="88" height="86" />
        </a>
        <a class="basket-link" routerLink="/mandjie" [attr.aria-label]="i18n.t('nav.basket') + ': ' + flow.itemCount()">
          {{ i18n.t('nav.basket') }} <span class="chip chip--accent" aria-hidden="true">{{ flow.itemCount() }}</span>
        </a>

        <button
          type="button"
          #burger
          class="hamburger"
          [class.is-open]="menuOpen()"
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
            <a routerLink="/winkel" routerLinkActive="is-active">{{ i18n.t('nav.shop') }}</a>
            @if (auth.isAdmin()) {
              <a class="m-only" routerLink="/admin" routerLinkActive="is-active">{{ i18n.t('nav.admin') }}</a>
            }
            @if (auth.isSignedIn()) {
              <a class="m-only" routerLink="/rekening" routerLinkActive="is-active">{{ i18n.t('nav.account') }}</a>
            } @else {
              <a class="m-only" routerLink="/teken-aan" routerLinkActive="is-active">{{ i18n.t('nav.login') }}</a>
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
              <button type="button" class="btn btn--ghost m-only" (click)="signOut()">
                {{ i18n.t('nav.logout') }}
              </button>
            }
            <a class="btn btn--ghost donate" routerLink="/skenk">{{ i18n.t('nav.donate') }}</a>
            <a class="btn btn--accent cta" routerLink="/registreer">{{ i18n.t('nav.register') }}</a>
          </div>
        </div>

        <!-- Desktop only: the account links live in a small popover; the mobile sheet lists them inline. -->
        <div class="acct" (click)="$event.stopPropagation()">
          @if (auth.isSignedIn()) {
            <button
              #acctBtn
              type="button"
              class="acct__btn"
              aria-haspopup="true"
              aria-controls="acct-menu"
              [attr.aria-expanded]="acctOpen()"
              (click)="toggleAcct()"
            >
              {{ i18n.t('nav.account') }}
              <span class="acct__caret" aria-hidden="true"></span>
            </button>
            <div id="acct-menu" class="acct__menu" [class.is-open]="acctOpen()" (click)="acctOpen.set(false)">
              <a routerLink="/rekening">{{ i18n.t('nav.account') }}</a>
              @if (auth.isAdmin()) {
                <a routerLink="/admin">{{ i18n.t('nav.admin') }}</a>
              }
              <button type="button" (click)="signOut()">{{ i18n.t('nav.logout') }}</button>
            </div>
          } @else {
            <a class="acct__btn" routerLink="/teken-aan">{{ i18n.t('nav.login') }}</a>
          }
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
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }

    main {
      flex: 1 0 auto;
    }

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
      background: color-mix(in srgb, var(--paper) 78%, transparent);
      -webkit-backdrop-filter: saturate(180%) blur(20px);
      backdrop-filter: saturate(180%) blur(20px);
      border-bottom: 1px solid color-mix(in srgb, var(--rule) 80%, transparent);
      padding-top: env(safe-area-inset-top);
      position: sticky;
      top: 0;
      z-index: 5;
    }

    @supports not (backdrop-filter: blur(1px)) {
      .site-header {
        background: var(--paper);
      }
    }

    .site-header__inner {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 64px;
      flex-wrap: nowrap;
      max-width: 1320px;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      min-height: var(--touch);
      text-decoration: none;
      color: var(--ink);
      margin-right: auto;
      flex-shrink: 0;
    }

    .brand__logo { width: 56px; height: 56px; object-fit: contain; }
    .brand { order: 0; }
    .basket-link { order: 1; }
    .hamburger { order: 2; }
    .basket-link {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-height: var(--touch);
      padding-inline: var(--space-2);
      white-space: nowrap;
      text-decoration: none;
      font-weight: 600;
      color: var(--indigo);
    }

    /* display: contents keeps nav and actions as direct flex children of the header on desktop,
       so wrapping them for the mobile panel costs the desktop layout nothing. */
    .site-nav {
      display: contents;
    }

    nav {
      display: flex;
      gap: var(--space-1);
      font-size: 1rem;
      font-weight: 500;
      white-space: nowrap;
    }

    nav a {
      display: inline-flex;
      align-items: center;
      min-height: var(--touch);
      color: var(--ink);
      text-decoration: none;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--r-pill);
      transition: background-color var(--dur-press) var(--ease-out), color var(--dur-press) var(--ease-out);

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

    .site-header__actions .btn {
      min-height: var(--touch);
      padding-inline: var(--space-4);
    }

    .lang {
      min-width: var(--touch);
      min-height: var(--touch);
      font-family: var(--font-body);
      font-size: 0.9375rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      background: var(--karoo-sand-light);
      border: 0;
      border-radius: var(--r-pill);
      padding-inline: var(--space-3);
      cursor: pointer;
      color: var(--ink);
      transition: background-color var(--dur-press) var(--ease-out), transform var(--dur-press) var(--ease-out);

      &:hover {
        background: var(--karoo-sand);
      }

      &:active {
        transform: scale(0.97);
      }
    }

    /* Two CSS bars in a 44px touch target that cross into an X: transform only, no icon font. */
    .hamburger {
      display: none;
      width: var(--touch);
      height: var(--touch);
      align-items: center;
      justify-content: center;
      background: none;
      border: 0;
      border-radius: var(--r-pill);
      cursor: pointer;
      color: var(--ink);
    }

    .hamburger__bars,
    .hamburger__bars::before,
    .hamburger__bars::after {
      display: block;
      width: 22px;
      height: 2px;
      border-radius: var(--r-pill);
      background: currentColor;
      transition: transform var(--dur-panel) var(--ease-out), background-color var(--dur-ui) var(--ease-out);
    }

    .hamburger__bars {
      position: relative;
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

    .hamburger.is-open .hamburger__bars {
      background: transparent;
    }

    .hamburger.is-open .hamburger__bars::before {
      transform: translateY(7px) rotate(45deg);
    }

    .hamburger.is-open .hamburger__bars::after {
      transform: translateY(-7px) rotate(-45deg);
    }

    .acct { display: none; }

    @media (min-width: 1200px) {
      .site-header__inner { min-height: 80px; gap: var(--space-3); }
      .brand__logo { width: 68px; height: 68px; }
      .m-only { display: none !important; }
      .site-header__actions { display: contents; }
      .site-nav nav { order: 1; margin-right: auto; margin-left: var(--space-4); }
      .lang { order: 2; }
      .basket-link { order: 3; }
      .acct { order: 4; display: block; position: relative; }
      .donate { order: 5; }
      .cta { order: 6; }

      .site-header__actions .donate {
        border-color: transparent;
        padding-inline: var(--space-3);
        color: var(--ink);
        font-weight: 500;
        text-decoration: underline;
        text-underline-offset: 4px;
        text-decoration-color: var(--field-line);
      }

      .acct__btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-height: var(--touch);
        padding-inline: var(--space-3);
        border: 0;
        border-radius: var(--r-pill);
        background: none;
        color: var(--ink);
        font: inherit;
        font-weight: 500;
        text-decoration: none;
        cursor: pointer;
        transition: background-color var(--dur-press) var(--ease-out);
      }

      .acct__btn:hover {
        background: var(--karoo-sand-light);
      }

      .acct__caret {
        width: 8px;
        height: 8px;
        border-right: 2px solid currentColor;
        border-bottom: 2px solid currentColor;
        rotate: 45deg;
        translate: 0 -2px;
      }

      .acct__menu {
        position: absolute;
        right: 0;
        top: calc(100% + var(--space-2));
        min-width: 14rem;
        padding: var(--space-2);
        background: var(--paper);
        border-radius: var(--r-md);
        box-shadow: var(--shadow-3), 0 0 0 1px color-mix(in srgb, var(--rule) 80%, transparent);
        opacity: 0;
        visibility: hidden;
        transform: translateY(-6px);
        transition: opacity var(--dur-ui) var(--ease-out), transform var(--dur-ui) var(--ease-out),
          visibility 0s linear var(--dur-ui);
      }

      .acct__menu.is-open {
        opacity: 1;
        visibility: visible;
        transform: none;
        transition-delay: 0s;
      }

      .acct__menu a,
      .acct__menu button {
        display: flex;
        align-items: center;
        width: 100%;
        min-height: var(--touch);
        padding: var(--space-2) var(--space-4);
        border: 0;
        border-radius: var(--r-sm);
        background: none;
        color: var(--ink);
        font: inherit;
        text-align: left;
        text-decoration: none;
        cursor: pointer;
      }

      .acct__menu a:hover,
      .acct__menu button:hover {
        background: var(--karoo-sand-light);
      }
    }

    @media (max-width: 1199px) {
      .hamburger {
        display: inline-flex;
      }

      /* A full-height sheet under the bar; hidden with visibility so it leaves the tab order. */
      .site-nav {
        display: flex;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        height: calc(100dvh - 100%);
        flex-direction: column;
        align-items: stretch;
        gap: var(--space-6);
        padding: var(--space-4) max(var(--space-6), env(safe-area-inset-right))
          calc(var(--space-6) + env(safe-area-inset-bottom)) max(var(--space-6), env(safe-area-inset-left));
        background: var(--paper);
        overflow-y: auto;
        overscroll-behavior: contain;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-12px);
        transition: opacity var(--dur-panel) var(--ease-out), transform var(--dur-panel) var(--ease-out),
          visibility 0s linear var(--dur-panel);
      }

      .site-nav.is-open {
        opacity: 1;
        visibility: visible;
        transform: none;
        transition-delay: 0s;
      }

      nav {
        flex-direction: column;
        gap: 0;
        font-size: 1.1875rem;
      }

      nav a {
        min-height: 56px;
        padding-inline: var(--space-4);
        border-radius: var(--r-md);
      }

      .site-header__actions {
        flex-direction: column;
        align-items: stretch;
        gap: var(--space-3);
        padding-top: var(--space-4);
        border-top: 1px solid var(--rule);
      }

      .site-header__actions .btn {
        min-height: 52px;
      }

      .site-header__actions .m-only {
        display: inline-flex;
      }

      .lang {
        min-height: 52px;
      }
    }

    @media (max-width: 380px) {
      .basket-link {
        font-size: 0.9375rem;
      }
    }

    .site-footer {
      margin-top: var(--section-y);
      background: var(--contours) center / 480px 240px, linear-gradient(160deg, var(--river-deep), var(--dusk));
      color: rgb(255 255 255 / 82%);
      padding-block: var(--space-12) calc(var(--space-12) + env(safe-area-inset-bottom));
      font-size: 1rem;
      line-height: 1.6;
    }

    .site-footer a {
      color: var(--paper); /* --orange-ink is unreadable on the deep indigo fill */
    }

    .site-footer__nav {
      display: flex;
      flex-direction: column;
    }

    .site-footer a {
      display: inline-flex;
      align-items: center;
      min-height: var(--touch);
    }

    .site-footer .site-footer__nav a,
    .site-footer .site-footer__nav a:hover {
      padding-inline: 0;
      border-radius: 0;
      background: none;
      color: var(--paper);
    }

    .site-footer p a {
      display: inline;
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
  protected readonly flow = inject(OrderFlowService);
  private readonly router = inject(Router);
  protected readonly menuOpen = signal(false);
  private readonly doc = inject(DOCUMENT);
  private readonly burger = viewChild<ElementRef<HTMLButtonElement>>('burger');

  protected readonly acctOpen = signal(false);
  private readonly acctBtn = viewChild<ElementRef<HTMLElement>>('acctBtn');

  constructor() {
    // The sheet is a phone layout: leaving it behind when the window widens, or on any navigation, would trap the page.
    const wide = this.doc.defaultView?.matchMedia('(min-width: 1200px)');
    const onWide = (e: MediaQueryListEvent) => e.matches && this.menuOpen.set(false);
    wide?.addEventListener('change', onWide);
    inject(DestroyRef).onDestroy(() => wide?.removeEventListener('change', onWide));
    this.router.events
      .pipe(filter((e) => e instanceof NavigationStart), takeUntilDestroyed())
      .subscribe(() => {
        this.menuOpen.set(false);
        this.acctOpen.set(false);
      });

    let wasOpen = false;
    effect(() => {
      const open = this.menuOpen();
      const d = this.doc;
      d.body.style.overflow = open ? 'hidden' : '';
      // The page behind the sheet is inert so Tab and screen readers stay inside the menu.
      d.querySelectorAll('main, footer').forEach((el) => el.toggleAttribute('inert', open));
      if (open) {
        queueMicrotask(() => d.querySelector<HTMLElement>('#site-nav nav a')?.focus());
      } else if (wasOpen) {
        this.burger()?.nativeElement.focus();
      }
      wasOpen = open;
    });
  }

  protected toggleAcct() {
    this.acctOpen.set(!this.acctOpen());
  }

  protected onEscape() {
    if (this.acctOpen()) {
      this.acctOpen.set(false);
      this.acctBtn()?.nativeElement.focus();
    }
    // The burger takes focus back through the effect when the sheet closes.
    this.menuOpen.set(false);
  }

  protected onDocClick(e: Event) {
    if (this.acctOpen() && !(e.target as Element).closest('.acct')) this.acctOpen.set(false);
  }

  protected signOut() {
    this.acctOpen.set(false);
    this.flow.signOut();
    this.auth.signOut().subscribe({ next: () => this.router.navigate(['/']) });
  }
}
