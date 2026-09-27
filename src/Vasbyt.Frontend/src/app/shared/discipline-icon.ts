import { Component, input } from '@angular/core';
import { Discipline } from '../core/api.models';

@Component({
  selector: 'vb-discipline-icon',
  standalone: true,
  template: `
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (discipline()) {
        @case ('Cycle') {
          <circle cx="11" cy="33" r="8" /><circle cx="37" cy="33" r="8" />
          <path d="m11 33 10-19 9 19H11l16-13M18 14h8m4-6h6l1 25" />
        }
        @case ('Walk') {
          <path d="M8 18h9l7 11 12 4c4 1 5 4 5 7H6V27l2-9Zm11 2 8-5 4 5m-6 8 5-3m-1 6 5-3M7 35h31" />
        }
        @case ('Run') {
          <circle cx="30" cy="8" r="4" />
          <path d="m17 17 9-3 7 10 8-3M26 14l-6 14 10 5-2 10M20 28l-7 9H5M24 19l-10 6" />
        }
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; flex: none; } svg { width: 2.5rem; height: 2.5rem; }`,
})
export class DisciplineIcon { readonly discipline = input.required<Discipline>(); }
