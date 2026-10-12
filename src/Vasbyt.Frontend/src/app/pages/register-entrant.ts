import { Component, ElementRef, HostListener, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { EntrantForm, EntrantSummary, Order } from '../core/api.models';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { I18nService } from '../i18n/i18n.service';
import { TranslationKey } from '../i18n/af';
import { AddressInput } from '../shared/address-input';
import { EntrantTabs } from './entrant-tabs';
import { TERMS, termKey } from '../shared/terms';
import { parseSaId } from '../shared/sa-id';
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
        <p class="muted">{{ i18n.t('entrant.requiredNote') }}</p>
        <p class="muted">{{ i18n.t('entrant.draftNote') }}</p>
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

            @if (missing().length) {
              <div #summary class="alert alert--error summary" tabindex="-1">
                <h2>{{ i18n.t('entrant.summaryTitle') }}</h2>
                <ul>
                  @for (name of missing(); track name) {
                    <li><button type="button" class="link" (click)="focusField(name)">{{ i18n.t(label(name)) }}</button></li>
                  }
                </ul>
              </div>
            }

            <form #f="ngForm" class="form" (ngSubmit)="submit(f, o, s)" (input)="autosave()" (change)="autosave()">
              <fieldset class="card">
                <legend>{{ i18n.t('entrant.identity') }}</legend>
                <button type="button" class="btn btn--ghost me" (click)="isBuyer(o)">{{ i18n.t('entrant.isBuyer') }}</button>
                <small class="field__hint">{{ i18n.t('entrant.isBuyerHint') }}</small>

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
                    <input type="text" name="idNumber" [ngModel]="model.idNumber" (ngModelChange)="onId($event)" required
                           inputmode="numeric" maxlength="13" autocomplete="off" />
                    @if (idCheck()) {
                      <small class="field__error">{{ i18n.t('entrant.idCheck') }}</small>
                    } @else {
                      <small class="field__hint">{{ i18n.t('entrant.idHint') }}</small>
                    }
                  </label>
                  <label class="field">
                    <span>{{ i18n.t('entrant.dob') }}</span>
                    <input type="date" name="dateOfBirth" [(ngModel)]="dob" required autocomplete="bday" />
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
                    <select name="gender" [(ngModel)]="model.gender" required autocomplete="sex">
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
                <p id="medical-ask">{{ i18n.t('entrant.medicalAsk') }}</p>
                <div class="choice" role="radiogroup" aria-labelledby="medical-ask">
                  <label class="opt" [class.is-on]="medical() === false">
                    <input type="radio" name="hasMedical" [checked]="medical() === false" (change)="setMedical(false)" />
                    <span>{{ i18n.t('common.no') }}</span>
                  </label>
                  <label class="opt" [class.is-on]="medical() === true">
                    <input type="radio" name="hasMedical" [checked]="medical() === true" (change)="setMedical(true)" />
                    <span>{{ i18n.t('common.yes') }}</span>
                  </label>
                </div>
                @if (medical()) {

                <label class="field">
                  <span>
                    {{ i18n.t('entrant.medical') }}
                    <span class="muted">({{ i18n.t('common.optional') }})</span>
                  </span>
                  <textarea name="medicalConditions" [(ngModel)]="model.medicalConditions"></textarea>
                  <small class="field__hint">{{ i18n.t('entrant.medicalHint') }}</small>
                </label>

                <label class="field">
                  <span>
                    {{ i18n.t('entrant.medication') }}
                    <span class="muted">({{ i18n.t('common.optional') }})</span>
                  </span>
                  <textarea name="medication" [(ngModel)]="model.medication"></textarea>
                </label>

                <div class="field-row">
                  <label class="field">
                    <span>
                      {{ i18n.t('entrant.medicalScheme') }}
                      <span class="muted">({{ i18n.t('common.optional') }})</span>
                    </span>
                    <input type="text" name="medicalFund" [(ngModel)]="model.medicalFund" />
                  </label>
                  <label class="field">
                    <span>
                      {{ i18n.t('entrant.medicalSchemeNumber') }}
                      <span class="muted">({{ i18n.t('common.optional') }})</span>
                    </span>
                    <input type="text" name="medicalFundNumber" [(ngModel)]="model.medicalFundNumber" />
                  </label>
                </div>
                }
              </fieldset>

              <fieldset class="card">
                <legend>{{ i18n.t('entrant.emergency') }}</legend>
                @if (sharedEmergency(); as c) {
                  <button type="button" class="btn btn--ghost me" (click)="useEmergency(c)">
                    {{ i18n.t('entrant.sameEmergency').replace('{name}', c.emergencyName).replace('{relationship}', c.emergencyRelationship) }}
                  </button>
                }
                <div class="field-row">
                  <label class="field">
                    <span>{{ i18n.t('entrant.emergencyName') }}</span>
                    <input type="text" name="emergencyName" [(ngModel)]="model.emergencyName" required
                           autocomplete="section-emergency name" />
                  </label>
                  <label class="field">
                    <span>{{ i18n.t('entrant.emergencyRelation') }}</span>
                    <input type="text" name="emergencyRelationship"
                           [(ngModel)]="model.emergencyRelationship" required />
                  </label>
                  <label class="field">
                    <span>{{ i18n.t('entrant.emergencyPhone') }}</span>
                    <input type="tel" name="emergencyPhone" [(ngModel)]="model.emergencyPhone" required
                           autocomplete="section-emergency tel" />
                  </label>
                </div>
              </fieldset>

              <fieldset class="card">
                <legend>{{ i18n.t('entrant.consents') }}</legend>

                <label class="opt" [class.is-on]="model.acceptTerms">
                  <input type="checkbox" name="acceptTerms" [(ngModel)]="model.acceptTerms" required />
                  <span>{{ i18n.t('entrant.consentTerms') }}</span>
                </label>

                <details class="terms">
                  <summary>{{ i18n.t('entrant.readTerms') }}</summary>
                  <ol>
                    @for (n of terms; track n) {
                      <li>{{ i18n.t(termKey(n)) }}</li>
                    }
                  </ol>
                </details>

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

              <p class="muted save-state" aria-live="polite">
                @switch (saveState()) {
                  @case ('saving') { {{ i18n.t('entrant.autosaving') }} }
                  @case ('saved') { {{ i18n.t('entrant.autosaved') }} }
                  @case ('failed') { <span class="field__error">{{ i18n.t('entrant.autosaveFailed') }}</span> }
                }
              </p>
              <button type="submit" class="btn btn--primary btn--lg" [disabled]="busy()">
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

    .me { margin-bottom: var(--space-2); }

    .choice { display: grid; grid-template-columns: repeat(2, minmax(0, 10rem)); gap: var(--space-3); }

    .save-state { min-height: 1.5rem; margin: 0 0 var(--space-3); }

    .summary { max-width: 48rem; }

    .summary h2 { font-size: 1.25rem; margin: 0 0 var(--space-2); }

    .link {
      background: none;
      border: 0;
      padding: 0;
      min-height: var(--field-h);
      font: inherit;
      color: var(--orange-ink);
      text-decoration: underline;
      cursor: pointer;
    }

    .terms { margin-bottom: var(--space-3); }

    .terms summary { cursor: pointer; min-height: var(--field-h); display: flex; align-items: center; }

    .terms li { margin-bottom: var(--space-2); }

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
export class RegisterEntrant implements OnDestroy {
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
  protected readonly missing = signal<string[]>([]);
  protected readonly terms = TERMS;
  protected readonly termKey = termKey;
  /** Null until answered, so nobody is nudged into "No" without reading the question. */
  protected readonly medical = signal<boolean | null>(null);
  protected readonly idCheck = signal(false);
  protected readonly saveState = signal<'idle' | 'pending' | 'saving' | 'saved' | 'failed'>('idle');
  protected readonly sharedEmergency = signal<Pick<EntrantForm, 'emergencyName' | 'emergencyRelationship' | 'emergencyPhone'> | null>(null);
  private autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly ngForm = viewChild<NgForm>('f');
  private readonly summary = viewChild<ElementRef<HTMLElement>>('summary');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

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
          this.flush();
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

  /** Warns only while typed answers have not reached the server yet. */
  @HostListener('window:beforeunload', ['$event'])
  protected warnBeforeLeaving(event: BeforeUnloadEvent) {
    if (this.busy() || ['pending', 'saving', 'failed'].includes(this.saveState())) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  ngOnDestroy() { this.flush(); }

  protected label(name: string): TranslationKey { return FIELD_LABEL[name] ?? 'entrant.formsTitle'; }

  protected focusField(name: string) {
    this.host.nativeElement.querySelector<HTMLElement>(`[name="${name}"]`)?.focus();
  }

  /** Typing schedules a save to the server, where the answers are kept encrypted until the form is submitted. */
  protected autosave() {
    if (!this.slot() || this.slot()!.isComplete || this.busy()) return;
    clearTimeout(this.autosaveTimer);
    this.saveState.set('pending');
    this.autosaveTimer = setTimeout(() => this.flush(), 800);
  }

  /** Sends a pending autosave now, for the slot still on screen. */
  private flush() {
    clearTimeout(this.autosaveTimer);
    const o = this.order();
    const s = this.slot();
    if (this.saveState() !== 'pending' || !o || !s) return;
    this.saveState.set('saving');
    this.api.saveDraft(o.token, s.id, { ...this.model, dateOfBirth: this.dob() }).subscribe({
      next: () => { if (this.saveState() === 'saving') this.saveState.set('saved'); },
      error: () => { if (this.saveState() === 'saving') this.saveState.set('failed'); },
    });
  }

  private reset(o: Order) {
    const s = this.slot();
    const address = this.flow.address(o.token);
    const emergency = this.flow.emergency(o.token);
    this.model = { ...blank(), ...address };
    this.dob.set('');
    this.sameAddress.set(!!address);
    this.medical.set(null);
    this.idCheck.set(false);
    this.saveState.set('idle');
    this.sharedEmergency.set(emergency ?? null);
    if (this.index() > o.entrants.length && o.entrants.length) {
      this.router.navigate(['/registreer', o.token, 'deelnemer', 1]);
    }
    this.missing.set([]);
    this.ngForm()?.resetForm({ ...this.model, dateOfBirth: this.dob(), sameAddress: this.sameAddress() });
    if (!s || s.isComplete) return;
    this.api.draft(o.token, s.id).subscribe({
      next: (draft) => {
        if (!draft || this.slot()?.id !== s.id) return;
        this.model = { ...blank(), ...draft };
        this.dob.set(draft.dateOfBirth ?? '');
        this.medical.set(hasMedical(this.model) || null);
        this.ngForm()?.resetForm({ ...this.model, dateOfBirth: this.dob(), sameAddress: this.sameAddress() });
      },
      error: () => {},
    });
  }

  /** A valid SA ID fills in date of birth and gender; both stay editable. */
  protected onId(value: string) {
    this.model.idNumber = value;
    const id = value.replace(/\s/g, '');
    const parsed = parseSaId(id);
    this.idCheck.set(/^\d{13}$/.test(id) && !parsed);
    if (!parsed) return;
    this.dob.set(parsed.dateOfBirth);
    this.model.gender = parsed.gender;
  }

  protected setMedical(on: boolean) {
    this.medical.set(on);
    if (!on) Object.assign(this.model, { medicalConditions: null, medication: null, medicalFund: null, medicalFundNumber: null });
  }

  protected useEmergency(c: Pick<EntrantForm, 'emergencyName' | 'emergencyRelationship' | 'emergencyPhone'>) {
    Object.assign(this.model, c);
    this.autosave();
  }

  protected submit(form: NgForm, order: Order, slot: EntrantSummary) {
    if (form.invalid) {
      this.missing.set(Object.entries(form.controls).filter(([, c]) => c.invalid).map(([n]) => n));
      setTimeout(() => this.summary()?.nativeElement.focus());
      return;
    }
    this.missing.set([]);
    clearTimeout(this.autosaveTimer);
    this.saveState.set('idle');
    this.busy.set(true);
    this.error.set(null);

    if (this.index() === 1) {
      const { streetAddress, town, province, postalCode } = this.model;
      this.flow.setAddress(order.token, this.sameAddress() ? { streetAddress, town, province, postalCode } : null);
    }

    this.api.saveEntrant(order.token, slot.id, { ...this.model, dateOfBirth: this.dob() }).subscribe({
      next: (updated) => {
        this.busy.set(false);
        const { emergencyName, emergencyRelationship, emergencyPhone } = this.model;
        this.flow.setEmergency(order.token, { emergencyName, emergencyRelationship, emergencyPhone });
        this.order.set(updated);
        this.onward(updated);
      },
      error: (e: { status?: number; error?: { code?: string } }) => {
        this.busy.set(false);
        const messages: Record<string, TranslationKey> = {
          'entrant.name_required': 'entrant.errorName',
          'entrant.id_required': 'entrant.errorId',
          'entrant.province_required': 'entrant.errorProvince',
          'entrant.emergency_required': 'entrant.errorEmergency',
          'entrant.terms_required': 'entrant.errorTerms',
          'entrant.guardian_consent_required': 'entrant.errorGuardian',
          'entrant.checked_in': 'entrant.errorCheckedIn',
          'entrant.save_conflict': 'entrant.errorConflict',
        };
        const fallback = e.status === 403 ? 'entrant.errorPayment'
          : e.status === 404 ? 'entrant.errorNotFound'
            : e.status === 409 ? 'entrant.errorConflict' : 'common.error';
        const code = e.error?.code ?? '';
        this.error.set(this.i18n.t(Object.hasOwn(messages, code) ? messages[code] : fallback));
      },
    });
  }

  /** Copies the buyer's contact details deliberately; the buyer is never assumed to be an entrant. */
  protected isBuyer(o: Order) {
    Object.assign(this.model, { firstName: o.buyerFirstName, lastName: o.buyerLastName, email: o.buyerEmail, phone: o.buyerPhone });
    this.autosave();
  }

  /** The next form still waiting, or the confirmation once every one of them is in. */
  protected onward(o: Order) {
    const next = o.entrants.findIndex((e, i) => !e.isComplete && i + 1 !== this.index());
    if (next < 0) this.router.navigate(['/registreer', o.token, 'klaar']);
    else this.router.navigate(['/registreer', o.token, 'deelnemer', next + 1]);
  }
}

const FIELD_LABEL: Record<string, TranslationKey> = {
  firstName: 'entrant.firstName', lastName: 'entrant.lastName', idNumber: 'entrant.idNumber',
  dateOfBirth: 'entrant.dob', email: 'entrant.email', phone: 'entrant.phone', gender: 'entrant.gender',
  shirtSize: 'entrant.shirt', streetAddress: 'entrant.street', town: 'entrant.town',
  province: 'entrant.province', postalCode: 'entrant.postcode', emergencyName: 'entrant.emergencyName',
  emergencyRelationship: 'entrant.emergencyRelation', emergencyPhone: 'entrant.emergencyPhone',
  acceptTerms: 'entrant.consentTermsRequired', guardianConsentName: 'entrant.guardianName',
};

function hasMedical(f: EntrantForm) {
  return !!(f.medicalConditions || f.medication || f.medicalFund || f.medicalFundNumber);
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
