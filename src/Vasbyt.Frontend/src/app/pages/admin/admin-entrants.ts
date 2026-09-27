import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminEntrant, OrderStatus, PROVINCES, RouteCategory } from '../../core/api.models';
import { ApiService } from '../../core/api.service';
import { TranslationKey } from '../../i18n/af';
import { I18nService } from '../../i18n/i18n.service';

const STATUS: Record<OrderStatus, TranslationKey> = {
  Pending: 'admin.statusPending',
  Paid: 'admin.statusPaid',
  Cancelled: 'admin.statusCancelled',
};

/**
 * Spec 11: the identity number and the four medical fields never sit in the scanning table. They
 * live in a per-participant panel somebody has to open on purpose. The CSV still carries the lot.
 */
@Component({
  selector: 'vb-admin-entrants',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h2>{{ i18n.t('admin.tabEntrants') }}</h2>

    <div class="card controls">
      <label class="field">
        <span>{{ i18n.t('admin.search') }}</span>
        <input
          type="search"
          [ngModel]="q()"
          (ngModelChange)="q.set($event)"
          (change)="reload()"
          (keyup.enter)="reload()"
        />
      </label>

      <label class="check">
        <input type="checkbox" [ngModel]="onlyIncomplete()" (ngModelChange)="setIncomplete($event)" />
        <span>{{ i18n.t('admin.incompleteOnly') }}</span>
      </label>

      <div class="chips">
        <button
          class="chip"
          type="button"
          [attr.aria-selected]="!routeCode()"
          (click)="routeCode.set('')"
        >
          {{ i18n.t('admin.allRoutes') }}
        </button>
        @for (r of routes(); track r.code) {
          <button
            class="chip"
            type="button"
            [attr.aria-selected]="routeCode() === r.code"
            (click)="routeCode.set(r.code)"
          >
            {{ r.name }}
          </button>
        }
      </div>
      <p class="field__hint">{{ i18n.t('admin.filterNote') }}</p>
    </div>

    <div class="card export">
      <h3>{{ i18n.t('admin.exportTitle') }}</h3>
      <p class="muted">{{ i18n.t('admin.exportNote') }}</p>
      <div class="export__row">
        <label class="field">
          <span class="visually-hidden">{{ i18n.t('admin.route') }}</span>
          <select [(ngModel)]="exportRoute">
            <option value="">{{ i18n.t('admin.allRoutes') }}</option>
            @for (r of routes(); track r.code) {
              <option [value]="r.code">{{ r.name }}</option>
            }
          </select>
        </label>
        <button class="btn btn--accent" type="button" [disabled]="exporting()" (click)="exportCsv()">
          {{ i18n.t('admin.export') }}
        </button>
      </div>
    </div>

    @if (visible().length) {
      <div class="card table-scroll">
        <table class="data">
          <thead>
            <tr>
              <th>{{ i18n.t('admin.entryNumber') }}</th>
              <th>{{ i18n.t('admin.name') }}</th>
              <th>{{ i18n.t('admin.route') }}</th>
              <th>{{ i18n.t('admin.tariff') }}</th>
              <th>{{ i18n.t('admin.town') }}</th>
              <th>{{ i18n.t('admin.order') }}</th>
              <th>{{ i18n.t('admin.formStatus') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (e of visible(); track e.id) {
              <tr>
                <td>{{ e.entryNumber }}</td>
                <td>
                  @if (e.firstName || e.lastName) {
                    {{ e.firstName }} {{ e.lastName }}
                  } @else {
                    <span class="muted">{{ i18n.t('admin.blankForm') }}</span>
                  }
                </td>
                <td>{{ e.route }}</td>
                <td>{{ i18n.t(e.tariff === 'Student' ? 'admin.student' : 'admin.normal') }}</td>
                <td>{{ e.town }}</td>
                <td>
                  {{ e.orderReference }}
                  <span class="chip chip--quiet">{{ i18n.t(status(e.orderStatus)) }}</span>
                </td>
                <td>
                  <span class="chip" [class.chip--accent]="!e.isComplete">
                    {{ i18n.t(e.isComplete ? 'admin.complete' : 'admin.incomplete') }}
                  </span>
                </td>
                <td>
                  <button class="btn btn--ghost btn--sm" type="button" (click)="toggle(e)">
                    {{ i18n.t(draft()?.id === e.id ? 'admin.close' : 'admin.open') }}
                  </button>
                </td>
              </tr>

              @if (draft(); as d) {
                @if (d.id === e.id) {
                  <tr>
                    <td colspan="8" class="detail-cell">
                      <div class="card card--danger detail">
                        <h3>{{ i18n.t('admin.detailTitle') }}</h3>
                        <p class="notice">{{ i18n.t('admin.privacyNotice') }}</p>

                        <dl class="fixed">
                          <div>
                            <dt>{{ i18n.t('admin.idNumber') }}</dt>
                            <dd>{{ d.idNumber }}</dd>
                          </div>
                          <div>
                            <dt>{{ i18n.t('admin.dateOfBirth') }}</dt>
                            <dd>{{ d.dateOfBirth }}</dd>
                          </div>
                          <div>
                            <dt>{{ i18n.t('admin.gender') }}</dt>
                            <dd>{{ d.gender }}</dd>
                          </div>
                          <div>
                            <dt>{{ i18n.t('admin.route') }}</dt>
                            <dd>{{ d.route }}</dd>
                          </div>
                        </dl>
                        <p class="field__hint">{{ i18n.t('admin.fixedNote') }}</p>

                        <div class="field-row">
                          <label class="field">
                            <span>{{ i18n.t('admin.firstName') }}</span>
                            <input type="text" [(ngModel)]="d.firstName" />
                          </label>
                          <label class="field">
                            <span>{{ i18n.t('admin.lastName') }}</span>
                            <input type="text" [(ngModel)]="d.lastName" />
                          </label>
                          <label class="field">
                            <span>{{ i18n.t('admin.email') }}</span>
                            <input type="email" [(ngModel)]="d.email" />
                          </label>
                          <label class="field">
                            <span>{{ i18n.t('admin.phone') }}</span>
                            <input type="tel" [(ngModel)]="d.phone" />
                          </label>
                          <label class="field">
                            <span>{{ i18n.t('admin.shirtSize') }}</span>
                            <input type="text" [(ngModel)]="d.shirtSize" />
                          </label>
                          <label class="field">
                            <span>{{ i18n.t('admin.clubName') }}</span>
                            <input type="text" [(ngModel)]="d.clubName" />
                          </label>
                          <label class="field">
                            <span>{{ i18n.t('admin.streetAddress') }}</span>
                            <input type="text" [(ngModel)]="d.streetAddress" />
                          </label>
                          <label class="field">
                            <span>{{ i18n.t('admin.town') }}</span>
                            <input type="text" [(ngModel)]="d.town" />
                          </label>
                          <label class="field">
                            <span>{{ i18n.t('admin.province') }}</span>
                            <select [(ngModel)]="d.province">
                              @for (p of provinces; track p) {
                                <option [value]="p">{{ p }}</option>
                              }
                            </select>
                          </label>
                          <label class="field">
                            <span>{{ i18n.t('admin.postalCode') }}</span>
                            <input type="text" [(ngModel)]="d.postalCode" />
                          </label>
                        </div>

                        <h4>{{ i18n.t('admin.medical') }}</h4>
                        <div class="field-row">
                          <label class="field">
                            <span>{{ i18n.t('admin.medicalConditions') }}</span>
                            <input type="text" [(ngModel)]="d.medicalConditions" />
                          </label>
                          <label class="field">
                            <span>{{ i18n.t('admin.medication') }}</span>
                            <input type="text" [(ngModel)]="d.medication" />
                          </label>
                          <label class="field">
                            <span>{{ i18n.t('admin.medicalFund') }}</span>
                            <input type="text" [(ngModel)]="d.medicalFund" />
                          </label>
                          <label class="field">
                            <span>{{ i18n.t('admin.medicalFundNumber') }}</span>
                            <input type="text" [(ngModel)]="d.medicalFundNumber" />
                          </label>
                        </div>

                        <h4>{{ i18n.t('admin.emergency') }}</h4>
                        <div class="field-row">
                          <label class="field">
                            <span>{{ i18n.t('admin.emergencyName') }}</span>
                            <input type="text" [(ngModel)]="d.emergencyName" />
                          </label>
                          <label class="field">
                            <span>{{ i18n.t('admin.emergencyRelationship') }}</span>
                            <input type="text" [(ngModel)]="d.emergencyRelationship" />
                          </label>
                          <label class="field">
                            <span>{{ i18n.t('admin.emergencyPhone') }}</span>
                            <input type="tel" [(ngModel)]="d.emergencyPhone" />
                          </label>
                        </div>

                        @if (error(); as msg) {
                          <p class="alert alert--error">{{ msg }}</p>
                        }
                        <div class="actions">
                          <button class="btn btn--primary" type="button" (click)="save(d)">
                            {{ i18n.t('admin.save') }}
                          </button>
                          <button class="btn btn--ghost" type="button" (click)="draft.set(null)">
                            {{ i18n.t('admin.close') }}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                }
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
      <p class="muted">{{ i18n.t('admin.noEntrants') }}</p>
    }
  `,
  styles: `
    h2 {
      margin-bottom: var(--space-6);
    }

    .controls,
    .export {
      margin-bottom: var(--space-6);
    }

    .controls .field {
      max-width: 24rem;
    }

    .check {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: 0.9375rem;
      margin-bottom: var(--space-4);
    }

    .check input {
      width: auto;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .export__row {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: var(--space-4);
    }

    .export__row .field {
      margin-bottom: 0;
      min-width: 14rem;
    }

    .btn--sm {
      padding: var(--space-2) var(--space-4);
      font-size: 0.8125rem;
    }

    .detail-cell {
      padding: var(--space-4) 0;
    }

    .detail {
      min-width: 18rem;
    }

    .notice {
      font-size: 0.875rem;
      color: var(--danger);
    }

    .fixed {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
      gap: var(--space-4);
      margin: 0 0 var(--space-2);
    }

    dt {
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }

    dd {
      margin: var(--space-1) 0 0;
      font-weight: 600;
    }

    h4 {
      margin-top: var(--space-6);
    }

    .actions {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
    }

    .pager {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin-top: var(--space-4);
    }
  `,
})
export class AdminEntrants implements OnInit {
  /** The overview's follow-up tile lands here with the unfinished forms already filtered. */
  readonly incompleteOnly = input(false);

  protected readonly i18n = inject(I18nService);
  protected readonly provinces = PROVINCES;

  protected readonly entrants = signal<AdminEntrant[]>([]);
  protected readonly routes = signal<RouteCategory[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly q = signal('');
  protected readonly routeCode = signal('');
  protected readonly onlyIncomplete = signal(false);
  protected readonly draft = signal<AdminEntrant | null>(null);
  protected readonly error = signal('');
  protected readonly exporting = signal(false);
  protected exportRoute = '';
  protected readonly size = 100;

  // ponytail: the API has no routeCode filter, so the chips narrow the page already loaded.
  // The export is server-side and always complete, which is the list that actually gets used.
  protected readonly visible = computed(() => {
    const code = this.routeCode();
    return code ? this.entrants().filter((e) => e.routeCode === code) : this.entrants();
  });

  private api = inject(ApiService);

  // An input is not bound yet in the constructor, so the follow-up flag is read here instead.
  ngOnInit() {
    this.onlyIncomplete.set(this.incompleteOnly());
    this.load();
    this.api.routes().subscribe((r) => this.routes.set(r));
  }

  protected status(s: OrderStatus) {
    return STATUS[s];
  }

  protected setIncomplete(on: boolean) {
    this.onlyIncomplete.set(on);
    this.reload();
  }

  protected reload() {
    this.page.set(1);
    this.load();
  }

  protected go(step: number) {
    this.page.update((p) => p + step);
    this.load();
  }

  protected toggle(e: AdminEntrant) {
    this.error.set('');
    this.draft.set(this.draft()?.id === e.id ? null : { ...e });
  }

  protected save(d: AdminEntrant) {
    this.error.set('');
    this.api.adminUpdateEntrant(d.id, d).subscribe({
      next: () => {
        this.entrants.update((list) => list.map((e) => (e.id === d.id ? { ...d } : e)));
        this.draft.set(null);
      },
      error: (e: { error?: { detail?: string } }) =>
        this.error.set(e.error?.detail ?? this.i18n.t('common.error')),
    });
  }

  protected exportCsv() {
    this.exporting.set(true);
    this.api.adminExportEntrants(this.exportRoute || undefined).subscribe({
      next: (csv) => {
        this.exporting.set(false);
        this.download(csv, `deelnemers-${this.exportRoute || 'alle'}.csv`);
      },
      error: () => this.exporting.set(false),
    });
  }

  /** The endpoint answers text, so the file is built here rather than navigated to. */
  private download(csv: string, name: string) {
    // The response body's byte order mark is eaten by the text decoder, so put it back: it is
    // what makes Excel read the Afrikaans column headers as UTF-8 instead of mangling them.
    const body = csv.startsWith('\uFEFF') ? csv : `\uFEFF${csv}`;
    const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  private load() {
    this.draft.set(null);
    this.api.adminEntrants(this.q(), this.page(), this.size, this.onlyIncomplete()).subscribe((r) => {
      this.entrants.set(r.items);
      this.total.set(r.total);
    });
  }
}
