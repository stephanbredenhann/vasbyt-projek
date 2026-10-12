import { Component, computed, ElementRef, inject, input } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { downloadIcs, EventDay, googleCalendarUrl, outlookCalendarUrl } from './calendar';

/** "Add to my calendar": opens Google Calendar or Outlook on the web, or downloads an .ics for anything else. */
@Component({
  selector: 'vb-add-calendar',
  standalone: true,
  host: { '(document:click)': 'onDocClick($event)', '(document:keydown.escape)': 'close()' },
  template: `
    <details #menu class="cal">
      <summary [class]="buttonClass()">{{ i18n.t('common.addCalendar') }}</summary>
      <div class="cal__menu" (click)="close()">
        <a [href]="google()" target="_blank" rel="noopener">{{ i18n.t('common.calGoogle') }}</a>
        <a [href]="outlook()" target="_blank" rel="noopener">{{ i18n.t('common.calOutlook') }}</a>
        <button type="button" (click)="ics()">{{ i18n.t('common.calOther') }}</button>
      </div>
    </details>
  `,
  styles: `
    :host { display: inline-block; }
    .cal { position: relative; }
    summary { list-style: none; }
    summary::-webkit-details-marker { display: none; }
    .cal__menu {
      position: absolute;
      left: 0;
      top: calc(100% + var(--space-2));
      z-index: 4;
      min-width: 100%;
      padding: var(--space-2);
      background: var(--paper);
      border-radius: var(--r-md);
      box-shadow: var(--shadow-3), 0 0 0 1px color-mix(in srgb, var(--rule) 80%, transparent);
    }
    .cal__menu a, .cal__menu button {
      display: flex;
      align-items: center;
      width: 100%;
      min-height: var(--touch);
      padding: var(--space-2) var(--space-4);
      border: 0;
      border-radius: var(--r-sm);
      background: none;
      color: var(--ink);
      font: inherit;
      font-size: 1rem;
      text-align: left;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
    }
    .cal__menu a:hover, .cal__menu button:hover { background: var(--karoo-sand-light); }
  `,
})
export class AddCalendar {
  protected readonly i18n = inject(I18nService);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly days = input.required<EventDay[]>();
  readonly confirmed = input(false);
  readonly buttonClass = input('btn btn--ghost');

  protected readonly google = computed(() => googleCalendarUrl(this.days(), location.origin, this.confirmed()));
  protected readonly outlook = computed(() => outlookCalendarUrl(this.days(), location.origin, this.confirmed()));

  protected ics() {
    downloadIcs(this.days(), this.confirmed());
  }

  protected close() {
    this.host.nativeElement.querySelector('details')?.removeAttribute('open');
  }

  protected onDocClick(e: Event) {
    if (!this.host.nativeElement.contains(e.target as Node)) this.close();
  }
}
