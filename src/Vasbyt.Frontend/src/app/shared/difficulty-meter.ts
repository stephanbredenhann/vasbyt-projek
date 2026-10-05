import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';

@Component({
  selector: 'vb-difficulty-meter',
  standalone: true,
  template: `
    <div class="difficulty">
      <svg class="gauge" viewBox="0 0 100 58" role="meter" aria-valuemin="1" aria-valuemax="3" [attr.aria-valuenow]="level()" [attr.aria-valuetext]="label()" [attr.aria-label]="i18n.t('routes.difficulty')">
        <path d="M10.02 48.60 A40 40 0 0 1 28.80 16.08" stroke="#3f8f3a" />
        <path d="M31.22 14.68 A40 40 0 0 1 68.78 14.68" stroke="#f2b33d" />
        <path d="M71.20 16.08 A40 40 0 0 1 89.98 48.60" stroke="#d7191c" />
        <g [attr.transform]="'rotate(' + (level() - 2) * 60 + ' 50 50)'">
          <line x1="50" y1="50" x2="50" y2="18" stroke="var(--indigo-deep)" stroke-width="3.5" stroke-linecap="round" />
          <circle cx="50" cy="50" r="5" fill="var(--indigo-deep)" />
        </g>
      </svg>
      <span>{{ label() }}</span>
    </div>
  `,
  styles: `
    .difficulty { display: flex; gap: .6rem; align-items: center; font-size: .8125rem; color: var(--indigo-deep); }
    .gauge { width: 64px; height: auto; }
    .gauge path { fill: none; stroke-width: 12; }
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
