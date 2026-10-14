import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminProduct, AdminRouteCategory, ApiService, Report, ReportFilter, ReportName } from '../../core/api.service';
import { TranslationKey } from '../../i18n/af';
import { I18nService } from '../../i18n/i18n.service';

const REPORTS: { id: ReportName; label: TranslationKey }[] = [
  { id: 'oorsig', label: 'admin.reportOorsig' },
  { id: 'inskrywings', label: 'admin.reportInskrywings' },
  { id: 'produkte', label: 'admin.reportProdukte' },
];
const EMPTY: ReportFilter = { from: '', to: '', routeCode: '', productId: '' };

/** Oorsig, Inskrywings and Produkte. The server builds each one, charts included, and the PDF is the same report. */
@Component({
  selector: 'vb-admin-reports',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet],
  template: `
    <div class="bar">
      <div class="chips" role="group" [attr.aria-label]="i18n.t('admin.tabReports')">
        @for (r of reports; track r.id) {
          <button class="chip" type="button" [attr.aria-pressed]="name() === r.id" (click)="pick(r.id)">
            {{ i18n.t(r.label) }}
          </button>
        }
      </div>
      <button class="btn btn--accent" type="button" [disabled]="exporting() || !report()" (click)="pdf()">
        {{ i18n.t('admin.reportPdf') }}
      </button>
    </div>

    <div class="card filters">
      <label class="field">
        <span>{{ i18n.t('admin.reportFrom') }}</span>
        <input type="date" [ngModel]="filter().from" (ngModelChange)="set('from', $event)" [max]="filter().to" />
      </label>
      <label class="field">
        <span>{{ i18n.t('admin.reportTo') }}</span>
        <input type="date" [ngModel]="filter().to" (ngModelChange)="set('to', $event)" [min]="filter().from" />
      </label>
      @if (name() === 'inskrywings') {
        <label class="field">
          <span>{{ i18n.t('admin.route') }}</span>
          <select [ngModel]="filter().routeCode" (ngModelChange)="set('routeCode', $event)">
            <option value="">{{ i18n.t('admin.allRoutes') }}</option>
            @for (r of routes(); track r.code) {
              <option [value]="r.code">{{ r.name }}</option>
            }
          </select>
        </label>
      }
      @if (name() === 'produkte') {
        <label class="field">
          <span>{{ i18n.t('admin.tabProducts') }}</span>
          <select [ngModel]="filter().productId" (ngModelChange)="set('productId', $event)">
            <option value="">{{ i18n.t('admin.allProducts') }}</option>
            @for (p of products(); track p.id) {
              <option [value]="'' + p.id">{{ p.name }}</option>
            }
          </select>
        </label>
      }
      <button class="btn btn--ghost" type="button" (click)="clear()">{{ i18n.t('admin.reportClear') }}</button>
    </div>

    @if (report(); as r) {
      <article class="card sheet" [class.is-stale]="loading()">
        <header class="sheet__head">
          <img src="/merk/vasbyt-logo.png" alt="" width="80" height="63" />
          <div>
            <span class="eyebrow">Orania Helpmekaar Vasbyt</span>
            <h2>{{ r.title }}</h2>
            <p class="muted">{{ r.filter }}</p>
          </div>
        </header>

        <div class="tiles">
          @for (t of r.tiles; track t.label) {
            <div class="tile">
              <span>{{ t.label }}</span>
              <strong>{{ t.value }}</strong>
            </div>
          }
        </div>

        @for (b of r.blocks; track $index) {
          <section class="block">
            <h3>{{ b.title }}</h3>
            @if (b.imageUrl && b.table) {
              <div class="pictured">
                <img class="product" [src]="b.imageUrl" alt="" loading="lazy" />
                <ng-container *ngTemplateOutlet="table; context: { $implicit: b.table }" />
              </div>
            }
            @if (b.svg) {
              <img class="chart" [src]="svg(b.svg)" [alt]="b.title" />
            }
            @if (b.table && !b.imageUrl) {
              <ng-container *ngTemplateOutlet="table; context: { $implicit: b.table }" />
            }
          </section>
        }
      </article>
    } @else if (failed()) {
      <p class="alert alert--error" role="alert">{{ i18n.t('admin.loadError') }}</p>
      <button class="btn btn--ghost" type="button" (click)="load()">{{ i18n.t('admin.retry') }}</button>
    } @else {
      <p class="muted" role="status">{{ i18n.t('common.loading') }}</p>
    }

    <ng-template #table let-t>
      <div class="table-scroll">
        <table class="data">
          <thead>
            <tr>
              @for (h of t.headers; track $index) {
                <th [class.num]="$index >= t.textColumns">{{ h }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of t.rows; track $index) {
              <tr>
                @for (c of row; track $index) {
                  <td [class.num]="$index >= t.textColumns">{{ c }}</td>
                }
              </tr>
            }
          </tbody>
          @if (t.footer) {
            <tfoot>
              <tr>
                @for (c of t.footer; track $index) {
                  <td [class.num]="$index >= t.textColumns">{{ c }}</td>
                }
              </tr>
            </tfoot>
          }
        </table>
      </div>
    </ng-template>
  `,
  styles: `
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-4);
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }

    .filters .field {
      flex: 1 1 12rem;
      max-width: 16rem;
      margin: 0;
    }

    .sheet {
      padding: clamp(var(--space-4), 4vw, var(--space-8));
      transition: opacity 0.15s;
    }

    .sheet.is-stale {
      opacity: 0.6;
    }

    .sheet__head {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding-bottom: var(--space-4);
      margin-bottom: var(--space-6);
      border-bottom: 2px solid var(--orange);
    }

    .sheet__head img {
      width: 80px;
      height: auto;
    }

    .sheet__head .eyebrow {
      color: var(--orange-ink);
    }

    .sheet__head h2 {
      margin: 0;
      color: var(--indigo-deep);
    }

    .sheet__head p {
      margin: 0;
    }

    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(10.5rem, 100%), 1fr));
      gap: var(--space-3);
      margin-bottom: var(--space-8);
    }

    .tile {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: var(--space-1);
      padding: var(--space-4);
      border-radius: var(--r-sm);
      background: var(--karoo-sand-light);
    }

    .tile span {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--ink-muted);
    }

    .tile strong {
      font-family: var(--font-display);
      font-size: 1.5rem;
      line-height: 1.1;
      color: var(--indigo-deep);
      font-variant-numeric: tabular-nums;
    }

    .block {
      margin-bottom: var(--space-8);
    }

    .block h3 {
      color: var(--indigo);
      margin-bottom: var(--space-3);
    }

    .chart {
      display: block;
      width: 100%;
      max-width: 900px;
      height: auto;
    }

    .pictured {
      display: grid;
      grid-template-columns: 7.5rem minmax(0, 1fr);
      gap: var(--space-4);
      align-items: start;
      margin-bottom: var(--space-3);
    }

    .product {
      width: 100%;
      aspect-ratio: 1;
      object-fit: contain;
      border-radius: var(--r-sm);
      background: var(--karoo-sand-light);
    }

    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    tfoot td {
      font-weight: 700;
      border-top: 2px solid var(--indigo-deep);
    }
  `,
})
export class AdminReports {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  protected readonly reports = REPORTS;
  protected readonly name = signal<ReportName>('oorsig');
  protected readonly filter = signal<ReportFilter>(EMPTY);
  protected readonly report = signal<Report | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly exporting = signal(false);
  protected readonly routes = signal<AdminRouteCategory[]>([]);
  protected readonly products = signal<AdminProduct[]>([]);
  private latest = 0;

  constructor() {
    this.api.adminRoutes().subscribe((r) => this.routes.set(r));
    this.api.adminProducts().subscribe((p) => this.products.set(p));
    this.load();
  }

  protected pick(name: ReportName) {
    this.name.set(name);
    this.report.set(null);
    this.load();
  }

  protected set(key: keyof ReportFilter, value: string) {
    this.filter.update((f) => ({ ...f, [key]: value ?? '' }));
    this.load();
  }

  protected clear() {
    this.filter.set(EMPTY);
    this.load();
  }

  protected load() {
    const ticket = ++this.latest;
    this.loading.set(true);
    this.failed.set(false);
    this.api.adminReport(this.name(), this.filter()).subscribe({
      next: (r) => {
        if (ticket !== this.latest) return;
        this.report.set(r);
        this.loading.set(false);
      },
      error: () => {
        if (ticket !== this.latest) return;
        this.report.set(null);
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  /** An <img> data URL never runs script, so the server's SVG needs no sanitizer bypass. */
  protected svg(markup: string) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  }

  protected pdf() {
    this.exporting.set(true);
    this.api.adminReportPdf(this.name(), this.filter()).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.name()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.exporting.set(false),
    });
  }
}
