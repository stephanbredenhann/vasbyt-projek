import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Order } from '../core/api.models';
import { I18nService } from '../i18n/i18n.service';

/**
 * One tab per ticket paid for. Payment created every slot at once, so all of them are reachable
 * from the start: spec 8.2 allows a paid order to sit with its forms still blank.
 *
 * A tab starts as "Deelnemer N" and takes on the person's name once their form is in. The route
 * rides along on the tab because two tickets on one order are often on different routes.
 */
@Component({
  selector: 'vb-entrant-tabs',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="rail" [attr.aria-label]="i18n.t('entrant.formsTitle')">
      @for (tab of tabs(); track tab.id) {
        <a
          class="chip"
          [class.chip--blue]="tab.n === current()"
          [class.chip--accent]="tab.done && tab.n !== current()"
          [routerLink]="['/registreer', order().token, 'deelnemer', tab.n]"
          [attr.aria-current]="tab.n === current() ? 'step' : null"
        >
          <span class="rail__n">{{ tab.n }}</span>
          <span>{{ tab.label }}</span>
          <span class="rail__route">{{ tab.routeName }}</span>
        </a>
      }
    </nav>
  `,
  styles: `
    .rail .chip { min-height: 64px; border: 2px solid var(--indigo); padding: 1rem 1.25rem; border-radius: var(--r-md); font-size: 1rem; box-shadow: var(--shadow-1); }
    .rail .chip:hover { background: var(--indigo); color: white; }
    .rail .chip--blue { box-shadow: 0 0 0 3px rgb(44 57 145 / 15%); }
    .rail {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-bottom: var(--space-8);
    }

    .rail__n {
      display: grid;
      place-items: center;
      width: 1.75rem;
      height: 1.75rem;
      flex: none;
      border-radius: 50%;
      background: rgb(29 30 88 / 10%);
      font-size: 0.9375rem;
      font-variant-numeric: tabular-nums;
    }

    .chip--blue .rail__n {
      background: rgb(255 255 255 / 22%);
    }

    .rail__route {
      font-weight: 500;
      opacity: 0.75;
    }
  `,
})
export class EntrantTabs {
  readonly order = input.required<Order>();
  readonly current = input.required<number>();

  protected readonly i18n = inject(I18nService);

  protected readonly tabs = computed(() =>
    this.order().entrants.map((e, i) => ({
      id: e.id,
      n: i + 1,
      done: e.isComplete,
      routeName: e.routeName,
      label: e.isComplete
        ? `${e.firstName} ${e.lastName}`.trim()
        : `${this.i18n.t('reg.entrant')} ${i + 1}`,
    })),
  );
}
