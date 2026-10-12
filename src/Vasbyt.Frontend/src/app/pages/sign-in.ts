import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, safeReturn } from '../core/auth.service';
import { I18nService } from '../i18n/i18n.service';

/** Signing in from the basket or a receipt returns there, so the account never interrupts a purchase. */
@Component({
  selector: 'vb-sign-in',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="container section">
      <h1>{{ i18n.t('auth.title') }}</h1>
      @if (back) { <p class="lead">{{ i18n.t('auth.returnNote') }}</p> }

      <div class="auth-split">
      <form class="card auth" (ngSubmit)="submit()">
        @if (error()) {
          <p class="alert alert--error" role="alert">{{ error() }}</p>
        }

        <label class="field">
          <span>{{ i18n.t('auth.email') }}</span>
          <input type="email" name="email" [(ngModel)]="email" required autocomplete="email" />
        </label>

        <label class="field">
          <span>{{ i18n.t('auth.password') }}</span>
          <input type="password" name="password" [(ngModel)]="password" required autocomplete="current-password" />
        </label>

        <button type="submit" class="btn btn--primary btn--block" [disabled]="busy()">
          {{ busy() ? i18n.t('common.loading') : i18n.t('auth.submit') }}
        </button>

        <p class="links">
          <a routerLink="/wagwoord-vergeet" [queryParams]="{ terug: back }">{{ i18n.t('auth.forgot') }}</a>
          <span>{{ i18n.t('auth.noAccount') }} <a routerLink="/skep-rekening" [queryParams]="{ terug: back }">{{ i18n.t('auth.create') }}</a></span>
        </p>
      </form>
      <img class="auth-photo" src="/foto/vasbyt-saam.webp" alt="" loading="lazy" decoding="async" />
      </div>
    </div>
  `,
  styles: `
    .auth { max-width: 26rem; }
    .links { display: flex; flex-direction: column; gap: var(--space-2); margin: var(--space-6) 0 0; font-size: 0.9375rem; }
    .auth-split { display: grid; gap: var(--space-8); align-items: start; }
    .auth-photo { display: none; width: 100%; aspect-ratio: 4 / 5; max-height: 32rem; object-fit: cover; border-radius: var(--r-lg); }
    @media (min-width: 1024px) { .auth-split { grid-template-columns: minmax(0, 26rem) minmax(0, 1fr); } .auth-photo { display: block; } }
  `,
})
export class SignIn {
  protected readonly i18n = inject(I18nService);
  private auth = inject(AuthService);
  private router = inject(Router);
  protected readonly back = safeReturn(inject(ActivatedRoute).snapshot.queryParamMap.get('terug'));

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.auth.signIn(this.email().trim(), this.password()).subscribe({
      next: (u) => this.router.navigateByUrl(this.back ?? (u.roles.includes('Admin') ? '/admin' : '/rekening')),
      error: (e: { status?: number }) => {
        this.busy.set(false);
        this.error.set(this.i18n.t(e.status === 401 ? 'auth.wrongCredentials' : e.status === 423 ? 'auth.lockedOut' : 'common.error'));
      },
    });
  }
}
