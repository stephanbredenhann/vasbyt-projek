import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminRouteCategory, AdminRouteDay, ApiService } from '../../core/api.service';
import { I18nService } from '../../i18n/i18n.service';

type DayDraft = Omit<AdminRouteDay, 'id' | 'gpxFileName'> & { id?: number };
type RouteDraft = Omit<AdminRouteCategory, 'days'> & { days: DayDraft[]; error?: string };

/**
 * Update only for the six categories: their codes are what the SPA and the GPX filenames key off.
 * Days are the exception, because ligstap and vasstap were seeded with none at all.
 */
@Component({
  selector: 'vb-admin-routes',
  standalone: true,
  imports: [FormsModule],
  template: `
    <h2>{{ i18n.t('admin.routesTitle') }}</h2>
    <p class="lead">{{ i18n.t('admin.routesIntro') }}</p>

    @for (r of routes(); track r.id) {
      <article class="card route">
        <header>
          <span class="chip chip--quiet">{{ r.code }}</span>
          <span class="chip" [class.chip--accent]="r.isOpen">
            {{ i18n.t(r.isOpen ? 'admin.isOpen' : 'admin.closed') }}
          </span>
        </header>

        <div class="field-row">
          <label class="field">
            <span>{{ i18n.t('admin.name') }}</span>
            <input type="text" [(ngModel)]="r.name" />
          </label>
          <label class="field">
            <span>{{ i18n.t('admin.difficulty') }}</span>
            <input type="text" [(ngModel)]="r.difficulty" />
          </label>
          <label class="field">
            <span>{{ i18n.t('admin.distanceKm') }}</span>
            <input type="number" step="0.1" [(ngModel)]="r.totalDistanceKm" />
          </label>
          <label class="field">
            <span>{{ i18n.t('admin.elevationM') }}</span>
            <input type="number" step="1" [(ngModel)]="r.elevationGainM" />
          </label>
          <label class="field">
            <span>{{ i18n.t('admin.sortOrder') }}</span>
            <input type="number" step="1" [(ngModel)]="r.sortOrder" />
          </label>
        </div>

        <label class="field">
          <span>{{ i18n.t('admin.blurb') }}</span>
          <textarea [(ngModel)]="r.blurb"></textarea>
        </label>

        <label class="check">
          <input type="checkbox" [(ngModel)]="r.isOpen" />
          <span>{{ i18n.t('admin.isOpen') }}</span>
        </label>
        <p class="field__hint">{{ i18n.t('admin.isOpenNote') }}</p>

        <div class="actions">
          <button class="btn btn--primary" type="button" (click)="save(r)">
            {{ i18n.t('admin.save') }}
          </button>
        </div>
        @if (r.error) {
          <p class="alert alert--error">{{ r.error }}</p>
        }

        <h3>{{ i18n.t('admin.days') }}</h3>
        @if (r.days.length) {
          <div class="table-scroll">
            <table class="data">
              <thead>
                <tr>
                  <th>{{ i18n.t('admin.dayNumber') }}</th>
                  <th>{{ i18n.t('admin.date') }}</th>
                  <th>{{ i18n.t('admin.startTime') }}</th>
                  <th>{{ i18n.t('admin.distanceKm') }}</th>
                  <th>{{ i18n.t('admin.elevationM') }}</th>
                  <th>{{ i18n.t('admin.description') }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (d of r.days; track $index) {
                  <tr>
                    <td>
                      @if (d.id) {
                        {{ d.dayNumber }}
                      } @else {
                        <input type="number" step="1" [(ngModel)]="d.dayNumber" />
                      }
                    </td>
                    <td><input type="date" [(ngModel)]="d.dateLocal" /></td>
                    <td><input type="time" [(ngModel)]="d.startTimeLocal" /></td>
                    <td><input type="number" step="0.1" [(ngModel)]="d.distanceKm" /></td>
                    <td><input type="number" step="1" [(ngModel)]="d.elevationGainM" /></td>
                    <td><input type="text" [(ngModel)]="d.description" /></td>
                    <td>
                      <div class="row-actions">
                        <button class="btn btn--ghost btn--sm" type="button" (click)="saveDay(r, d)">
                          {{ i18n.t('admin.save') }}
                        </button>
                        @if (d.id) {
                          <button class="btn btn--ghost btn--sm" type="button" (click)="removeDay(r.id, d.id)">
                            {{ i18n.t('admin.delete') }}
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="muted">{{ i18n.t('admin.noDays') }}</p>
        }

        <button class="btn btn--ghost" type="button" (click)="addDay(r)">
          {{ i18n.t('admin.newDay') }}
        </button>
      </article>
    }
  `,
  styles: `
    h2 {
      margin-bottom: var(--space-4);
    }

    .route {
      margin-bottom: var(--space-6);
    }

    .route header {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
      margin-bottom: var(--space-4);
    }

    .check {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: 0.9375rem;
    }

    .check input {
      width: auto;
    }

    .actions {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
      margin-top: var(--space-4);
    }

    h3 {
      margin-top: var(--space-8);
    }

    td input {
      min-width: 7rem;
    }

    .row-actions {
      display: flex;
      gap: var(--space-2);
    }

    .btn--sm {
      padding: var(--space-2) var(--space-4);
      font-size: 0.8125rem;
    }
  `,
})
export class AdminRoutes {
  protected readonly i18n = inject(I18nService);
  protected readonly routes = signal<RouteDraft[]>([]);

  private api = inject(ApiService);

  constructor() {
    this.load();
  }

  protected save(r: RouteDraft) {
    r.error = undefined;
    this.api.adminSaveRoute(r).subscribe({
      next: () => this.load(),
      error: (e: { error?: { detail?: string } }) => {
        r.error = e.error?.detail ?? this.i18n.t('common.error');
        this.routes.update((list) => [...list]);
      },
    });
  }

  protected addDay(r: RouteDraft) {
    r.days.push({
      dayNumber: r.days.length + 1,
      dateLocal: '',
      startTimeLocal: '06:00',
      distanceKm: 0,
      elevationGainM: 0,
      description: '',
    });
    this.routes.update((list) => [...list]);
  }

  protected saveDay(r: RouteDraft, d: DayDraft) {
    r.error = undefined;
    this.api
      .adminSaveRouteDay(r.id, { ...d, startTimeLocal: seconds(d.startTimeLocal) })
      .subscribe({
        next: () => this.load(),
        error: (e: { error?: { detail?: string } }) => {
          r.error = e.error?.detail ?? this.i18n.t('common.error');
          this.routes.update((list) => [...list]);
        },
      });
  }

  protected removeDay(routeId: number, dayId: number) {
    if (!confirm(this.i18n.t('admin.confirmDelete'))) return;
    this.api.adminDeleteRouteDay(routeId, dayId).subscribe(() => this.load());
  }

  private load() {
    this.api.adminRoutes().subscribe((r) => this.routes.set(r.map((x) => ({ ...x }))));
  }
}

/** A time input hands back 'HH:mm'; the column is a TimeOnly and reads back as 'HH:mm:ss'. */
function seconds(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}
