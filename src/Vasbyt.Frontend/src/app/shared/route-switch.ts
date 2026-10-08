import { Component, inject, input, output, signal } from '@angular/core';
import { RouteCategory, RouteCode } from '../core/api.models';
import { I18nService } from '../i18n/i18n.service';

/** A run route and the walk that shares it; every other category is a group of one. */
export interface RouteGroup { run: RouteCategory; walk?: RouteCategory }

export function groupRoutes(all: RouteCategory[]): RouteGroup[] {
  return all
    .filter((r) => !r.sharesRouteWithCode)
    .map((run) => ({ run, walk: all.find((w) => w.sharesRouteWithCode === run.code) }));
}

/** Which run/walk side each shared card shows; one per page. */
export function runWalkChoice() {
  const walking = signal(new Set<string>());
  return {
    shown: (g: RouteGroup) => (g.walk && walking().has(g.run.code) ? g.walk : g.run),
    choose: (g: RouteGroup, code: RouteCode) =>
      walking.update((s) => {
        const next = new Set(s);
        if (code === g.walk?.code) next.add(g.run.code); else next.delete(g.run.code);
        return next;
      }),
  };
}

/** Run/Walk segmented switch: native radios in a radiogroup, so arrow keys and focus come free. */
@Component({
  selector: 'vb-route-switch',
  standalone: true,
  template: `
    <div class="switch" role="radiogroup" [attr.aria-label]="i18n.t('routes.switch')">
      @for (o of options(); track o.code) {
        <label class="switch__opt" [class.is-on]="o.code === value()">
          <input type="radio" [name]="'sw-' + options()[0].code" [value]="o.code" [checked]="o.code === value()"
                 (change)="pick.emit(o.code)" />
          <span>{{ i18n.t(o.discipline === 'Walk' ? 'events.walk' : 'events.run') }}</span>
        </label>
      }
    </div>
    <p class="hint">{{ i18n.t('routes.sameRoute') }}</p>
  `,
  styles: `
    :host { display: block; }
    .hint { margin: var(--space-2) 0 0; font-size: 0.9375rem; opacity: .85; }
    .switch { display: inline-flex; padding: 3px; border-radius: var(--r-pill); background: var(--paper); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ev, var(--indigo)) 30%, transparent); }
    .switch__opt { position: relative; display: grid; place-items: center; min-width: 5.5rem; min-height: 44px; padding-inline: var(--space-4); border-radius: var(--r-pill); font-weight: 600; color: var(--ev, var(--indigo)); cursor: pointer; transition: background var(--dur-ui) var(--ease-out), color var(--dur-ui) var(--ease-out); }
    .switch__opt.is-on { background: var(--ev, var(--indigo)); color: white; }
    .switch__opt input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
    .switch__opt:has(input:focus-visible) { outline: 3px solid var(--ev, var(--indigo)); outline-offset: 2px; }
  `,
})
export class RouteSwitch {
  protected readonly i18n = inject(I18nService);
  /** Run first, then walk. */
  readonly options = input.required<RouteCategory[]>();
  readonly value = input.required<RouteCode>();
  readonly pick = output<RouteCode>();
}
