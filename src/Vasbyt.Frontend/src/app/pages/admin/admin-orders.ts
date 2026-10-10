import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminOrder, OrderLine, OrderLineKind, OrderStatus } from '../../core/api.models';
import { ApiService } from '../../core/api.service';
import { TranslationKey } from '../../i18n/af';
import { I18nService } from '../../i18n/i18n.service';

const STATUS: Record<OrderStatus, TranslationKey> = {
  Pending: 'admin.statusPending',
  Paid: 'admin.statusPaid',
  Cancelled: 'admin.statusCancelled',
};

/** Reconciliation. Payment and forms are two axes, so they get two columns and never one word. */
@Component({
  selector: 'vb-admin-orders',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule],
  template: `
    <h2>{{ i18n.t('admin.ordersTitle') }}</h2>
    <p class="lead">{{ i18n.t('admin.ordersIntro') }}</p>

    <form class="card controls" (ngSubmit)="search()">
      <label class="field">
        <span>{{ i18n.t('admin.orderSearch') }}</span>
        <input type="search" name="q" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      </label>
      <label class="field">
        <span>{{ i18n.t('admin.payment') }}</span>
        <select name="status" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); search()">
          <option value="">{{ i18n.t('admin.allStatuses') }}</option>
          <option value="Pending">{{ i18n.t('admin.statusPending') }}</option>
          <option value="Paid">{{ i18n.t('admin.statusPaid') }}</option>
          <option value="Cancelled">{{ i18n.t('admin.statusCancelled') }}</option>
        </select>
      </label>
      <button class="btn btn--primary" type="submit">{{ i18n.t('admin.searchButton') }}</button>
    </form>

    @if (loaded() === null) {
      <p class="muted" role="status">{{ i18n.t('common.loading') }}</p>
    } @else if (loaded() === false) {
      <p class="alert alert--error" role="alert">{{ i18n.t('admin.loadError') }}</p>
      <button class="btn btn--ghost" type="button" (click)="load()">{{ i18n.t('admin.retry') }}</button>
    } @else if (orders().length) {
      <div class="card table-scroll">
        <table class="data data--stack">
          <thead>
            <tr>
              <th>{{ i18n.t('admin.reference') }}</th>
              <th>{{ i18n.t('admin.buyer') }}</th>
              <th>{{ i18n.t('admin.created') }}</th>
              <th class="num">{{ i18n.t('admin.total') }}</th>
              <th>{{ i18n.t('admin.payment') }}</th>
              <th>{{ i18n.t('admin.forms') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (o of orders(); track o.id) {
              <tr>
                <td class="primary">{{ o.reference }}</td>
                <td [attr.data-label]="i18n.t('admin.buyer')">
                  {{ o.buyerFirstName }} {{ o.buyerLastName }}
                  <span class="muted block">{{ o.buyerEmail }}</span>
                </td>
                <td [attr.data-label]="i18n.t('admin.created')">{{ o.createdUtc | date: 'yyyy-MM-dd' }}</td>
                <td class="num" [attr.data-label]="i18n.t('admin.total')">{{ o.totalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</td>
                <td [attr.data-label]="i18n.t('admin.payment')">
                  <span class="chip" [class.chip--accent]="o.status === 'Paid'">
                    {{ i18n.t(status(o.status)) }}
                  </span>
                  @if (o.paidUtc) {
                    <span class="muted block">{{ o.paidUtc | date: 'yyyy-MM-dd HH:mm' }}</span>
                  }
                  @if (o.paymentReference) {
                    <span class="muted block">{{ o.paymentReference }}</span>
                  }
                </td>
                <td [attr.data-label]="i18n.t('admin.forms')">
                  @if (o.status !== 'Paid') {
                    <span class="chip chip--quiet">{{ i18n.t('admin.formsNone') }}</span>
                  } @else if (!hasTickets(o)) {
                    <span class="chip chip--quiet">{{ i18n.t('admin.formsNotNeeded') }}</span>
                  } @else if (o.formsOutstanding > 0) {
                    <span class="chip chip--blue">
                      {{ o.formsOutstanding }} {{ i18n.t('admin.formsOutstanding') }}
                    </span>
                  } @else {
                    <span class="chip">{{ i18n.t('admin.formsDone') }}</span>
                  }
                </td>
                <td class="actions-cell">
                  <button class="btn btn--ghost btn--sm" type="button" (click)="toggle(o.id)">
                    {{ i18n.t(open() === o.id ? 'admin.hideLines' : 'admin.showLines') }}
                  </button>
                  <a class="btn btn--ghost btn--sm" [href]="'/bestel/' + o.publicToken + '/klaar'" target="_blank" rel="noopener">
                    {{ i18n.t('admin.customerView') }}
                  </a>
                </td>
              </tr>
              @if (open() === o.id) {
                <tr>
                  <td colspan="7">
                    <ul class="lines">
                      @for (l of o.lines; track l.id) {
                        <li>
                          <span>{{ l.quantity }} × {{ l.description }}</span>
                          <span class="chip chip--quiet">{{ i18n.t(kind(l.kind)) }}</span>
                          <span class="num grow">
                            {{ l.lineTotalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}
                          </span>
                          @if (l.kind === 'Product' && o.status === 'Paid') {
                            <button class="btn btn--ghost btn--sm" type="button" [attr.aria-pressed]="l.collectedQuantity >= l.quantity" (click)="collect(o, l)">
                              {{ i18n.t(l.collectedQuantity >= l.quantity ? 'admin.collected' : 'admin.markCollected') }}
                            </button>
                          }
                        </li>
                      }
                    </ul>
                    @if (collectError()) { <p class="alert alert--error" role="alert">{{ collectError() }}</p> }
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <div class="pager">
        <button class="btn btn--ghost" type="button" [disabled]="page() === 1" (click)="go(-1)">
          {{ i18n.t('admin.prev') }}
        </button>
        <span class="muted">{{ i18n.t('admin.page') }} {{ page() }} · {{ total() }} {{ i18n.t('admin.rows') }}</span>
        <button class="btn btn--ghost" type="button" [disabled]="page() * size >= total()" (click)="go(1)">
          {{ i18n.t('admin.next') }}
        </button>
      </div>
    } @else {
      <p class="muted">{{ i18n.t('admin.noOrders') }}</p>
    }
  `,
  styles: `
    .controls { display: flex; flex-wrap: wrap; align-items: end; gap: var(--space-4); margin-bottom: var(--space-6); }
    .controls .field { margin-bottom: 0; min-width: min(20rem, 100%); }
    .controls .btn { min-height: var(--touch); }

    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .block {
      display: block;
      font-size: 0.9375rem;
    }

    .lines {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .lines li {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding-block: var(--space-2);
    }

    .grow {
      margin-left: auto;
    }

    .btn--sm {
      padding: var(--space-2) var(--space-4);
      font-size: 0.9375rem;
    }

    .pager {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin-top: var(--space-4);
    }
  `,
})
export class AdminOrders implements OnInit {
  protected readonly i18n = inject(I18nService);
  protected readonly orders = signal<AdminOrder[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly open = signal(0);
  protected readonly size = 25;

  private api = inject(ApiService);

  readonly initialStatus = input<OrderStatus | ''>('');
  protected readonly q = signal('');
  protected readonly statusFilter = signal<OrderStatus | ''>('');
  /** Null while loading, so an empty list never reads as "no orders" before the answer arrives. */
  protected readonly loaded = signal<boolean | null>(null);

  private static readonly KIND: Record<OrderLineKind, TranslationKey> = {
    Ticket: 'admin.kindTicket', Product: 'admin.kindProduct', Donation: 'admin.kindDonation',
  };
  protected kind(k: OrderLineKind) { return AdminOrders.KIND[k]; }

  ngOnInit() {
    this.statusFilter.set(this.initialStatus());
    this.load();
  }

  protected search() {
    this.page.set(1);
    this.load();
  }

  protected status(s: OrderStatus) {
    return STATUS[s];
  }

  protected readonly collectError = signal<string | null>(null);

  protected hasTickets(o: AdminOrder) { return o.lines.some((l) => l.kind === 'Ticket'); }

  /** Collection is tracked apart from payment and forms: a shop order is done once it is picked up. */
  protected collect(o: AdminOrder, l: OrderLine) {
    this.collectError.set(null);
    const collectedQuantity = l.collectedQuantity >= l.quantity ? 0 : l.quantity;
    this.api.adminCollect(o.id, [{ orderLineId: l.id, collectedQuantity }]).subscribe({
      next: () => { l.collectedQuantity = collectedQuantity; this.orders.update((list) => [...list]); },
      error: (e: { error?: { detail?: string } }) => this.collectError.set(e.error?.detail ?? this.i18n.t('common.error')),
    });
  }

  protected toggle(id: number) {
    this.open.set(this.open() === id ? 0 : id);
  }

  protected go(step: number) {
    this.page.update((p) => p + step);
    this.load();
  }

  protected load() {
    this.loaded.set(null);
    this.api.adminOrders(this.page(), this.size, this.q().trim(), this.statusFilter()).subscribe({
      next: (r) => { this.orders.set(r.items); this.total.set(r.total); this.loaded.set(true); },
      error: () => this.loaded.set(false),
    });
  }
}
