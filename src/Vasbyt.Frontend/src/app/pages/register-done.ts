import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Order } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { Steps } from './steps';
import { QrPass } from '../shared/qr-pass';

/**
 * Step 7 of 7. Spec 8.2 allows a paid order to sit with its forms still blank, so this screen has to
 * be honest about that rather than declaring the entry finished: the outstanding forms are listed
 * with a way straight back into them, and only a completed form carries an entry number.
 */
@Component({
  selector: 'vb-register-done',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, RouterLink, Steps, QrPass],
  template: `
    <div class="container section">
      <vb-steps [current]="7" />

      @if (order(); as o) {
        <h1>{{ i18n.t('done.title') }}</h1>
        <p class="lead">{{ i18n.t('done.body') }}</p>
        @if (o.confirmationEmailSentUtc) { <p class="alert alert--ok">{{ i18n.t('done.emailSent') }} {{ o.buyerEmail }}</p> }
        @else if (emailEnabled() && o.status === 'Paid' && !outstanding().length) {
          <p class="muted">{{ i18n.t('done.emailPending') }}</p>
          <button type="button" class="btn btn--ghost" (click)="retryEmail(o)" [disabled]="emailBusy()">{{ i18n.t(emailBusy() ? 'common.loading' : 'done.emailRetry') }}</button>
          @if (emailError()) { <p class="alert alert--error" role="alert">{{ i18n.t('done.emailPending') }}</p> }
        }

        <div class="card panel">
          <p class="eyebrow">{{ i18n.t('pay.reference') }}</p>
          <p class="reference">{{ o.reference }}</p>
          <dl class="lines">
            @for (l of o.lines; track l.id) {
              <dt>{{ l.description }} <span class="muted">× {{ l.quantity }}</span></dt>
              <dd>{{ l.lineTotalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
            }
            <dt class="is-total">{{ i18n.t('reg.total') }}</dt>
            <dd class="is-total">{{ o.totalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
          </dl>
        </div>

        @if (outstanding().length) {
          <div class="card card--accent panel">
            <h2>{{ i18n.t('done.outstanding') }}</h2>
            <p class="muted">{{ i18n.t('done.outstandingBody') }}</p>
            <ul>
              @for (e of outstanding(); track e.id) {
                <li>
                  <span>
                    <strong>{{ i18n.t('reg.entrant') }} {{ e.n }}</strong>
                    <span class="muted">{{ e.routeName }}</span>
                  </span>
                  <a class="btn btn--accent" [routerLink]="['/registreer', o.token, 'deelnemer', e.n]">
                    {{ i18n.t('done.fillIn') }}
                  </a>
                </li>
              }
            </ul>
          </div>
        } @else if (o.entrants.length) {
          <p class="alert alert--ok">{{ i18n.t('done.allDone') }}</p>
        }

        @if (completed().length) {
          <div class="card panel">
            <h2>{{ i18n.t('entrant.entryNumber') }}</h2>
            <ul>
              @for (e of completed(); track e.id) {
                <li>
                  <span>
                    <strong>{{ e.firstName }} {{ e.lastName }}</strong>
                    <span class="muted">{{ e.routeName }}</span>
                  </span>
                  <span class="number">{{ e.entryNumber }}</span>
                </li>
              }
            </ul>
          </div>
        }

        @if (completed().length) {
          <section class="passes">
            <h2>{{ i18n.t('pass.title') }}</h2>
            <p class="muted">{{ i18n.t('pass.intro') }}</p>
            @for (e of completed(); track e.id) {
              @if (e.qrPayload) { <vb-qr-pass [entrant]="e" /> }
            }
          </section>
        }

        @if (o.isClaimed) {
          <p class="alert alert--ok">{{ i18n.t('claim.claimed') }}</p>
          <a class="btn btn--primary" routerLink="/rekening">{{ i18n.t('done.viewAccount') }}</a>
        } @else {
          <!-- Optional by design: the entry numbers above are already issued, an account only makes
               the order easy to find again. -->
          <form #f="ngForm" class="card panel" (ngSubmit)="claim(f, o)">
            <h2>{{ i18n.t('claim.title') }}</h2>
            <p class="muted">{{ i18n.t('claim.body') }}</p>

            @if (claimError()) {
              <p class="alert alert--error">{{ claimError() }}</p>
            }

            <label class="field">
              <span>{{ i18n.t('entrant.email') }}</span>
              <input type="email" name="email" [value]="o.buyerEmail" readonly
                     autocomplete="username" />
            </label>

            <label class="field">
              <span>{{ i18n.t('entrant.password') }}</span>
              <input type="password" name="password" [(ngModel)]="password" required minlength="8"
                     autocomplete="new-password" />
              <small class="field__hint">{{ i18n.t('entrant.passwordHint') }}</small>
            </label>

            <p class="muted hint">{{ i18n.t('claim.existingHint') }}</p>

            <button type="submit" class="btn btn--primary" [disabled]="claiming() || f.invalid">
              {{ claiming() ? i18n.t('claim.saving') : i18n.t('claim.button') }}
            </button>
          </form>
        }
      } @else if (error()) {
        <p class="alert alert--error">{{ error() }}</p>
      } @else {
        <p class="muted">{{ i18n.t('common.loading') }}</p>
      }
    </div>
  `,
  styles: `
    .passes { max-width: 52rem; margin-bottom: var(--space-8); }
    vb-qr-pass { display: block; margin-bottom: var(--space-4); }
    .panel {
      max-width: 40rem;
      margin-bottom: var(--space-6);
    }

    .reference {
      font-family: var(--font-display);
      font-size: clamp(1.75rem, 5vw, 2.5rem);
      letter-spacing: 0.02em;
      margin: 0;
    }

    h2 {
      font-size: 1.375rem;
    }

    .lines {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: var(--space-2) 0;
      margin: var(--space-6) 0 0;
      font-size: 0.9375rem;
    }

    .lines dt {
      padding-right: var(--space-4);
    }

    .lines dd {
      margin: 0;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .lines .is-total {
      padding-top: var(--space-3);
      border-top: 1px solid var(--rule);
      font-weight: 700;
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
      padding: var(--space-3) 0;
    }

    li + li {
      border-top: 1px solid var(--rule);
    }

    li > span {
      display: flex;
      flex-direction: column;
    }

    .hint {
      font-size: 0.8125rem;
    }

    .number {
      font-family: var(--font-display);
      font-size: 1.25rem;
      letter-spacing: 0.02em;
    }
  `,
})
export class RegisterDone {
  protected readonly i18n = inject(I18nService);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private flow = inject(OrderFlowService);

  protected readonly emailEnabled = signal(false);
  protected readonly emailBusy = signal(false);
  protected readonly emailError = signal(false);
  protected readonly order = signal<Order | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly password = signal('');
  protected readonly claiming = signal(false);
  protected readonly claimError = signal<string | null>(null);

  protected readonly outstanding = computed(() =>
    (this.order()?.entrants ?? [])
      .map((e, i) => ({ ...e, n: i + 1 }))
      .filter((e) => !e.isComplete),
  );

  protected readonly completed = computed(() =>
    (this.order()?.entrants ?? []).filter((e) => e.isComplete),
  );

  constructor() {
    this.api.config().subscribe({ next: config => this.emailEnabled.set(config.registrationEmails), error: () => {} });
    const token = inject(ActivatedRoute).snapshot.paramMap.get('token')!;
    this.api
      .order(token)
      .subscribe({
        next: (o) => {
          this.order.set(o);
          // Only a finished order releases the token: an outstanding form still needs to be resumed.
          if (o.entrants.every((e) => e.isComplete)) this.flow.token = null;
        },
        error: () => this.error.set(this.i18n.t('common.error')),
      });
  }

  protected retryEmail(order: Order) {
    if (this.emailBusy()) return;
    this.emailBusy.set(true); this.emailError.set(false);
    this.api.retryConfirmation(order.token).subscribe({
      next: updated => { this.order.set(updated); this.emailBusy.set(false); this.emailError.set(!updated.confirmationEmailSentUtc); },
      error: () => { this.emailBusy.set(false); this.emailError.set(true); },
    });
  }

  /**
   * The endpoint registers or signs in, whichever the email needs, and attaches the order either
   * way. A wrong password on an existing account comes back 401 and a rejected new one 400, both
   * carrying an Afrikaans detail that already says the right thing, so it is shown as sent.
   */
  protected claim(form: NgForm, order: Order) {
    if (form.invalid) return;
    this.claiming.set(true);
    this.claimError.set(null);

    this.api
      .claimOrder(order.token, {
        email: order.buyerEmail,
        password: this.password(),
        firstName: order.buyerFirstName,
        lastName: order.buyerLastName,
      })
      .subscribe({
        next: (claimed) => {
          this.claiming.set(false);
          this.password.set('');
          this.order.set(claimed);
          // The server signed the cookie in, so the header has to catch up with it.
          this.auth.refresh().subscribe();
        },
        error: (e: { error?: { detail?: string } }) => {
          this.claiming.set(false);
          this.claimError.set(e.error?.detail ?? this.i18n.t('common.error'));
        },
      });
  }
}
