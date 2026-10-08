import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { EntrantForm, EntrantSummary, Order } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { AddressInput } from '../shared/address-input';
import { EntrantTabs } from './entrant-tabs';
import { Steps } from './steps';

/**
 * The participant forms, once per ticket. Payment already created this form and bound it to a route and a
 * tariff, so the screen fills a stub in and never creates one: it sends neither field, and the
 * server refuses them anyway. Route and tariff are shown as fixed facts.
 */
@Component({
  selector: 'vb-register-entrant',
  standalone: true,
  imports: [FormsModule, AddressInput, EntrantTabs, Steps],
  template: `
    <div class="container section">
      <vb-steps current="forms" />
      <h1>{{ i18n.t('entrant.formsTitle') }}</h1>

      @if (order(); as o) {
        <p class="lead">{{ i18n.t('entrant.formsIntro') }}</p>
        <vb-entrant-tabs [order]="o" [current]="index()" />

        @if (slot(); as s) {
          <div class="fixed">
            <div>
              <span class="eyebrow">{{ i18n.t('entrant.route') }}</span>
              <strong>{{ s.routeName }}</strong>
            </div>
            <div>
              <span class="eyebrow">{{ i18n.t('entrant.tariff') }}</span>
              <strong>{{ i18n.t(s.tariffKind === 'Student' ? 'reg.student' : 'reg.normal') }}</strong>
            </div>
            @if (s.entryNumber) {
              <div>
                <span class="eyebrow">{{ i18n.t('entrant.entryNumber') }}</span>
                <strong>{{ s.entryNumber }}</strong>
              </div>
            }
          </div>

          @if (s.isComplete) {
            <!-- ponytail: read-only once submitted. The order response deliberately carries no
                 address and no medical field, so there is nothing here to prefill an edit with;
                 admins can already correct a typo through /api/admin/entrants/{id}. -->
            <div class="card done">
              <h2>{{ s.firstName }} {{ s.lastName }}</h2>
              <p class="alert">{{ i18n.t('entrant.locked') }}</p>
              <button type="button" class="btn btn--primary" (click)="onward(o)">
                {{ i18n.t('reg.continue') }}
              </button>
            </div>
          } @else {
            @if (error()) {
              <p class="alert alert--error">{{ error() }}</p>
            }

            <form #f="ngForm" class="form" (ngSubmit)="submit(f, o, s)">
              <fieldset class="card">
                <legend>{{ i18n.t('entrant.identity') }}</legend>
                <button type="button" class="btn btn--ghost btn--sm me" (click)="isBuyer(o)">{{ i18n.t('entrant.isBuyer') }}</button>

                <div class="field-row">
                  <label class="field">
                    <span>{{ i18n.t('entrant.firstName') }}</span>
                    <input type="text" name="firstName" [(ngModel)]="model.firstName" required
                           autocomplete="given-name" />
                  </label>
                  <label class="field">
                    <span>{{ i18n.t('entrant.lastName') }}</span>
                    <input type="text" name="lastName" [(ngModel)]="model.lastName" required
                           autocomplete="family-name" />
                  </label>
                </div>

                <div class="field-row">
                  <label class="field">
                    <span>{{ i18n.t('entrant.idNumber') }}</span>
                    <input type="text" name="idNumber" [(ngModel)]="model.idNumber" required
                           inputmode="numeric" maxlength="13" />
                  </label>
                  <label class="field">
                    <span>{{ i18n.t('entrant.dob') }}</span>
                    <input type="date" name="dateOfBirth" [(ngModel)]="dob" required />
                  </label>
                </div>

                <div class="field-row">
                  <label class="field">
                    <span>{{ i18n.t('entrant.email') }}</span>
                    <input type="email" name="email" [(ngModel)]="model.email" required
                           autocomplete="email" />
                  </label>
                  <label class="field">
                    <span>{{ i18n.t('entrant.phone') }}</span>
                    <input type="tel" name="phone" [(ngModel)]="model.phone" required
                           autocomplete="tel" />
                  </label>
                </div>

                <div class="field-row">
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
                  <label class="field">
                    <span>
                      {{ i18n.t('entrant.club') }}
                      <span class="muted">({{ i18n.t('common.optional') }})</span>
                    </span>
                    <input type="text" name="clubName" [(ngModel)]="model.clubName" />
                  </label>
                </div>
              </fieldset>

              <fieldset class="card">
                <legend>{{ i18n.t('entrant.address') }}</legend>
                <vb-address-input
                  [(street)]="model.streetAddress"
                  [(town)]="model.town"
                  [(province)]="model.province"
                  [(postcode)]="model.postalCode"
                />

                @if (index() === 1 && o.entrants.length > 1) {
                  <label class="opt" [class.is-on]="sameAddress()">
                    <input type="checkbox" name="sameAddress" [(ngModel)]="sameAddress" />
                    <span>{{ i18n.t('entrant.sameAddress') }}</span>
                  </label>
                }
              </fieldset>

              <fieldset class="card">
                <legend>{{ i18n.t('entrant.medicalTitle') }}</legend>

                <label class="field">
                  <span>{{ i18n.t('entrant.medical') }}</span>
                  <textarea name="medicalConditions" [(ngModel)]="model.medicalConditions"></textarea>
                  <small class="field__hint">{{ i18n.t('entrant.medicalHint') }}</small>
                </label>

                <label class="field">
                  <span>{{ i18n.t('entrant.medication') }}</span>
                  <textarea name="medication" [(ngModel)]="model.medication"></textarea>
                </label>

                <div class="field-row">
                  <label class="field">
                    <span>{{ i18n.t('entrant.medicalScheme') }}</span>
                    <input type="text" name="medicalFund" [(ngModel)]="model.medicalFund" />
                  </label>
                  <label class="field">
                    <span>{{ i18n.t('entrant.medicalSchemeNumber') }}</span>
                    <input type="text" name="medicalFundNumber" [(ngModel)]="model.medicalFundNumber" />
                  </label>
                </div>
              </fieldset>

              <fieldset class="card">
                <legend>{{ i18n.t('entrant.emergency') }}</legend>
                <div class="field-row">
                  <label class="field">
                    <span>{{ i18n.t('entrant.emergencyName') }}</span>
                    <input type="text" name="emergencyName" [(ngModel)]="model.emergencyName" required />
                  </label>
                  <label class="field">
                    <span>{{ i18n.t('entrant.emergencyRelation') }}</span>
                    <input type="text" name="emergencyRelationship"
                           [(ngModel)]="model.emergencyRelationship" required />
                  </label>
                  <label class="field">
                    <span>{{ i18n.t('entrant.emergencyPhone') }}</span>
                    <input type="tel" name="emergencyPhone" [(ngModel)]="model.emergencyPhone" required />
                  </label>
                </div>
              </fieldset>

              <fieldset class="card">
                <legend>{{ i18n.t('entrant.consents') }}</legend>

                <label class="opt" [class.is-on]="model.acceptTerms">
                  <input type="checkbox" name="acceptTerms" [(ngModel)]="model.acceptTerms" required />
                  <span>{{ i18n.t('entrant.consentTerms') }}</span>
                </label>

                @if (isMinor()) {
                  <p class="alert">{{ i18n.t('entrant.minorNote') }}</p>
                  <label class="field">
                    <span>{{ i18n.t('entrant.guardianName') }}</span>
                    <input type="text" name="guardianConsentName"
                           [(ngModel)]="model.guardianConsentName" [required]="isMinor()" />
                    <small class="field__hint">{{ i18n.t('entrant.consentGuardian') }}</small>
                  </label>
                }

                <label class="opt" [class.is-on]="model.photoConsent">
                  <input type="checkbox" name="photoConsent" [(ngModel)]="model.photoConsent" />
                  <span>{{ i18n.t('entrant.consentPhotos') }}</span>
                </label>

                @if (f.submitted && !model.acceptTerms) {
                  <p class="field__error">{{ i18n.t('entrant.consentTermsRequired') }}</p>
                }
              </fieldset>

              <button type="submit" class="btn btn--primary btn--lg" [disabled]="busy() || f.invalid">
                {{ busy() ? i18n.t('entrant.saving') : i18n.t('entrant.save') }}
              </button>
            </form>
          }
        }
      } @else if (error()) {
        <p class="alert alert--error">{{ error() }}</p>
      } @else {
        <p class="muted">{{ i18n.t('common.loading') }}</p>
      }
    </div>
  `,
  styles: `
    .form,
    .done,
    .fixed {
      max-width: 48rem;
    }

    /* Three levels of rectangle used to stack up here. The card carries the edge now. */
    fieldset {
      border: 0;
      min-width: 0;
      margin: 0 0 var(--space-6);
    }

    .me { margin-bottom: var(--space-4); }

    legend {
      padding: 0;
      margin-bottom: var(--space-4);
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: var(--ink);
    }

    .fixed {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4) var(--space-8);
      background: var(--karoo-sand-light);
      border-radius: var(--r-md);
      padding: var(--space-4) var(--space-6);
      margin-bottom: var(--space-6);
    }

    .fixed > div {
      display: flex;
      flex-direction: column;
    }

    .fixed strong {
      font-family: var(--font-display);
      font-size: 1.25rem;
    }

    .opt {
      display: flex;
      align-items: start;
      gap: var(--space-3);
      background: var(--karoo-sand-light);
      border-radius: var(--r-md);
      padding: var(--space-4);
      margin-bottom: var(--space-3);
      font-size: 0.9375rem;
      cursor: pointer;
    }

    .opt.is-on {
      background: var(--paper);
      box-shadow: inset 0 0 0 2px var(--indigo), var(--shadow-1);
    }

    .opt input {
      margin-top: 0.2rem;
      accent-color: var(--indigo);
    }
  `,
})
export class RegisterEntrant {
  protected readonly i18n = inject(I18nService);
  private api = inject(ApiService);
  private flow = inject(OrderFlowService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected readonly shirtSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  protected readonly order = signal<Order | null>(null);
  protected readonly index = signal(1);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sameAddress = signal(false);
  protected readonly dob = signal('');

  protected model = blank();

  protected readonly slot = computed(() => this.order()?.entrants[this.index() - 1] ?? null);

  /** Spec 8.1: guardian consent is derived from the date of birth, never asked for twice. */
  protected readonly isMinor = computed(() => {
    const dob = this.dob();
    if (!dob) return false;
    const eighteen = new Date();
    eighteen.setFullYear(eighteen.getFullYear() - 18);
    return new Date(dob) > eighteen;
  });

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.keepDraft();
          this.index.set(Math.max(1, Number(params.get('index') ?? 1)));
          return this.api.order(params.get('token')!);
        }),
      )
      .subscribe({
        next: (o) => {
          this.order.set(o);
          this.reset(o);
        },
        error: () => this.error.set(this.i18n.t('common.error')),
      });
  }

  /** Switching tabs keeps what was typed, in memory only: these fields are too sensitive for storage. */
  private keepDraft() {
    const o = this.order();
    const s = this.slot();
    if (o && s && !s.isComplete) this.flow.saveDraft(o.token, s.id, { ...this.model, dateOfBirth: this.dob() });
  }

  private reset(o: Order) {
    const s = this.slot();
    const draft = s ? this.flow.draft(o.token, s.id) : undefined;
    const address = this.flow.address(o.token);
    this.model = draft ? { ...draft } : blank();
    this.dob.set(draft?.dateOfBirth ?? '');
    this.sameAddress.set(!!address);
    if (!draft && address) Object.assign(this.model, address);
    if (this.index() > o.entrants.length && o.entrants.length) {
      this.router.navigate(['/registreer', o.token, 'deelnemer', 1]);
    }
  }

  protected submit(form: NgForm, order: Order, slot: EntrantSummary) {
    if (form.invalid) return;
    this.busy.set(true);
    this.error.set(null);

    if (this.index() === 1) {
      const { streetAddress, town, province, postalCode } = this.model;
      this.flow.setAddress(order.token, this.sameAddress() ? { streetAddress, town, province, postalCode } : null);
    }

    this.api.saveEntrant(order.token, slot.id, { ...this.model, dateOfBirth: this.dob() }).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.flow.clearDraft(order.token, slot.id);
        this.order.set(updated);
        this.onward(updated);
      },
      error: (e: { error?: { detail?: string } }) => {
        this.busy.set(false);
        this.error.set(e.error?.detail ?? this.i18n.t('common.error'));
      },
    });
  }

  /** Copies the buyer's contact details deliberately; the buyer is never assumed to be an entrant. */
  protected isBuyer(o: Order) {
    Object.assign(this.model, { firstName: o.buyerFirstName, lastName: o.buyerLastName, email: o.buyerEmail, phone: o.buyerPhone });
  }

  /** The next form still waiting, or the confirmation once every one of them is in. */
  protected onward(o: Order) {
    const next = o.entrants.findIndex((e, i) => !e.isComplete && i + 1 !== this.index());
    if (next < 0) this.router.navigate(['/registreer', o.token, 'klaar']);
    else this.router.navigate(['/registreer', o.token, 'deelnemer', next + 1]);
  }
}

function blank(): EntrantForm {
  return {
    firstName: '', lastName: '', idNumber: '', email: '', phone: '', dateOfBirth: '',
    gender: '', shirtSize: '', streetAddress: '', town: '', province: '', postalCode: '',
    medicalConditions: null, medication: null, medicalFund: null, medicalFundNumber: null,
    emergencyName: '', emergencyRelationship: '', emergencyPhone: '', clubName: null,
    acceptTerms: false, guardianConsentName: null, photoConsent: false,
  };
}
