import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { TranslationKey } from '../i18n/af';
import { I18nService } from '../i18n/i18n.service';
import { OrderStatus } from '../core/api.models';
import { AdminAdverts } from './admin/admin-adverts';
import { AdminEntrants } from './admin/admin-entrants';
import { AdminOrders } from './admin/admin-orders';
import { AdminOverview } from './admin/admin-overview';
import { AdminProducts } from './admin/admin-products';
import { AdminRoutes } from './admin/admin-routes';
import { AdminTariffs } from './admin/admin-tariffs';
import { AdminProgramme } from './admin/admin-programme';
import { AdminScan } from './admin/admin-scan';

type Tab = 'overview' | 'orders' | 'entrants' | 'products' | 'adverts' | 'tariffs' | 'routes' | 'programme' | 'scan';

const GROUPS: { label: TranslationKey; tabs: { id: Tab; label: TranslationKey }[] }[] = [
  { label: 'admin.groupDay', tabs: [
    { id: 'overview', label: 'admin.tabOverview' },
    { id: 'scan', label: 'scan.tab' },
    { id: 'orders', label: 'admin.tabOrders' },
    { id: 'entrants', label: 'admin.tabEntrants' },
  ] },
  { label: 'admin.groupSetup', tabs: [
    { id: 'programme', label: 'programme.tab' },
    { id: 'products', label: 'admin.tabProducts' },
    { id: 'adverts', label: 'admin.tabAdverts' },
    { id: 'tariffs', label: 'admin.tabTariffs' },
    { id: 'routes', label: 'admin.tabRoutes' },
  ] },
];
const IDS = GROUPS.flatMap((g) => g.tabs.map((t) => t.id));

/**
 * The back office, spec 10. One screen per job rather than one route each: the console is behind
 * adminGuard and the tab lives in ?tab=, so app.routes.ts stays untouched.
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
    AdminProgramme,
    AdminScan,
  ],
  template: `
    <div class="container section">
      <h1>{{ i18n.t('admin.title') }}</h1>

      <nav class="tabs" [attr.aria-label]="i18n.t('admin.title')">
        @for (g of groups; track g.label) {
          <div class="group">
            <span class="group__label">{{ i18n.t(g.label) }}</span>
            <div class="group__tabs">
              @for (t of g.tabs; track t.id) {
                <button class="chip" type="button" [attr.aria-current]="tab() === t.id ? 'page' : null" (click)="select(t.id)">
                  {{ i18n.t(t.label) }}
                </button>
              }
            </div>
          </div>
        }
      </nav>

      @switch (tab()) {
        @case ('overview') {
          <vb-admin-overview (followUp)="followUp()" (pending)="pending()" />
        }
        @case ('orders') {
          <vb-admin-orders [initialStatus]="ordersStatus()" />
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
        @case ('scan') {
          <vb-admin-scan />
        }
      }
      @if (programmeOpened()) {
        <vb-admin-programme [hidden]="tab() !== 'programme'" />
      }
    </div>
  `,
  styles: `
    .tabs {
      display: grid;
      gap: var(--space-4);
      margin-bottom: var(--space-8);
    }

    .group {
      display: grid;
      gap: var(--space-2);
    }

    .group__label {
      font-size: 1rem;
      font-weight: 700;
      color: var(--ink-muted);
    }

    .group__tabs {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .group__tabs .chip {
      min-height: var(--touch);
      font-size: 1rem;
      padding-inline: var(--space-4);
    }
  `,
})
export class Admin {
  protected readonly i18n = inject(I18nService);
  protected readonly groups = GROUPS;
  private readonly router = inject(Router);
  /** The tab lives in ?tab=, so Back, Forward and reload all land on the same screen. */
  protected readonly tab = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((p) => {
      const t = p.get('tab') as Tab;
      return IDS.includes(t) ? t : 'overview';
    })),
    { initialValue: 'overview' as Tab },
  );
  protected readonly incompleteOnly = signal(false);
  protected readonly ordersStatus = signal<OrderStatus | ''>('');
  protected readonly programmeOpened = signal(false);

  constructor() {
    // Programme keeps unsaved edits once opened, so it stays mounted after the first visit.
    effect(() => { if (this.tab() === 'programme') this.programmeOpened.set(true); });
  }

  /** A manual pick clears the filters a shortcut left behind; the overview shortcuts keep them. */
  protected select(tab: Tab, keepFilters = false) {
    if (!keepFilters && tab === 'orders') this.ordersStatus.set('');
    if (!keepFilters && tab === 'entrants') this.incompleteOnly.set(false);
    this.router.navigate([], { queryParams: { tab } });
  }

  /** Spec 8.2: the overview's unfinished-forms tile opens the participant list already filtered. */
  protected followUp() {
    this.incompleteOnly.set(true);
    this.select('entrants', true);
  }

  /** The overview's unpaid-orders tile opens the order list already filtered to Pending. */
  protected pending() {
    this.ordersStatus.set('Pending');
    this.select('orders', true);
  }
}
