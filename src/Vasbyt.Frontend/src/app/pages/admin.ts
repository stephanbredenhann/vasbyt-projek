import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminEntrant, AdminStats } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { I18nService } from '../i18n/i18n.service';

/** Skeleton back office: the numbers the organisers ask for, and a searchable entrant list. */
@Component({
  selector: 'vb-admin',
  standalone: true,
  imports: [FormsModule, CurrencyPipe],
  template: `
    <div class="container section">
      <h1>{{ i18n.t('admin.title') }}</h1>

      @if (stats(); as s) {
        <div class="tiles">
          <div class="tile">
            <span class="eyebrow">{{ i18n.t('admin.entrants') }}</span>
            <strong>{{ s.entrants }}</strong>
          </div>
          <div class="tile">
            <span class="eyebrow">{{ i18n.t('admin.paidOrders') }}</span>
            <strong>{{ s.paidOrders }}</strong>
          </div>
          <div class="tile">
            <span class="eyebrow">{{ i18n.t('admin.unfilled') }}</span>
            <strong>{{ s.unfilledSlots }}</strong>
          </div>
          <div class="tile">
            <span class="eyebrow">{{ i18n.t('admin.entryRevenue') }}</span>
            <strong>{{ s.entryRevenueZar | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</strong>
          </div>
          <div class="tile">
            <span class="eyebrow">{{ i18n.t('admin.donationRevenue') }}</span>
            <strong>{{ s.donationRevenueZar | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</strong>
          </div>
        </div>

        <h2>{{ i18n.t('admin.byDistance') }}</h2>
        <div class="table-scroll">
          <table class="data">
            <tbody>
              @for (row of s.byDistance; track row.name + row.distance) {
                <tr>
                  <td>{{ row.name }}</td>
                  <td>{{ row.distance }}</td>
                  <td>{{ row.count }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <h2>{{ i18n.t('admin.entrants') }}</h2>
      <label class="field search">
        <span class="visually-hidden">{{ i18n.t('admin.search') }}</span>
        <input type="search" [ngModel]="q()" (ngModelChange)="search($event)" [placeholder]="i18n.t('admin.search')" />
      </label>

      <div class="table-scroll">
        <table class="data">
          <thead>
            <tr>
              <th>{{ i18n.t('entrant.firstName') }}</th>
              <th>{{ i18n.t('entrant.lastName') }}</th>
              <th>{{ i18n.t('entrant.email') }}</th>
              <th>{{ i18n.t('entrant.phone') }}</th>
              <th>{{ i18n.t('pay.event') }}</th>
              <th>{{ i18n.t('routes.distance') }}</th>
              <th>{{ i18n.t('entrant.town') }}</th>
              <th>{{ i18n.t('entrant.province') }}</th>
              <th>{{ i18n.t('entrant.shirt') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (e of entrants(); track e.id) {
              <tr>
                <td>{{ e.firstName }}</td>
                <td>{{ e.lastName }}</td>
                <td>{{ e.email }}</td>
                <td>{{ e.phone }}</td>
                <td>{{ e.event }}</td>
                <td>{{ e.distance }}</td>
                <td>{{ e.town }}</td>
                <td>{{ e.province }}</td>
                <td>{{ e.shirtSize }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <p class="muted">{{ entrants().length }} / {{ total() }}</p>
    </div>
  `,
  styles: `
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--space-4);
      margin-bottom: var(--space-12);
    }

    .tile {
      border: var(--border);
      border-left: 3px solid var(--hm-orange);
      border-radius: var(--radius);
      padding: var(--space-4);
    }

    .tile strong {
      display: block;
      font-family: var(--font-display);
      font-size: 1.75rem;
      line-height: 1.1;
    }

    .search {
      max-width: 24rem;
    }

    h2 {
      margin-top: var(--space-12);
    }
  `,
})
export class Admin {
  protected readonly i18n = inject(I18nService);
  private api = inject(ApiService);

  protected readonly stats = signal<AdminStats | null>(null);
  protected readonly entrants = signal<AdminEntrant[]>([]);
  protected readonly total = signal(0);
  protected readonly q = signal('');

  constructor() {
    this.api.adminStats().subscribe((s) => this.stats.set(s));
    this.load();
  }

  protected search(q: string) {
    this.q.set(q);
    this.load();
  }

  // ponytail: no debounce and no paging control — one page of 100 covers a field this size.
  // Add both when the entrant list outgrows a single screen.
  private load() {
    this.api.adminEntrants(this.q(), 1, 100).subscribe((r) => {
      this.entrants.set(r.items);
      this.total.set(r.total);
    });
  }
}
