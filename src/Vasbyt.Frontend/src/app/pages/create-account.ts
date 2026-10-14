import { Component, ElementRef, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, safeReturn } from '../core/auth.service';
import { ApiService } from '../core/api.service';
import { Order } from '../core/api.models';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { TranslationKey } from '../i18n/af';

/** An account is optional and creates no order: it only makes later purchases easier to find. */
@Component({
  selector: 'vb-create-account',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="container section">
      <h1>{{ i18n.t('auth.createTitle') }}</h1>
      <p class="lead">{{ i18n.t(invite ? 'auth.inviteIntro' : claim ? 'auth.claimIntro' : 'auth.createIntro') }}</p>
      <p class="muted">{{ i18n.t('common.privacyNotice') }} <a routerLink="/privaatheidsbeleid" target="_blank" rel="noopener">{{ i18n.t('nav.privacy') }}</a>.</p>
      @if (!invite && !claim && back && (!receipt || order())) {
        <p class="muted">{{ context() }}</p>
      }

      <div class="auth-split">
      <form #f="ngForm" class="card auth" (ngSubmit)="submit(f)">
        @if (error()) {
          <p class="alert alert--error" role="alert">{{ error() }}</p>
        }

        @if (order(); as o) {
          <button type="button" class="btn btn--ghost" (click)="useBuyer(o)">
            {{ i18n.t('auth.useBuyer').replace('{name}', o.buyerFirstName + ' ' + o.buyerLastName).replace('{email}', o.buyerEmail) }}
          </button>
        }

        <div class="field-row">
          <label class="field">
            <span>{{ i18n.t('entrant.firstName') }}</span>
            <input type="text" name="firstName" [(ngModel)]="model.firstName" #fn="ngModel" required autocomplete="given-name" />
            @if (fn.invalid && (fn.touched || f.submitted)) {
              <small class="field__error">{{ i18n.t('checkout.required') }}</small>
            }
          </label>
          <label class="field">
            <span>{{ i18n.t('entrant.lastName') }}</span>
            <input type="text" name="lastName" [(ngModel)]="model.lastName" #ln="ngModel" required autocomplete="family-name" />
            @if (ln.invalid && (ln.touched || f.submitted)) {
              <small class="field__error">{{ i18n.t('checkout.required') }}</small>
            }
          </label>
        </div>

        <label class="field">
          <span>{{ i18n.t('auth.email') }}</span>
          <input type="email" name="email" [(ngModel)]="model.email" #em="ngModel" required email autocomplete="email" [readonly]="!!invite || !!claim" />
          @if (em.invalid && (em.touched || f.submitted)) {
            <small class="field__error">{{ i18n.t(em.errors?.['required'] ? 'checkout.required' : 'checkout.emailInvalid') }}</small>
          }
        </label>

        <label class="field">
          <span>{{ i18n.t('auth.createPassword') }}</span>
          <span class="pw">
            <input [type]="show() ? 'text' : 'password'" name="password" [(ngModel)]="model.password" #pw="ngModel" required minlength="8" autocomplete="new-password" />
            <button type="button" class="pw__eye" (click)="show.set(!show())" [attr.aria-label]="i18n.t(show() ? 'auth.hidePassword' : 'auth.showPassword')" [attr.aria-pressed]="show()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
                @if (show()) { <path d="M3 3l18 18" /> }
              </svg>
            </button>
          </span>
          @if (pw.invalid && (pw.touched || f.submitted)) {
            <small class="field__error">{{ i18n.t(pw.errors?.['required'] ? 'checkout.required' : 'auth.passwordShort') }}</small>
          }
          <small class="field__hint">{{ i18n.t('entrant.passwordHint') }}</small>
        </label>

        <button type="submit" class="btn btn--primary btn--block" [disabled]="busy()">
          {{ busy() ? i18n.t('common.loading') : i18n.t('auth.create') }}
        </button>

        <p class="links">
          {{ i18n.t('auth.haveAccount') }} <a routerLink="/teken-aan" [queryParams]="{ terug: back, email: claim ? model.email : null, eis: claim ?? null }">{{ i18n.t('auth.submit') }}</a>
        </p>
        @if (isCheckout) {
          <p class="links"><a routerLink="/bestel">{{ i18n.t('auth.continueGuest') }}</a></p>
        } @else if (order(); as o) {
          <p class="links"><a [routerLink]="back">{{ i18n.t('auth.backToOrder').replace('{ref}', o.reference) }}</a></p>
        }
      </form>
      <img class="auth-photo" src="/foto/vasbyt-saam.webp" alt="" loading="lazy" decoding="async" />
      </div>
    </div>
  `,
  styles: `
    .auth { max-width: 32rem; }
    .links { margin: var(--space-6) 0 0; font-size: 1rem; }
    .auth-split { display: grid; gap: var(--space-8); align-items: start; }
    .auth-photo { display: none; width: 100%; aspect-ratio: 4 / 5; object-fit: cover; border-radius: var(--r-lg); }
    @media (min-width: 1024px) { .auth-split { grid-template-columns: minmax(0, 32rem) minmax(0, 1fr); } .auth-photo { display: block; } }
  `,
})
export class CreateAccount {
  protected readonly i18n = inject(I18nService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  protected readonly back = safeReturn(this.query.get('terug'));
  /** From an admin invite email: the account must use the invited address to become an admin. */
  protected readonly invite = this.query.get('uitnodiging') ?? undefined;
  /** From an order's "create your account" email: proves the address, so its orders join the account. */
  protected readonly claim = this.query.get('eis') ?? undefined;

  private readonly host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  protected readonly isCheckout = this.back === '/bestel';
  protected readonly receipt = this.back?.match(/^\/(?:bestel|registreer)\/([^/?#]+)\/klaar$/)?.[1];
  protected readonly order = signal<Order | null>(null);
  protected readonly show = signal(false);

  // Only checkout prefills from the basket: a receipt belongs to another buyer, so it offers their details instead.
  private readonly buyer = this.isCheckout ? inject(OrderFlowService).cart().buyer : null;
  protected model = { firstName: this.buyer?.firstName ?? '', lastName: this.buyer?.lastName ?? '',
    email: ((this.invite || this.claim) && this.query.get('email')) || this.buyer?.email || '', password: '' };

  constructor() {
    if (this.receipt) inject(ApiService).order(this.receipt).subscribe({ next: (o) => this.order.set(o), error: () => {} });
  }

  protected context() {
    const key = this.isCheckout ? 'auth.returnCheckout' : this.receipt ? 'auth.returnOrder' : 'auth.returnNote';
    return this.i18n.t(key).replace('{ref}', this.order()?.reference ?? '');
  }

  protected useBuyer(o: Order) {
    Object.assign(this.model, { firstName: o.buyerFirstName, lastName: o.buyerLastName, email: o.buyerEmail });
  }
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(form: NgForm) {
    if (form.invalid) {
      this.error.set(this.i18n.t('auth.fixFields'));
      this.host.querySelector<HTMLElement>('input.ng-invalid')?.focus();
      return;
    }
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.auth.createAccount({ ...this.model, email: this.model.email.trim(), invite: this.invite, claim: this.claim }).subscribe({
      next: (u) => this.router.navigateByUrl(this.back ?? (u.roles.includes('Admin') ? '/admin' : '/rekening')),
      error: (e: { error?: { code?: string } }) => {
        this.busy.set(false);
        const messages: Record<string, TranslationKey> = {
          'registration.email_duplicate': this.claim ? 'auth.claimHaveAccount' : 'auth.registrationDuplicate',
          'registration.claim_invalid': 'auth.claimExpired',
          'registration.email_invalid': 'auth.registrationEmail',
          'registration.password_requirements': 'auth.registrationPassword',
          'registration.invitation_invalid': 'auth.registrationInvite',
          'registration.failed': 'auth.registrationFailed',
        };
        const code = e.error?.code ?? '';
        this.error.set(this.i18n.t(Object.hasOwn(messages, code) ? messages[code] : 'common.error'));
      },
    });
  }
}
