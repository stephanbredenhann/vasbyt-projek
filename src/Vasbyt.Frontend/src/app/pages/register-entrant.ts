import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, switchMap } from 'rxjs';
import { Distance, EntrantForm, Order, VasbytEvent } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { AddressInput } from '../shared/address-input';
import { EntrantTabs } from './entrant-tabs';
import { Steps } from './steps';

interface EventOption extends Distance {
  eventName: string;
  discipline: string;
}

/**
 * Step 3 of 4, once per place paid for, navigated by the tab rail above the form.
 *
 * Each person picks their own event here — the entry fee is flat, so that choice does not have to
 * exist until after payment. Entrant #1 additionally carries the account fields and the
 * "same address for everyone" toggle; later entrants get neither.
 */
@Component({
  selector: 'vb-register-entrant',
  standalone: true,
  imports: [FormsModule, DecimalPipe, AddressInput, EntrantTabs, Steps],
  template: `
    <div class="container section">
      <vb-steps [current]="3" />

      @if (order(); as o) {
        <h1>{{ i18n.t('reg.step3') }}</h1>
        <vb-entrant-tabs [order]="o" [current]="index()" />

        @if (saved(); as person) {
          <!-- A slot that is already filled: show who is in it. -->
          <div class="card done">
            <p class="eyebrow">{{ i18n.t('reg.entrant') }} {{ index() }}</p>
            <h2>{{ person.firstName }} {{ person.lastName }}</h2>
            <p class="muted">
              {{ person.eventName }} — {{ person.distanceName }}<br />
              {{ person.town }}, {{ person.province }}
            </p>
            <!-- ponytail: read-only. Add an owner-scoped PATCH when entrants need to fix a typo
                 themselves; admins can already edit through /api/admin/entrants/{id}. -->
            <p class="alert">{{ i18n.t('entrant.locked') }}</p>
          </div>
        } @else {
          @if (error()) {
            <p class="alert alert--error">{{ error() }}</p>
          }

          <form #f="ngForm" (ngSubmit)="submit(f, o)" class="entrant-form">
            <fieldset class="card">
              <legend>{{ i18n.t('entrant.chooseEvent') }}</legend>
              <p class="muted">{{ i18n.t('entrant.chooseEventHint') }}</p>

              <div class="events">
                @for (option of options(); track option.id) {
                  <label class="event" [class.is-picked]="model.eventDistanceId === option.id">
                    <input
                      type="radio"
                      name="eventDistanceId"
                      [value]="option.id"
                      [(ngModel)]="model.eventDistanceId"
                      required
                    />
                    <span class="event__body">
                      <span class="eyebrow">{{ option.discipline }}</span>
                      <strong>{{ option.eventName }} — {{ option.name }}</strong>
                      <span class="muted">
                        {{ option.distanceKm | number: '1.0-0' }} km ·
                        {{ option.elevationGainM | number }} m
                      </span>
                    </span>
                  </label>
                }
              </div>
            </fieldset>

            @if (needsAccount()) {
              <fieldset class="card">
                <legend>{{ i18n.t('entrant.accountTitle') }}</legend>
                <p class="muted">{{ i18n.t('entrant.accountIntro') }}</p>

                <label class="field">
                  <span>{{ i18n.t('entrant.password') }}</span>
                  <input
                    type="password"
                    name="password"
                    [(ngModel)]="password"
                    required
                    minlength="8"
                    autocomplete="new-password"
                  />
                  <small class="field__hint">{{ i18n.t('entrant.passwordHint') }}</small>
                </label>
              </fieldset>
            }

            <fieldset class="card">
              <legend>{{ i18n.t('entrant.title') }}</legend>

              <div class="field-row">
                <label class="field">
                  <span>{{ i18n.t('entrant.firstName') }}</span>
                  <input type="text" name="firstName" [(ngModel)]="model.firstName" required autocomplete="given-name" />
                </label>
                <label class="field">
                  <span>{{ i18n.t('entrant.lastName') }}</span>
                  <input type="text" name="lastName" [(ngModel)]="model.lastName" required autocomplete="family-name" />
                </label>
              </div>

              <div class="field-row">
                <label class="field">
                  <span>{{ i18n.t('entrant.email') }}</span>
                  <input type="email" name="email" [(ngModel)]="model.email" required autocomplete="email" />
                </label>
                <label class="field">
                  <span>{{ i18n.t('entrant.phone') }}</span>
                  <input type="tel" name="phone" [(ngModel)]="model.phone" required autocomplete="tel" />
                </label>
              </div>

              <div class="field-row">
                <label class="field">
                  <span>{{ i18n.t('entrant.dob') }}</span>
                  <input type="date" name="dateOfBirth" [(ngModel)]="model.dateOfBirth" required />
                </label>
                <label class="field">
                  <span>{{ i18n.t('entrant.gender') }}</span>
                  <select name="gender" [(ngModel)]="model.gender" required>
                    <option value="" disabled>—</option>
                    <option value="M">{{ i18n.t('entrant.male') }}</option>
                    <option value="V">{{ i18n.t('entrant.female') }}</option>
                  </select>
                </label>
                <label class="field">
                  <span>{{ i18n.t('entrant.shirt') }}</span>
                  <select name="shirtSize" [(ngModel)]="model.shirtSize" required>
                    <option value="" disabled>—</option>
                    @for (s of shirtSizes; track s) {
                      <option [value]="s">{{ s }}</option>
                    }
                  </select>
                </label>
              </div>

              <vb-address-input [(town)]="model.town" [(province)]="model.province" />

              @if (index() === 1 && o.entrantCount > 1) {
                <label class="toggle">
                  <input type="checkbox" name="sameAddress" [(ngModel)]="sameAddress" />
                  <span>{{ i18n.t('entrant.sameAddress') }}</span>
                </label>
              }

              <label class="field">
                <span>{{ i18n.t('entrant.club') }} <span class="muted">({{ i18n.t('common.optional') }})</span></span>
                <input type="text" name="clubName" [(ngModel)]="model.clubName" />
              </label>
            </fieldset>

            <fieldset class="card">
              <legend>{{ i18n.t('entrant.emergency') }}</legend>
              <div class="field-row">
                <label class="field">
                  <span>{{ i18n.t('entrant.emergencyName') }}</span>
                  <input type="text" name="emergencyName" [(ngModel)]="model.emergencyName" required />
                </label>
                <label class="field">
                  <span>{{ i18n.t('entrant.emergencyPhone') }}</span>
                  <input type="tel" name="emergencyPhone" [(ngModel)]="model.emergencyPhone" required />
                </label>
              </div>

              <label class="field">
                <span>{{ i18n.t('entrant.medical') }}</span>
                <textarea name="medicalNotes" [(ngModel)]="model.medicalNotes"></textarea>
                <small class="field__hint">{{ i18n.t('entrant.medicalHint') }}</small>
              </label>
            </fieldset>

            <button type="submit" class="btn btn--primary btn--lg" [disabled]="busy() || f.invalid">
              {{ busy() ? i18n.t('entrant.saving') : i18n.t(needsAccount() ? 'entrant.saveAndAccount' : 'entrant.save') }}
            </button>
          </form>
        }
      } @else {
        <p class="muted">{{ i18n.t('common.loading') }}</p>
      }
    </div>
  `,
  styles: `
    .entrant-form,
    .done {
      max-width: 46rem;
    }

    fieldset {
      border: var(--border);
      margin: 0 0 var(--space-6);
    }

    legend {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.125rem;
      padding-inline: var(--space-2);
    }

    /* Four options, so two clean rows of two rather than a 3 + 1 orphan. */
    .events {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-3);
    }

    @media (max-width: 560px) {
      .events {
        grid-template-columns: 1fr;
      }
    }

    .event {
      display: flex;
      align-items: start;
      gap: var(--space-3);
      padding: var(--space-4);
      border: 1px solid var(--karoo-line);
      border-radius: var(--radius);
      cursor: pointer;

      &:hover {
        border-color: var(--karoo-stone);
      }

      &.is-picked {
        border-color: var(--hm-blue);
        box-shadow: inset 0 0 0 1px var(--hm-blue);
      }
    }

    .event input {
      width: auto;
      margin-top: 0.25rem;
      accent-color: var(--hm-blue);
    }

    .event__body {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      font-size: 0.9375rem;
    }

    .toggle {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
      font-size: 0.9375rem;
      cursor: pointer;
    }

    .toggle input {
      width: auto;
      accent-color: var(--hm-blue);
    }
  `,
})
export class RegisterEntrant {
  protected readonly i18n = inject(I18nService);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private flow = inject(OrderFlowService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected readonly shirtSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  protected readonly order = signal<Order | null>(null);
  protected readonly options = signal<EventOption[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly password = signal('');
  protected readonly sameAddress = signal(false);

  protected model: EntrantForm = blank();

  protected readonly index = signal(1);

  /** Non-null when this slot has already been filled in — the form gives way to a summary. */
  protected readonly saved = computed(() => this.order()?.entrants[this.index() - 1] ?? null);

  /** Only the first entrant on an as-yet-unclaimed order carries the account fields. */
  protected readonly needsAccount = computed(
    () => !this.auth.isSignedIn() && this.order()?.isClaimed === false,
  );

  constructor() {
    combineLatest([this.route.paramMap, this.api.events()])
      .pipe(
        switchMap(([params, events]) => {
          this.index.set(Number(params.get('index') ?? 1));
          this.options.set(
            events.flatMap((e: VasbytEvent) =>
              e.distances.map((d) => ({
                ...d,
                eventName: e.name,
                discipline: this.i18n.t(e.discipline === 'Run' ? 'events.run' : 'events.cycle'),
              })),
            ),
          );
          return this.api.order(params.get('token')!);
        }),
      )
      .subscribe({
        next: (o) => {
          this.order.set(o);
          this.model = blank();
          this.sameAddress.set(this.flow.sameAddressForAll);
          this.prefillAddress(o);
        },
        error: () => this.error.set(this.i18n.t('common.error')),
      });
  }

  /** The toggle on entrant #1 carries their town and province onto everyone after them. */
  private prefillAddress(order: Order) {
    if (this.index() === 1 || !this.flow.sameAddressForAll) return;
    const first = order.entrants[0];
    if (!first) return;
    this.model.town = first.town;
    this.model.province = first.province;
  }

  protected submit(form: NgForm, order: Order) {
    if (form.invalid) return;
    this.busy.set(true);
    this.error.set(null);

    if (this.index() === 1) this.flow.sameAddressForAll = this.sameAddress();

    // Claim before adding: if the account cannot be created there is no half-entered person to undo.
    const claim = this.needsAccount()
      ? this.api.claimOrder(order.token, {
          email: this.model.email,
          password: this.password(),
          firstName: this.model.firstName,
          lastName: this.model.lastName,
        })
      : null;

    const save = () =>
      this.api
        .addEntrant(order.token, { ...this.model, clubName: this.model.clubName || null })
        .subscribe({ next: (updated) => this.advance(updated), error: (e) => this.fail(e) });

    if (claim) {
      claim.subscribe({
        next: () => {
          this.auth.refresh().subscribe();
          save();
        },
        error: (e) => this.fail(e),
      });
    } else {
      save();
    }
  }

  private advance(order: Order) {
    this.busy.set(false);
    this.order.set(order);
    if (order.entrantsFilled >= order.entrantCount) {
      this.router.navigate(['/registreer', order.token, 'klaar']);
    } else {
      this.router.navigate(['/registreer', order.token, 'deelnemer', order.entrantsFilled + 1]);
    }
  }

  private fail(e: { error?: { detail?: string } }) {
    this.busy.set(false);
    this.error.set(e.error?.detail ?? this.i18n.t('common.error'));
  }
}

function blank(): EntrantForm {
  return {
    eventDistanceId: null,
    firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', gender: '',
    shirtSize: '', emergencyName: '', emergencyPhone: '', medicalNotes: null,
    town: '', province: '', clubName: null,
  };
}
