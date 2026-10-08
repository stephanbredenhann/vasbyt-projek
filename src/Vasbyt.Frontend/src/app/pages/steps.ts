import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';

export type Phase = 'choose' | 'basket' | 'details' | 'pay' | 'forms' | 'done';

/** The checkout rail. An order with tickets gets the entry and form phases; a shop order does not. */
@Component({
  selector: 'vb-steps',
  standalone: true,
  template: `
    <ol class="steps" [attr.aria-label]="i18n.t('reg.step')">
      @for (p of phases(); track p; let i = $index) {
        <li [class.is-current]="i === at()" [class.is-done]="i < at()" [attr.aria-current]="i === at() ? 'step' : null">
          <span class="steps__n">{{ i + 1 }}</span>
          <span class="steps__label">{{ i18n.t(label[p]) }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    .steps {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3) var(--space-6);
      list-style: none;
      margin: 0 0 var(--space-8);
      padding: 0;
      font-size: 0.9375rem;
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
      width: 1.75rem;
      height: 1.75rem;
      flex: none;
      font-size: 0.9375rem;
      font-weight: 700;
      background: var(--karoo-sand-light);
      border-radius: 50%;
    }

    li.is-current {
      color: var(--ink);
      font-weight: 600;
    }

    li.is-current .steps__n {
      background: var(--indigo);
      color: var(--paper);
    }

    li.is-done {
      color: var(--orange-ink);
    }

    li.is-done .steps__n {
      background: var(--orange);
      color: var(--ink);
    }

    /* Six labels do not fit a phone. The numbers still tell you where you are. */
    @media (max-width: 720px) {
      .steps {
        gap: var(--space-2);
      }

      li:not(.is-current) .steps__label {
        display: none;
      }
    }
  `,
})
export class Steps {
  readonly current = input.required<Phase>();
  readonly tickets = input(true);
  protected readonly i18n = inject(I18nService);
  protected readonly phases = computed<Phase[]>(() => this.tickets()
    ? ['choose', 'basket', 'details', 'pay', 'forms', 'done'] : ['basket', 'details', 'pay', 'done']);
  protected readonly at = computed(() => this.phases().indexOf(this.current()));
  protected readonly label = {
    choose: 'reg.step1', basket: 'reg.step2', details: 'reg.step3', pay: 'reg.step4', forms: 'reg.step5', done: 'reg.step6',
  } as const;
}
