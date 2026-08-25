import { Component, inject } from '@angular/core';
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
          <span class="brand__mark">Vasbyt</span>
          <span class="brand__sub">Orania Helpmekaar</span>
        </a>

        <nav aria-label="Hoof">
          <a routerLink="/" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: true }">
            {{ i18n.t('nav.home') }}
          </a>
          <a routerLink="/roetes" routerLinkActive="is-active">{{ i18n.t('nav.routes') }}</a>
          <a routerLink="/skenk" routerLinkActive="is-active">{{ i18n.t('nav.donate') }}</a>
          @if (auth.isAdmin()) {
            <a routerLink="/admin" routerLinkActive="is-active">{{ i18n.t('nav.admin') }}</a>
          }
          @if (auth.isSignedIn()) {
            <a routerLink="/rekening" routerLinkActive="is-active">{{ i18n.t('nav.account') }}</a>
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
          } @else {
            <a class="btn btn--ghost" routerLink="/teken-aan">{{ i18n.t('nav.login') }}</a>
          }
          <a class="btn btn--accent" routerLink="/registreer">{{ i18n.t('nav.register') }}</a>
        </div>
      </div>
    </header>

    <main id="inhoud">
      <router-outlet />
    </main>

    <footer class="site-footer">
      <div class="container site-footer__inner">
        <p>
          <strong>Vasbyt</strong> · Orania, Noord-Kaap<br />
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p>
        <p>
          Alle opbrengs gaan na
          <a href="https://oraniahelpmekaar.co.za" rel="noopener">Orania Helpmekaar</a>.
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
        border: var(--border);
      }
    }

    .site-header {
      border-bottom: var(--border);
      background: var(--paper);
      position: sticky;
      top: 0;
      z-index: 5;
    }

    .site-header__inner {
      display: flex;
      align-items: center;
      gap: var(--space-8);
      min-height: 76px;
      flex-wrap: wrap;
    }

    .brand {
      text-decoration: none;
      color: var(--ink);
      line-height: 1.1;
      margin-right: auto;
    }

    .brand__mark {
      display: block;
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .brand__sub {
      display: block;
      font-size: 0.6875rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--karoo-stone);
    }

    nav {
      display: flex;
      gap: var(--space-6);
      font-size: 0.9375rem;
      font-weight: 500;
    }

    nav a {
      color: var(--ink);
      text-decoration: none;
      padding-block: var(--space-2);
      border-bottom: 2px solid transparent;

      &:hover {
        color: var(--hm-orange-dark);
      }

      &.is-active {
        border-bottom-color: var(--hm-orange);
      }
    }

    .site-header__actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .lang {
      font-family: var(--font-body);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      background: none;
      border: 1px solid var(--karoo-line);
      border-radius: var(--radius);
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      color: var(--ink);

      &:hover {
        background: var(--karoo-sand-light);
      }
    }

    .site-footer {
      margin-top: var(--space-16);
      border-top: var(--border);
      background: var(--karoo-sand-light);
      padding-block: var(--space-12);
      font-size: 0.875rem;
      color: var(--ink-muted);
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

  protected signOut() {
    this.auth.signOut().subscribe();
  }
}
