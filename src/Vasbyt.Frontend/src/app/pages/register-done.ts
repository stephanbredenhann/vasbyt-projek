import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Order } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { Steps } from './steps';
import { QrPass } from '../shared/qr-pass';
import { EventDay, downloadIcs, eventDays, eventOver } from '../shared/calendar';

/**
 * The receipt for every kind of order: entry, shop, donation or a mix. Spec 8.2 allows a paid order
 * to sit with its forms still blank, so outstanding forms are listed with a way straight back into
 * them, and only a completed form carries an entry number.
 */
@Component({
  selector: 'vb-register-done',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, Steps, QrPass],
  template: `
    <div class="container section">
      <vb-steps current="done" [tickets]="kind() === 'event'" />

      @if (order(); as o) {
        @if (o.status !== 'Paid') {
          <!-- Never a success screen for an order that has not been paid. -->
          <h1>{{ i18n.t(o.status === 'Cancelled' ? 'account.statusCancelled' : 'done.notPaidTitle') }}</h1>
          <p class="alert">{{ i18n.t(o.status === 'Cancelled' ? 'pay.cancelled' : 'done.notPaidBody') }}</p>
          @if (o.status === 'Pending') {
            <a class="btn btn--accent" [routerLink]="['/bestel', o.token, 'betaal']">{{ i18n.t('account.payNow') }}</a>
          } @else {
            <a class="btn btn--primary" routerLink="/mandjie">{{ i18n.t('basket.title') }}</a>
          }
        } @else {
        <h1>{{ i18n.t(kind() === 'event' ? 'done.title' : kind() === 'shop' ? 'done.shopTitle' : 'done.donationTitle') }}</h1>
        <p class="lead">{{ i18n.t(kind() === 'event' ? 'done.body' : kind() === 'shop' ? 'done.shopBody' : 'done.donationBody') }}</p>
        @if (kind() === 'event' && calendarOpen()) {
          <button type="button" class="btn btn--ghost calendar" (click)="addToCalendar()">{{ i18n.t('common.addCalendar') }}</button>
        }
        @if (o.confirmationEmailSentUtc) { <p class="alert alert--ok">{{ i18n.t('done.emailSent') }} {{ o.buyerEmail }}</p> }
        @else if (emailEnabled() && !outstanding().length) {
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
          @if (hasProducts()) { <p class="muted collect">{{ i18n.t('shop.collectNote') }} {{ i18n.t('done.collectRef') }}</p> }
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
          @if (auth.isSignedIn()) {
            <a class="btn btn--primary" routerLink="/rekening">{{ i18n.t('done.viewAccount') }}</a>
          }
        } @else {
          <!-- Optional: the order is complete without it. Linking is an explicit action by a signed-in owner. -->
          <div class="card panel">
            <h2>{{ i18n.t('claim.title') }}</h2>
            <p class="muted">{{ i18n.t('claim.body') }}</p>
            @if (claimError()) {
              <p class="alert alert--error" role="alert">{{ claimError() }}</p>
            }
            @if (auth.user(); as u) {
              <button type="button" class="btn btn--primary" [disabled]="claiming()" (click)="link(o)">
                {{ claiming() ? i18n.t('claim.saving') : i18n.t('claim.link') }} ({{ u.email }})
              </button>
            } @else {
              <div class="claim-actions">
                <a class="btn btn--primary" routerLink="/skep-rekening" [queryParams]="{ terug: here }">{{ i18n.t('auth.create') }}</a>
                <a class="btn btn--ghost" routerLink="/teken-aan" [queryParams]="{ terug: here }">{{ i18n.t('auth.submit') }}</a>
              </div>
              <p class="muted hint">{{ i18n.t('claim.returnHint') }}</p>
            }
          </div>
        }
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
      font-size: 0.9375rem;
    }

    .collect { margin: var(--space-4) 0 0; font-size: 0.9375rem; }
    .calendar { min-height: 44px; margin-bottom: var(--space-6); }
    .claim-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }

    .number {
      font-family: var(--font-display);
      font-size: 1.25rem;
      letter-spacing: 0.02em;
    }
  `,
})
export class RegisterDone {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  private api = inject(ApiService);
  private flow = inject(OrderFlowService);
  private router = inject(Router);

  protected readonly here = this.router.url;
  protected readonly emailEnabled = signal(false);
  protected readonly emailBusy = signal(false);
  protected readonly emailError = signal(false);
  protected readonly order = signal<Order | null>(null);
  protected readonly days = signal<EventDay[]>([]);
  protected readonly datesConfirmed = signal(false);
  protected readonly error = signal<string | null>(null);
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

  protected readonly hasProducts = computed(() => this.order()?.lines.some((l) => l.kind === 'Product') ?? false);

  /** Which receipt this is: tickets make it an entry, else products a shop order, else a donation. */
  protected readonly kind = computed(() => {
    const lines = this.order()?.lines ?? [];
    return lines.some((l) => l.kind === 'Ticket') ? 'event' : lines.some((l) => l.kind === 'Product') ? 'shop' : 'donation';
  });

  constructor() {
    this.api.config().subscribe({
      next: config => { this.emailEnabled.set(config.registrationEmails); this.datesConfirmed.set(config.datesConfirmed); },
      error: () => {},
    });
    this.api.routes().subscribe({ next: (r) => this.days.set(eventDays(r)), error: () => {} });
    const token = inject(ActivatedRoute).snapshot.paramMap.get('token')!;
    this.api.order(token).subscribe({
      next: (o) => {
        this.order.set(o);
        // Releases this order's own pointer only; a newer basket or order in this browser is untouched.
        if (o.status !== 'Pending') this.flow.clearPending(o.token);
      },
      error: () => this.error.set(this.i18n.t('pay.noOrder')),
    });
  }

  /** Hidden once the last event day is over; only tests the clock on each change detection. */
  protected calendarOpen() {
    return this.days().length > 0 && !eventOver(this.days(), Date.now());
  }

  protected addToCalendar() {
    downloadIcs(this.days(), this.datesConfirmed());
  }

  protected retryEmail(order: Order) {
    if (this.emailBusy()) return;
    this.emailBusy.set(true); this.emailError.set(false);
    this.api.retryConfirmation(order.token).subscribe({
      next: updated => { this.order.set(updated); this.emailBusy.set(false); this.emailError.set(!updated.confirmationEmailSentUtc); },
      error: () => { this.emailBusy.set(false); this.emailError.set(true); },
    });
  }

  /** Holding the private link plus being signed in is what proves ownership; the buyer email is not. */
  protected link(order: Order) {
    if (this.claiming()) return;
    this.claiming.set(true);
    this.claimError.set(null);
    this.api.linkOrder(order.token).subscribe({
      next: (linked) => {
        this.claiming.set(false);
        this.order.set(linked);
      },
      error: (e: { error?: { detail?: string } }) => {
        this.claiming.set(false);
        this.claimError.set(e.error?.detail ?? this.i18n.t('common.error'));
      },
    });
  }
}
