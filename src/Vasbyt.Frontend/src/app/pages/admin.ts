import { Component, inject, signal } from '@angular/core';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';
import { AdminAdverts } from './admin/admin-adverts';
import { AdminEntrants } from './admin/admin-entrants';
import { AdminOrders } from './admin/admin-orders';
import { AdminOverview } from './admin/admin-overview';
import { AdminProducts } from './admin/admin-products';
import { AdminRoutes } from './admin/admin-routes';
import { AdminTariffs } from './admin/admin-tariffs';

type Tab = 'overview' | 'orders' | 'entrants' | 'products' | 'adverts' | 'tariffs' | 'routes';

const TABS: { id: Tab; label: TranslationKey }[] = [
  { id: 'overview', label: 'admin.tabOverview' },
  { id: 'orders', label: 'admin.tabOrders' },
  { id: 'entrants', label: 'admin.tabEntrants' },
  { id: 'products', label: 'admin.tabProducts' },
  { id: 'adverts', label: 'admin.tabAdverts' },
  { id: 'tariffs', label: 'admin.tabTariffs' },
  { id: 'routes', label: 'admin.tabRoutes' },
];

/**
 * The back office, spec 10. One screen per job rather than one route each: the console is behind
 * adminGuard and nothing here is worth a deep link, so a tab keeps app.routes.ts untouched.
 */
@Component({
  selector: 'vb-admin',
  standalone: true,
  imports: [
    AdminOverview,
    AdminOrders,
    AdminEntrants,
    AdminProducts,
    AdminAdverts,
    AdminTariffs,
    AdminRoutes,
  ],
  template: `
    <div class="container section">
      <h1>{{ i18n.t('admin.title') }}</h1>

      <nav class="tabs" [attr.aria-label]="i18n.t('admin.title')">
        @for (t of tabs; track t.id) {
          <button class="chip" type="button" [attr.aria-selected]="tab() === t.id" (click)="tab.set(t.id)">
            {{ i18n.t(t.label) }}
          </button>
        }
      </nav>

      @switch (tab()) {
        @case ('overview') {
          <vb-admin-overview (followUp)="followUp()" />
        }
        @case ('orders') {
          <vb-admin-orders />
        }
        @case ('entrants') {
          <vb-admin-entrants [incompleteOnly]="incompleteOnly()" />
        }
        @case ('products') {
          <vb-admin-products />
        }
        @case ('adverts') {
          <vb-admin-adverts />
        }
        @case ('tariffs') {
          <vb-admin-tariffs />
        }
        @case ('routes') {
          <vb-admin-routes />
        }
      }
    </div>
  `,
  styles: `
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-bottom: var(--space-8);
    }
  `,
})
export class Admin {
  protected readonly i18n = inject(I18nService);
  protected readonly tabs = TABS;
  protected readonly tab = signal<Tab>('overview');
  protected readonly incompleteOnly = signal(false);

  /** Spec 8.2: the overview's unfinished-forms tile opens the participant list already filtered. */
  protected followUp() {
    this.incompleteOnly.set(true);
    this.tab.set('entrants');
  }
}
