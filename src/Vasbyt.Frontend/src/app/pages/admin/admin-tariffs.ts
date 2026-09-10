import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PricingRule, Tariff, TariffKind } from '../../core/api.models';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../i18n/i18n.service';

/** The editable shape: the two UTC stamps become the strings a datetime-local input speaks. */
interface RuleDraft {
  id?: number;
  tariffKind: TariffKind;
  label: string;
  amountZar: number;
  isActive: boolean;
  from: string;
  to: string;
  error?: string;
}

/**
 * Nothing caches PricingRules, so a save here is what the next buyer pays. The live /api/tariffs
 * answer is shown next to the editor so that consequence is on screen, not in a comment.
 */
@Component({
  selector: 'vb-admin-tariffs',
  standalone: true,
  imports: [FormsModule, CurrencyPipe],
  template: `
    <h2>{{ i18n.t('admin.tariffsTitle') }}</h2>

    <p class="alert alert--error warning">{{ i18n.t('admin.liveWarning') }}</p>

    <div class="card live">
      <h3>{{ i18n.t('admin.liveNow') }}</h3>
      @if (live().length) {
        <ul>
          @for (t of live(); track t.kind) {
            <li>
              <span class="chip chip--blue">
                {{ i18n.t(t.kind === 'Student' ? 'admin.student' : 'admin.normal') }}
              </span>
              <strong>{{ t.amountZar | currency: 'ZAR' : 'symbol-narrow' : '1.0-0' }}</strong>
              <span class="muted">{{ t.label }}</span>
            </li>
          }
        </ul>
      } @else {
        <p class="muted">{{ i18n.t('admin.noLive') }}</p>
      }
    </div>

    <div class="bar">
      <button class="btn btn--accent" type="button" (click)="add()">
        {{ i18n.t('admin.newRule') }}
      </button>
      <span class="field__hint">{{ i18n.t('admin.utcHint') }}</span>
    </div>

    @if (rules().length) {
      @for (r of rules(); track $index) {
        <article class="card rule">
          <div class="field-row">
            <label class="field">
              <span>{{ i18n.t('admin.kind') }}</span>
              <select [(ngModel)]="r.tariffKind">
                <option value="Normal">{{ i18n.t('admin.normal') }}</option>
                <option value="Student">{{ i18n.t('admin.student') }}</option>
              </select>
            </label>
            <label class="field">
              <span>{{ i18n.t('admin.label') }}</span>
              <input type="text" [(ngModel)]="r.label" />
            </label>
            <label class="field">
              <span>{{ i18n.t('admin.amount') }}</span>
              <input type="number" step="1" [(ngModel)]="r.amountZar" />
            </label>
          </div>

          <div class="field-row">
            <label class="field">
              <span>{{ i18n.t('admin.validFrom') }}</span>
              <input type="datetime-local" [(ngModel)]="r.from" />
            </label>
            <label class="field">
              <span>{{ i18n.t('admin.validTo') }}</span>
              <input type="datetime-local" [(ngModel)]="r.to" />
            </label>
          </div>

          <label class="check">
            <input type="checkbox" [(ngModel)]="r.isActive" />
            <span>{{ i18n.t('admin.active') }}</span>
          </label>

          <div class="actions">
            <button class="btn btn--primary" type="button" (click)="save(r)">
              {{ i18n.t('admin.save') }}
            </button>
            @if (r.id) {
              <button class="btn btn--ghost" type="button" (click)="remove(r.id)">
                {{ i18n.t('admin.delete') }}
              </button>
            }
          </div>
          @if (r.error) {
            <p class="alert alert--error">{{ r.error }}</p>
          }
        </article>
      }
    } @else {
      <p class="muted">{{ i18n.t('admin.noRules') }}</p>
    }
  `,
  styles: `
    h2 {
      margin-bottom: var(--space-6);
    }

    .warning {
      font-weight: 600;
      padding: var(--space-4) var(--space-6);
      margin-bottom: var(--space-6);
    }

    .live {
      margin-bottom: var(--space-6);
    }

    .live ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .live li {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      flex-wrap: wrap;
      padding-block: var(--space-3);
    }

    .live li + li {
      border-top: 1px solid var(--rule);
    }

    .bar {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      flex-wrap: wrap;
      margin-bottom: var(--space-6);
    }

    .rule {
      margin-bottom: var(--space-4);
    }

    /* datetime-local is not in the global input list, so it gets the same treatment here. */
    input[type='datetime-local'] {
      width: 100%;
      font-family: var(--font-body);
      font-size: 0.9375rem;
      color: var(--ink);
      background: var(--paper);
      padding: var(--space-3);
      border: 1px solid var(--field-line);
      border-radius: var(--r-sm);
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

    .actions {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
    }
  `,
})
export class AdminTariffs {
  protected readonly i18n = inject(I18nService);
  protected readonly rules = signal<RuleDraft[]>([]);
  protected readonly live = signal<Tariff[]>([]);

  private api = inject(ApiService);

  constructor() {
    this.load();
  }

  protected add() {
    const now = new Date().toISOString().slice(0, 16);
    this.rules.update((list) => [
      { tariffKind: 'Normal', label: '', amountZar: 0, isActive: true, from: now, to: now },
      ...list,
    ]);
  }

  protected save(r: RuleDraft) {
    r.error = undefined;
    this.api
      .adminSavePricingRule({
        id: r.id,
        tariffKind: r.tariffKind,
        label: r.label,
        amountZar: r.amountZar,
        isActive: r.isActive,
        validFromUtc: utc(r.from),
        validToUtc: utc(r.to),
      })
      .subscribe({
        next: () => this.load(),
        error: (e: { error?: { detail?: string } }) => {
          r.error = e.error?.detail ?? this.i18n.t('common.error');
          this.rules.update((list) => [...list]);
        },
      });
  }

  protected remove(id: number) {
    if (!confirm(this.i18n.t('admin.confirmDelete'))) return;
    this.api.adminDeletePricingRule(id).subscribe(() => this.load());
  }

  private load() {
    this.api.adminPricingRules().subscribe((rules) => this.rules.set(rules.map(draft)));
    // Refetched after every save: this is the number a buyer sees on the very next order.
    this.api.tariffs().subscribe((t) => this.live.set(t));
  }
}

function draft(r: PricingRule): RuleDraft {
  return {
    id: r.id,
    tariffKind: r.tariffKind,
    label: r.label,
    amountZar: r.amountZar,
    isActive: r.isActive,
    from: r.validFromUtc.slice(0, 16),
    to: r.validToUtc.slice(0, 16),
  };
}

/** A datetime-local input hands back 'YYYY-MM-DDTHH:mm'. The column is a UTC timestamp. */
function utc(value: string) {
  return value.length === 16 ? `${value}:00Z` : value;
}
