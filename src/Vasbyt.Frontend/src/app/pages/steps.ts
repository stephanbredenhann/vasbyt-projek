import { Component, inject, input } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';

/** The four-step rail. Visible on every registration screen so the pay-first order is never a surprise. */
@Component({
  selector: 'vb-steps',
  standalone: true,
  template: `
    <ol class="steps" [attr.aria-label]="i18n.t('reg.step')">
      @for (label of labels; track label; let i = $index) {
        <li [class.is-current]="i + 1 === current()" [class.is-done]="i + 1 < current()">
          <span class="steps__n">{{ i + 1 }}</span>
          <span class="steps__label">{{ i18n.t(label) }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    .steps {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-6);
      list-style: none;
      margin: 0 0 var(--space-8);
      padding: 0 0 var(--space-4);
      border-bottom: var(--border);
      font-size: 0.875rem;
    }

    li {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--karoo-stone);
    }

    .steps__n {
      display: grid;
      place-items: center;
      width: 1.5rem;
      height: 1.5rem;
      flex: none;
      font-size: 0.75rem;
      font-weight: 700;
      border: 1px solid currentcolor;
      border-radius: var(--radius);
    }

    li.is-current {
      color: var(--ink);
      font-weight: 600;
    }

    li.is-current .steps__n {
      background: var(--hm-blue);
      border-color: var(--hm-blue);
      color: var(--paper);
    }

    li.is-done {
      color: var(--hm-orange-dark);
    }

    li.is-done .steps__n {
      background: var(--hm-orange);
      border-color: var(--hm-orange);
      color: var(--paper);
    }
  `,
})
export class Steps {
  readonly current = input.required<number>();
  protected readonly i18n = inject(I18nService);
  protected readonly labels = ['reg.step1', 'reg.step2', 'reg.step3', 'reg.step4'] as const;
}
