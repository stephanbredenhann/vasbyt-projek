import { CurrencyPipe } from '@angular/common';
import { Component, inject, output, signal } from '@angular/core';
import { AdminStats } from '../../core/api.models';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../i18n/i18n.service';

/** The numbers the organisers ask for, including the split of entry, product and donation money. */
@Component({
  selector: 'vb-admin-overview',
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    @if (stats(); as s) {
      <div class="tiles">
        <div class="card tile">
          <span class="eyebrow">{{ i18n.t('admin.entrants') }}</span>
          <strong>{{ s.entrants }}</strong>
        </div>
        <div class="card tile">
          <span class="eyebrow">{{ i18n.t('admin.paidOrders') }}</span>
          <strong>{{ s.paidOrders }}</strong>
        </div>
        <div class="card tile">
          <span class="eyebrow">{{ i18n.t('admin.pendingOrders') }}</span>
          <strong>{{ s.pendingOrders }}</strong>
        </div>
        <div class="card tile" [class.is-warn]="s.unfilledForms > 0">
          <span class="eyebrow">{{ i18n.t('admin.unfilled') }}</span>
          <strong>{{ s.unfilledForms }}</strong>
        </div>
      </div>

      @if (s.unfilledForms > 0) {
        <div class="card follow">
          <p class="muted">{{ i18n.t('admin.unfilledNote') }}</p>
          <button class="btn btn--ghost" type="button" (click)="followUp.emit()">
            {{ i18n.t('admin.followUp') }}
          </button>
        </div>
      }

      <div class="tiles">
        <div class="card tile">
          <span class="eyebrow">{{ i18n.t('admin.totalRevenue') }}</span>
          <strong>{{ s.totalRevenueZar | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</strong>
        </div>
        <div class="card tile">
          <span class="eyebrow">{{ i18n.t('admin.entryRevenue') }}</span>
          <strong>{{ s.entryRevenueZar | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</strong>
        </div>
        <div class="card tile">
          <span class="eyebrow">{{ i18n.t('admin.productRevenue') }}</span>
          <strong>{{ s.productRevenueZar | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</strong>
        </div>
        <div class="card tile">
          <span class="eyebrow">{{ i18n.t('admin.donationRevenue') }}</span>
          <strong>{{ s.donationRevenueZar | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</strong>
        </div>
      </div>

      <h2>{{ i18n.t('admin.byRoute') }}</h2>
      @if (s.byRoute.length) {
        <div class="card table-scroll">
          <table class="data">
            <thead>
              <tr>
                <th>{{ i18n.t('admin.route') }}</th>
                <th>{{ i18n.t('admin.code') }}</th>
                <th class="num">{{ i18n.t('admin.entrants') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of s.byRoute; track row.code) {
                <tr>
                  <td>{{ row.name }}</td>
                  <td>{{ row.code }}</td>
                  <td class="num">{{ row.count }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="muted">{{ i18n.t('admin.noData') }}</p>
      }
    }
  `,
  styles: `
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
      gap: var(--space-4);
      margin-bottom: var(--space-8);
    }

    .tile {
      padding: var(--space-6);
    }

    .tile strong {
      display: block;
      font-family: var(--font-display);
      font-size: 2rem;
      line-height: 1.1;
      color: var(--indigo-deep);
      font-variant-numeric: tabular-nums;
    }

    .tile.is-warn strong {
      color: var(--danger);
    }

    .follow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-6);
      flex-wrap: wrap;
      padding: var(--space-4) var(--space-6);
      margin-bottom: var(--space-8);
    }

    .follow p {
      margin: 0;
      font-size: 0.9375rem;
    }

    h2 {
      margin-top: var(--space-12);
    }

    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class AdminOverview {
  readonly followUp = output<void>();

  protected readonly i18n = inject(I18nService);
  protected readonly stats = signal<AdminStats | null>(null);

  constructor() {
    inject(ApiService)
      .adminStats()
      .subscribe((s) => this.stats.set(s));
  }
}
