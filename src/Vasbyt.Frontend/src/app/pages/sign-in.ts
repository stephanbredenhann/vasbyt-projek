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
    </div>
  `,
  styles: `
    .auth { max-width: 26rem; }
    .links { display: flex; flex-direction: column; gap: var(--space-2); margin: var(--space-6) 0 0; font-size: 0.9375rem; }
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
      error: (e: { error?: { detail?: string } }) => {
        this.busy.set(false);
        this.error.set(e.error?.detail ?? this.i18n.t('common.error'));
      },
    });
  }
}
