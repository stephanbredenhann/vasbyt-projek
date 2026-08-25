import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Order } from '../core/api.models';
import { I18nService } from '../i18n/i18n.service';

/**
 * One tab per place paid for. Tabs start as "Deelnemer 1…N" and take on each person's name as
 * their form is submitted.
 *
 * Slots fill in order, so tab N is only reachable once N−1 people are in — that keeps the tab
 * number and the entrant's actual position on the order the same thing.
 */
@Component({
  selector: 'vb-entrant-tabs',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="entrant-tabs" [attr.aria-label]="i18n.t('reg.step3')">
      @for (tab of tabs(); track tab.n) {
        @if (tab.reachable) {
          <a
            [routerLink]="['/registreer', order().token, 'deelnemer', tab.n]"
            [class.is-current]="tab.n === current()"
            [class.is-done]="tab.done"
          >
            <span class="entrant-tabs__n">{{ tab.n }}</span>
            <span class="entrant-tabs__name">{{ tab.label }}</span>
          </a>
        } @else {
          <span class="is-locked">
            <span class="entrant-tabs__n">{{ tab.n }}</span>
            <span class="entrant-tabs__name">{{ tab.label }}</span>
          </span>
        }
      }
    </nav>
  `,
  styles: `
    .entrant-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-bottom: var(--space-8);
      border-bottom: var(--border);
      padding-bottom: var(--space-3);
    }

    a,
    span.is-locked {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: 0.9375rem;
      text-decoration: none;
      color: var(--ink-muted);
      padding: var(--space-2) var(--space-4);
      border: 1px solid var(--karoo-line);
      border-radius: var(--radius);
    }

    a:hover {
      border-color: var(--karoo-stone);
      color: var(--ink);
    }

    a.is-done {
      color: var(--ink);
      border-color: var(--hm-orange);
    }

    a.is-current {
      background: var(--hm-blue);
      border-color: var(--hm-blue);
      color: var(--paper);
      font-weight: 600;
    }

    span.is-locked {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .entrant-tabs__n {
      font-size: 0.75rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class EntrantTabs {
  readonly order = input.required<Order>();
  readonly current = input.required<number>();

  protected readonly i18n = inject(I18nService);

  protected readonly tabs = computed(() => {
    const order = this.order();
    const filled = order.entrants.length;

    return Array.from({ length: order.entrantCount }, (_, i) => {
      const n = i + 1;
      const person = order.entrants[i];
      return {
        n,
        done: !!person,
        // The next empty slot is reachable; the ones after it are not yet.
        reachable: n <= filled + 1,
        label: person
          ? `${person.firstName} ${person.lastName}`.trim()
          : `${this.i18n.t('reg.entrant')} ${n}`,
      };
    });
  });
}
