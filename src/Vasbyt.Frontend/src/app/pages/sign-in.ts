import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
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
        @if (claim) { <p class="muted">{{ i18n.t('auth.claimSignIn') }}</p> }
        @if (error()) {
          <p class="alert alert--error" role="alert">{{ error() }}</p>
        }

        <label class="field">
          <span>{{ i18n.t('auth.email') }}</span>
          <input type="email" name="email" [(ngModel)]="email" required autocomplete="email" />
        </label>

        @if (byCode()) {
          @if (codeSent()) {
            <p class="alert alert--ok" role="status">{{ i18n.t('auth.codeSent') }}</p>
            <label class="field">
              <span>{{ i18n.t('auth.code') }}</span>
              <input type="text" name="code" [(ngModel)]="code" required inputmode="numeric" autocomplete="one-time-code" maxlength="6" />
            </label>
          }
        } @else {
          <label class="field">
            <span>{{ i18n.t('auth.password') }}</span>
            <span class="pw">
              <input [type]="show() ? 'text' : 'password'" name="password" [(ngModel)]="password" required autocomplete="current-password" />
              <button type="button" class="pw__eye" (click)="show.set(!show())" [attr.aria-label]="i18n.t(show() ? 'auth.hidePassword' : 'auth.showPassword')" [attr.aria-pressed]="show()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
                  @if (show()) { <path d="M3 3l18 18" /> }
                </svg>
              </button>
            </span>
          </label>
        }

        <button type="submit" class="btn btn--primary btn--block" [disabled]="busy()">
          {{ busy() ? i18n.t('common.loading') : i18n.t(byCode() && !codeSent() ? 'auth.sendCode' : 'auth.submit') }}
        </button>
        @if (byCode() && codeSent()) {
          <button type="button" class="btn btn--ghost btn--block" (click)="sendCode()" [disabled]="busy()">{{ i18n.t('auth.resendCode') }}</button>
        }
        <button type="button" class="btn btn--ghost btn--block" (click)="toggleCode()">
          {{ i18n.t(byCode() ? 'auth.usePassword' : 'auth.useCode') }}
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
    .auth .btn + .btn { margin-top: var(--space-3); }
    .auth .btn--ghost { padding: var(--space-3) var(--space-8); text-wrap: balance; }
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
  private readonly api = inject(ApiService);
  protected readonly back = safeReturn(inject(ActivatedRoute).snapshot.queryParamMap.get('terug'));

  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  /** The "create your account" link, carried here when that address already has an account. */
  protected readonly claim = this.query.get('eis') ?? undefined;
  protected readonly email = signal(this.query.get('email') ?? '');
  protected readonly password = signal('');
  protected readonly show = signal(false);
  protected readonly code = signal('');
  protected readonly byCode = signal(false);
  protected readonly codeSent = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected toggleCode() {
    this.byCode.set(!this.byCode());
    this.codeSent.set(false);
    this.error.set(null);
  }

  protected sendCode() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.requestCode(this.email().trim()).subscribe({
      next: () => { this.busy.set(false); this.codeSent.set(true); },
      error: (e: { status?: number }) => this.fail(e),
    });
  }

  protected submit() {
    if (this.byCode() && !this.codeSent()) return this.sendCode();
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const email = this.email().trim();
    (this.byCode() ? this.auth.signInWithCode(email, this.code().trim()) : this.auth.signIn(email, this.password(), this.claim)).subscribe({
      next: (u) => this.router.navigateByUrl(this.back ?? (u.roles.includes('Admin') ? '/admin' : '/rekening')),
      error: (e: { status?: number }) => this.fail(e),
    });
  }

  private fail(e: { status?: number }) {
    this.busy.set(false);
    this.error.set(this.i18n.t(e.status === 401 ? 'auth.wrongCredentials' : e.status === 423 ? 'auth.lockedOut'
      : e.status === 400 && this.byCode() ? 'auth.codeInvalid' : e.status === 503 ? 'auth.codeUnavailable' : 'common.error'));
  }
}
