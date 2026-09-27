import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';

@Component({
  selector: 'vb-difficulty-meter',
  standalone: true,
  template: `
    <div class="difficulty">
      <span class="bars" role="meter" aria-valuemin="1" aria-valuemax="3" [attr.aria-valuenow]="level()" [attr.aria-valuetext]="label()" [attr.aria-label]="i18n.t('routes.difficulty')">
        @for (n of [1,2,3]; track n) { <span [class.filled]="n <= level()"></span> }
      </span>
      <span>{{ label() }}</span>
    </div>
  `,
  styles: `
    .difficulty { display: flex; gap: .6rem; align-items: center; font-size: .8125rem; color: var(--indigo-deep); }
    .bars { display: inline-flex; gap: 4px; align-items: end; height: 24px; }
    .bars span { display: block; width: 8px; height: 10px; background: #d7dce8; border-radius: 2px; }
    .bars span:nth-child(2) { height: 17px; } .bars span:nth-child(3) { height: 24px; }
    .bars .filled { background: var(--indigo); }
  `,
})
export class DifficultyMeter {
  readonly difficulty = input.required<string>();
  protected readonly i18n = inject(I18nService);
  protected readonly level = computed(() => ({ Maklik: 1, Matig: 2, Swaar: 3, Easy: 1, Moderate: 2, Hard: 3 }[this.difficulty()] ?? 2));
  protected readonly label = computed(() => {
    const value = this.difficulty();
    return this.i18n.locale() === 'en' ? ({ Maklik: 'Easy', Matig: 'Moderate', Swaar: 'Hard' }[value] ?? value) : value;
  });
}
