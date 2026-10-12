import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { safeReturn } from '../core/auth.service';
import { I18nService } from '../i18n/i18n.service';

type Problem = { status?: number };

/** Asks for a reset link. The server answers the same for a known and an unknown address. */
@Component({
  selector: 'vb-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="container section">
      <h1>{{ i18n.t('auth.forgotTitle') }}</h1>
      <form class="card auth" (ngSubmit)="submit()">
        @if (sent()) {
          <p class="alert alert--ok" role="status">{{ i18n.t('auth.forgotSent') }}</p>
        } @else if (unavailable()) {
          <p class="alert" role="status">{{ i18n.t('auth.recoveryUnavailable') }}</p>
          <p class="contact">
            <a class="btn btn--ghost" [href]="'mailto:' + i18n.t('helpmekaar.email')">{{ i18n.t('helpmekaar.email') }}</a>
            <a class="btn btn--ghost" [href]="'tel:' + i18n.t('helpmekaar.phone')">{{ i18n.t('helpmekaar.phone') }}</a>
          </p>
        } @else {
          <p class="muted">{{ i18n.t('auth.forgotIntro') }}</p>
          @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
          <label class="field">
            <span>{{ i18n.t('auth.email') }}</span>
            <input type="email" name="email" [(ngModel)]="email" required autocomplete="email" />
          </label>
          <button type="submit" class="btn btn--primary btn--block" [disabled]="busy() || !email().trim()">
            {{ busy() ? i18n.t('common.loading') : i18n.t('auth.forgotSubmit') }}
          </button>
        }
        <p class="links"><a routerLink="/teken-aan" [queryParams]="{ terug: back }">{{ i18n.t('auth.backToSignIn') }}</a></p>
      </form>
    </div>
  `,
  styles: `.auth { max-width: 26rem; } .links { margin: var(--space-6) 0 0; } .contact { display: flex; flex-wrap: wrap; gap: var(--space-3); margin: 0; }`,
})
export class ForgotPassword {
  protected readonly i18n = inject(I18nService);
  private api = inject(ApiService);
  protected readonly back = safeReturn(inject(ActivatedRoute).snapshot.queryParamMap.get('terug'));
  protected readonly email = signal('');
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly unavailable = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.api.config().subscribe({ next: (c) => this.unavailable.set(!c.registrationEmails), error: () => {} });
  }

  protected submit() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.forgotPassword(this.email().trim()).subscribe({
      next: () => this.sent.set(true),
      error: (e: Problem) => {
        this.busy.set(false);
        if (e.status === 503) this.unavailable.set(true);
        else this.error.set(this.i18n.t('common.error'));
      },
    });
  }
}

/** Lands from the emailed link, which carries the address and the single-use token. */
@Component({
  selector: 'vb-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="container section">
      <h1>{{ i18n.t('auth.resetTitle') }}</h1>
      <form class="card auth" (ngSubmit)="submit()">
        @if (done()) {
          <p class="alert alert--ok" role="status">{{ i18n.t('auth.resetDone') }}</p>
          <a class="btn btn--primary" routerLink="/teken-aan">{{ i18n.t('auth.submit') }}</a>
        } @else if (!email || !token) {
          <p class="alert alert--error">{{ i18n.t('auth.resetBadLink') }}</p>
          <a routerLink="/wagwoord-vergeet">{{ i18n.t('auth.forgotSubmit') }}</a>
        } @else {
          <p class="muted">{{ email }}</p>
          @if (failed()) {
            <p class="alert alert--error" role="alert">{{ i18n.t('auth.resetFailed') }}</p>
            <p><a routerLink="/wagwoord-vergeet">{{ i18n.t('auth.forgotSubmit') }}</a></p>
          } @else if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
          <label class="field">
            <span>{{ i18n.t('auth.newPassword') }}</span>
            <input type="password" name="password" [(ngModel)]="password" required minlength="8" autocomplete="new-password" />
            <small class="field__hint">{{ i18n.t('entrant.passwordHint') }}</small>
          </label>
          <button type="submit" class="btn btn--primary btn--block" [disabled]="busy() || password().length < 8">
            {{ busy() ? i18n.t('common.loading') : i18n.t('auth.resetSubmit') }}
          </button>
        }
      </form>
    </div>
  `,
  styles: `.auth { max-width: 26rem; }`,
})
export class ResetPassword {
  protected readonly i18n = inject(I18nService);
  private api = inject(ApiService);
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  protected readonly email = this.query.get('email');
  protected readonly token = this.query.get('token');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly failed = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit() {
    if (this.busy() || !this.email || !this.token) return;
    this.busy.set(true);
    this.error.set(null);
    this.failed.set(false);
    this.api.resetPassword(this.email, this.token, this.password()).subscribe({
      next: () => this.done.set(true),
      error: (e: Problem) => {
        this.busy.set(false);
        if (e.status === 400) this.failed.set(true);
        else this.error.set(this.i18n.t('common.error'));
      },
    });
  }
}
