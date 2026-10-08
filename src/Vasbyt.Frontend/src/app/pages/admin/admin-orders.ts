import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { AdminOrder, OrderLine, OrderStatus } from '../../core/api.models';
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
  imports: [CurrencyPipe, DatePipe],
  template: `
    <h2>{{ i18n.t('admin.ordersTitle') }}</h2>
    <p class="lead">{{ i18n.t('admin.ordersIntro') }}</p>

    @if (orders().length) {
      <div class="card table-scroll">
        <table class="data">
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
                <td>{{ o.reference }}</td>
                <td>
                  {{ o.buyerFirstName }} {{ o.buyerLastName }}
                  <span class="muted block">{{ o.buyerEmail }}</span>
                </td>
                <td>{{ o.createdUtc | date: 'yyyy-MM-dd' }}</td>
                <td class="num">{{ o.totalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</td>
                <td>
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
                <td>
                  @if (o.status !== 'Paid') {
                    <span class="chip chip--quiet">{{ i18n.t('admin.formsNone') }}</span>
                  } @else if (!hasTickets(o)) {
                    <span class="chip chip--quiet">{{ i18n.t('admin.formsNotNeeded') }}</span>
                  } @else if (blankForms(o.reference) > 0) {
                    <span class="chip chip--blue">
                      {{ blankForms(o.reference) }} {{ i18n.t('admin.formsOutstanding') }}
                    </span>
                  } @else {
                    <span class="chip">{{ i18n.t('admin.formsDone') }}</span>
                  }
                </td>
                <td>
                  <button class="btn btn--ghost btn--sm" type="button" (click)="toggle(o.id)">
                    {{ i18n.t(open() === o.id ? 'admin.hideLines' : 'admin.showLines') }}
                  </button>
                </td>
              </tr>
              @if (open() === o.id) {
                <tr>
                  <td colspan="7">
                    <ul class="lines">
                      @for (l of o.lines; track l.id) {
                        <li>
                          <span>{{ l.quantity }} × {{ l.description }}</span>
                          <span class="chip chip--quiet">{{ l.kind }}</span>
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
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .block {
      display: block;
      font-size: 0.8125rem;
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
      font-size: 0.8125rem;
    }

    .pager {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin-top: var(--space-4);
    }
  `,
})
export class AdminOrders {
  protected readonly i18n = inject(I18nService);
  protected readonly orders = signal<AdminOrder[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly open = signal(0);
  /** Order reference to the number of forms still blank on it. */
  protected readonly outstanding = signal(new Map<string, number>());
  protected readonly size = 25;

  private api = inject(ApiService);

  constructor() {
    this.load();
    // ponytail: one 200-row sweep of the unfinished forms is enough for a field this size.
    // Add a per-order form count to /api/admin/orders if the follow-up list ever outgrows it.
    this.api.adminEntrants('', 1, 200, true).subscribe((r) => {
      const counts = new Map<string, number>();
      for (const e of r.items) counts.set(e.orderReference, (counts.get(e.orderReference) ?? 0) + 1);
      this.outstanding.set(counts);
    });
  }

  protected blankForms(reference: string) {
    return this.outstanding().get(reference) ?? 0;
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

  private load() {
    this.api.adminOrders(this.page(), this.size).subscribe((r) => {
      this.orders.set(r.items);
      this.total.set(r.total);
    });
  }
}
