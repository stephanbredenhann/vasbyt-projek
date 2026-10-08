import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, safeReturn } from '../core/auth.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';

/** An account is optional and creates no order: it only makes later purchases easier to find. */
@Component({
  selector: 'vb-create-account',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="container section">
      <h1>{{ i18n.t('auth.createTitle') }}</h1>
      <p class="lead">{{ i18n.t(back ? 'auth.returnNote' : 'auth.createIntro') }}</p>

      <form #f="ngForm" class="card auth" (ngSubmit)="submit(f)">
        @if (error()) {
          <p class="alert alert--error" role="alert">{{ error() }}</p>
        }

        <div class="field-row">
          <label class="field">
            <span>{{ i18n.t('entrant.firstName') }}</span>
            <input type="text" name="firstName" [(ngModel)]="model.firstName" required autocomplete="given-name" />
          </label>
          <label class="field">
            <span>{{ i18n.t('entrant.lastName') }}</span>
            <input type="text" name="lastName" [(ngModel)]="model.lastName" required autocomplete="family-name" />
          </label>
        </div>

        <label class="field">
          <span>{{ i18n.t('auth.email') }}</span>
          <input type="email" name="email" [(ngModel)]="model.email" required email autocomplete="email" />
        </label>

        <label class="field">
          <span>{{ i18n.t('auth.password') }}</span>
          <input type="password" name="password" [(ngModel)]="model.password" required minlength="8" autocomplete="new-password" />
          <small class="field__hint">{{ i18n.t('entrant.passwordHint') }}</small>
        </label>

        <button type="submit" class="btn btn--primary btn--block" [disabled]="busy()">
          {{ busy() ? i18n.t('common.loading') : i18n.t('auth.create') }}
        </button>

        <p class="links">
          {{ i18n.t('auth.haveAccount') }} <a routerLink="/teken-aan" [queryParams]="{ terug: back }">{{ i18n.t('auth.submit') }}</a>
        </p>
      </form>
    </div>
  `,
  styles: `
    .auth { max-width: 32rem; }
    .links { margin: var(--space-6) 0 0; font-size: 0.9375rem; }
  `,
})
export class CreateAccount {
  protected readonly i18n = inject(I18nService);
  private auth = inject(AuthService);
  private router = inject(Router);
  protected readonly back = safeReturn(inject(ActivatedRoute).snapshot.queryParamMap.get('terug'));

  // Starts from what the buyer already typed at checkout, so nobody types their name twice.
  private readonly buyer = inject(OrderFlowService).cart().buyer;
  protected model = { firstName: this.buyer.firstName, lastName: this.buyer.lastName, email: this.buyer.email, password: '' };
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(form: NgForm) {
    if (form.invalid) {
      this.error.set(this.i18n.t('auth.fixFields'));
      return;
    }
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.auth.createAccount({ ...this.model, email: this.model.email.trim() }).subscribe({
      next: () => this.router.navigateByUrl(this.back ?? '/rekening'),
      error: (e: { error?: { detail?: string } }) => {
        this.busy.set(false);
        this.error.set(e.error?.detail ?? this.i18n.t('common.error'));
      },
    });
  }
}
