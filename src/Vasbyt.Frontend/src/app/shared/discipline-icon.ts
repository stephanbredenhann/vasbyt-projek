import { Component, input } from '@angular/core';
import { Discipline } from '../core/api.models';

@Component({
  selector: 'vb-discipline-icon',
  standalone: true,
  template: `
    <!-- Glyphs after Tabler Icons (MIT): bike, run, walk. -->
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (discipline()) {
        @case ('Cycle') {
          <circle cx="5" cy="18" r="3" /><circle cx="19" cy="18" r="3" />
          <path d="M12 19v-4l-3-3 5-4 2 3h3" />
          <circle cx="17" cy="5" r="1.5" fill="currentColor" stroke="none" />
        }
        @case ('Walk') {
          <circle cx="13" cy="4" r="1.5" fill="currentColor" stroke="none" />
          <path d="m7 21 3-4M16 21l-2-4-3-3 1-6M6 12l2-3 4-1 3 3 3 1" />
        }
        @case ('Run') {
          <circle cx="13" cy="4" r="1.5" fill="currentColor" stroke="none" />
          <path d="m4 17 5 1 .75-1.5M15 21v-4l-4-3 1-6M7 12V9l5-1 3 3 3 1" />
        }
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; flex: none; } svg { width: 2.5rem; height: 2.5rem; }`,
})
export class DisciplineIcon { readonly discipline = input.required<Discipline>(); }
