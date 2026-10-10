import { CurrencyPipe, DatePipe, formatDate } from '@angular/common';
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
  imports: [CurrencyPipe, DatePipe, RouterLink, Steps, QrPass],
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

        <section class="card glance" aria-labelledby="glance-title">
          <h2 id="glance-title" class="visually-hidden">{{ i18n.t('done.glance') }}</h2>
          <dl>
            <div>
              <dt>{{ i18n.t('pay.reference') }}</dt>
              <dd class="reference">{{ o.reference }}</dd>
            </div>
            <div>
              <dt>{{ i18n.t('done.status') }}</dt>
              <dd class="paid">
                <span aria-hidden="true">✓</span> {{ i18n.t('account.statusPaid') }}
                @if (o.paidUtc) {
                  <span class="sub">{{ i18n.t('done.paidOn') }} {{ o.paidUtc | date: 'd MMMM y, HH:mm' : '+0200' : i18n.locale() }}</span>
                }
              </dd>
            </div>
            <div>
              <dt>{{ i18n.t('reg.total') }}</dt>
              <dd>{{ o.totalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
            </div>
            @if (kind() === 'event' && eventDates()) {
              <div>
                <dt>{{ i18n.t('done.when') }}</dt>
                <dd>{{ eventDates() }} @if (!datesConfirmed()) { <span class="sub">{{ i18n.t('done.datesProvisional') }}</span> }</dd>
              </div>
            }
            <div>
              <dt>{{ i18n.t('done.emailTo') }}</dt>
              <dd>
                {{ o.buyerEmail }}
                @if (!o.confirmationEmailSentUtc) { <span class="sub">{{ i18n.t('done.emailNotYet') }}</span> }
              </dd>
            </div>
          </dl>
        </section>

        @if (hasNext()) {
          <section class="card panel next" aria-labelledby="next-title">
            <h2 id="next-title">{{ i18n.t('done.nextTitle') }}</h2>
            <ol>
              @if (o.entrants.length) {
                <li [class.is-done]="!outstanding().length">
                  <strong>{{ i18n.t('done.stepForms') }}</strong>
                  @if (outstanding().length) {
                    <span class="sub">{{ outstanding().length }} {{ i18n.t('done.stepFormsLeft') }}</span>
                    <ul class="forms">
                      @for (e of outstanding(); track e.id) {
                        <li>
                          <span><strong>{{ i18n.t('reg.entrant') }} {{ e.n }}</strong> <span class="sub">{{ e.routeName }}</span></span>
                          <a class="btn btn--accent" [routerLink]="['/registreer', o.token, 'deelnemer', e.n]">{{ i18n.t('done.fillIn') }}</a>
                        </li>
                      }
                    </ul>
                  } @else {
                    <span class="sub"><span aria-hidden="true">✓</span> {{ i18n.t('done.allDone') }}</span>
                  }
                </li>
                <li>
                  {{ i18n.t(completed().length ? 'done.stepPasses' : 'done.stepPassesWait') }}
                </li>
              }
              @if (hasProducts()) {
                <li>{{ i18n.t('done.stepCollect') }}</li>
              }
              @if (kind() === 'event' && calendarOpen()) {
                <li>
                  {{ i18n.t('done.stepCalendar') }}
                  <button type="button" class="btn btn--ghost calendar" (click)="addToCalendar()">{{ i18n.t('common.addCalendar') }}</button>
                </li>
              }
            </ol>
          </section>
        }

        @if (completed().length) {
          <section class="passes">
            <h2>{{ i18n.t('pass.title') }}</h2>
            <p>{{ i18n.t('pass.intro') }}</p>
            @for (e of completed(); track e.id) {
              @if (e.qrPayload) { <vb-qr-pass [entrant]="e" /> }
            }
          </section>
        }

        <section class="card panel" aria-labelledby="receipt-title">
          <h2 id="receipt-title">{{ i18n.t('done.receipt') }}</h2>
          <dl class="lines">
            @for (l of o.lines; track l.id) {
              <dt>
                {{ l.quantity }} × {{ l.description }}
                @if (l.kind === 'Product') {
                  <span class="sub">{{ i18n.t(l.collectedQuantity >= l.quantity ? 'done.collected' : 'done.toCollect') }}</span>
                }
              </dt>
              <dd>{{ l.lineTotalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
            }
            <dt class="is-total">{{ i18n.t('reg.total') }}</dt>
            <dd class="is-total">{{ o.totalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</dd>
          </dl>
        </section>

        @if (!o.confirmationEmailSentUtc && emailEnabled() && !outstanding().length) {
          <div class="panel">
            <p>{{ i18n.t('done.emailPending') }}</p>
            <button type="button" class="btn btn--ghost" (click)="retryEmail(o)" [disabled]="emailBusy()">{{ i18n.t(emailBusy() ? 'common.loading' : 'done.emailRetry') }}</button>
            @if (emailError()) { <p class="alert alert--error" role="alert">{{ i18n.t('done.emailFailed') }}</p> }
          </div>
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
    .panel, .glance, .passes { max-width: 44rem; margin-bottom: var(--space-8); }
    .glance dl { display: grid; gap: var(--space-4); margin: 0; }
    .glance dl > div { display: grid; grid-template-columns: minmax(8rem, 12rem) 1fr; gap: var(--space-4); align-items: baseline; }
    .glance dl > div + div { padding-top: var(--space-4); border-top: 1px solid var(--rule); }
    .glance dt { color: var(--ink-muted); font-size: 1rem; }
    .glance dd { margin: 0; font-size: 1.1875rem; font-weight: 600; overflow-wrap: anywhere; }
    .reference { font-size: 1.5rem; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; }
    .paid { color: var(--ok); }
    .sub { display: block; font-size: 1rem; font-weight: 400; color: var(--ink); }
    @media (max-width: 480px) { .glance dl > div { grid-template-columns: 1fr; gap: var(--space-1); } }

    h2 { font-size: 1.5rem; }
    .next ol { margin: 0; padding-left: 1.5rem; display: grid; gap: var(--space-4); font-size: 1.0625rem; }
    .next ol > li::marker { font-weight: 700; color: var(--indigo-deep); }
    .next .is-done > strong { color: var(--ok); }
    .forms { list-style: none; margin: var(--space-3) 0 0; padding: 0; }
    .forms li { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; padding: var(--space-3) 0; border-top: 1px solid var(--rule); }
    .forms .btn, .calendar, .panel .btn { min-height: 48px; }
    .calendar { display: flex; margin-top: var(--space-3); }

    vb-qr-pass { display: block; margin-bottom: var(--space-4); }

    .lines { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-3) 0; margin: 0; font-size: 1.0625rem; }
    .lines dt { padding-right: var(--space-4); }
    .lines dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
    .lines .is-total { padding-top: var(--space-3); border-top: 1px solid var(--rule); font-weight: 700; font-size: 1.1875rem; }

    .claim-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }
    .hint { font-size: 1rem; }
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

  /** "29 April tot 1 Mei 2027" from the route days, in the reader's language. */
  protected readonly eventDates = computed(() => {
    const d = this.days();
    if (!d.length) return '';
    const fmt = (iso: string) => formatDate(iso, 'd MMMM y', this.i18n.locale());
    const first = fmt(d[0].dateLocal), last = fmt(d[d.length - 1].dateLocal);
    return first === last ? first : `${first} ${this.i18n.t('done.to')} ${last}`;
  });

  /** Anything left to do: forms, passes, collection or the calendar. A pure donation has none. */
  protected readonly hasNext = computed(() => (this.order()?.entrants.length ?? 0) > 0 || this.hasProducts());

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
