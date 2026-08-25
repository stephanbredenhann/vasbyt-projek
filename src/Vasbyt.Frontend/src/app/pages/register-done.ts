import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Order } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { Steps } from './steps';

@Component({
  selector: 'vb-register-done',
  standalone: true,
  imports: [RouterLink, Steps],
  template: `
    <div class="container section">
      <vb-steps [current]="4" />
      <h1>{{ i18n.t('done.title') }}</h1>
      <p class="lead">{{ i18n.t('done.body') }}</p>

      @if (order(); as o) {
        <div class="card done">
          <ul>
            @for (e of o.entrants; track e.id) {
              <li>
                <strong>{{ e.firstName }} {{ e.lastName }}</strong>
                <span class="muted">{{ e.eventName }} — {{ e.distanceName }}</span>
              </li>
            }
          </ul>
        </div>
      }

      <a class="btn btn--primary" routerLink="/rekening">{{ i18n.t('done.viewAccount') }}</a>
    </div>
  `,
  styles: `
    .done {
      max-width: 34rem;
      margin-bottom: var(--space-8);
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    li {
      display: flex;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
      padding: var(--space-3) 0;
      border-bottom: var(--border);
    }
  `,
})
export class RegisterDone {
  protected readonly i18n = inject(I18nService);
  protected readonly order = signal<Order | null>(null);

  constructor() {
    const token = inject(ActivatedRoute).snapshot.paramMap.get('token')!;
    inject(ApiService).order(token).subscribe((o) => this.order.set(o));
    // The flow is finished; a fresh visit should start a new order, not resume this one.
    inject(OrderFlowService).token = null;
  }
}
