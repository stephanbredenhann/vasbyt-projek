import { Component, ElementRef, OnInit, inject, model, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PROVINCES } from '../core/api.models';
import { I18nService } from '../i18n/i18n.service';
import { loadGooglePlaces } from './google-places';

/**
 * The spec 8.1 address block: street, town, province and postcode, with Google Places autocomplete
 * layered on top when a key is configured.
 *
 * Province is always a plain <select> and is the authoritative field — the homepage map depends on
 * it, and it must be right whether Places ran or not. Places only pre-fills.
 *
 * Note for the POPIA review: with a key configured, what the entrant types here reaches Google.
 * Without one, nothing leaves this page until the form is submitted.
 */
@Component({
  selector: 'vb-address-input',
  standalone: true,
  imports: [FormsModule],
  template: `
    <label class="field">
      <span>{{ i18n.t('entrant.street') }}</span>
      <input #street type="text" [(ngModel)]="streetValue" name="streetAddress"
             autocomplete="address-line1" required />
    </label>

    <div class="field-row">
      <label class="field">
        <span>{{ i18n.t('entrant.town') }}</span>
        <input type="text" [(ngModel)]="townValue" name="town" autocomplete="address-level2" required />
      </label>

      <label class="field">
        <span>{{ i18n.t('entrant.province') }}</span>
        <select [(ngModel)]="provinceValue" name="province" required>
          <option value="" disabled>—</option>
          @for (p of provinces; track p) {
            <option [value]="p">{{ p }}</option>
          }
        </select>
        <small class="field__hint">{{ i18n.t('entrant.provinceHint') }}</small>
      </label>

      <label class="field">
        <span>{{ i18n.t('entrant.postcode') }}</span>
        <input type="text" [(ngModel)]="postcodeValue" name="postalCode" inputmode="numeric"
               autocomplete="postal-code" required />
      </label>
    </div>
  `,
})
export class AddressInput implements OnInit {
  readonly streetValue = model('', { alias: 'street' });
  readonly townValue = model('', { alias: 'town' });
  readonly provinceValue = model('', { alias: 'province' });
  readonly postcodeValue = model('', { alias: 'postcode' });

  protected readonly i18n = inject(I18nService);
  protected readonly provinces = PROVINCES;
  private readonly streetInput = viewChild.required<ElementRef<HTMLInputElement>>('street');

  async ngOnInit() {
    const places = await loadGooglePlaces();
    if (!places) return; // No key configured — the plain inputs above are the whole feature.

    const autocomplete = new places.Autocomplete(this.streetInput().nativeElement, {
      componentRestrictions: { country: 'za' },
      fields: ['address_components'],
      types: ['address'],
    });

    autocomplete.addListener('place_changed', () => {
      const components = autocomplete.getPlace()?.address_components ?? [];
      const find = (type: string) =>
        components.find((c: { types: string[] }) => c.types.includes(type))?.long_name;

      const street = [find('street_number'), find('route')].filter(Boolean).join(' ');
      if (street) this.streetValue.set(street);

      const town = find('locality') ?? find('postal_town') ?? find('sublocality');
      if (town) this.townValue.set(town);

      const postcode = find('postal_code');
      if (postcode) this.postcodeValue.set(postcode);

      const province = find('administrative_area_level_1');
      const matched = PROVINCES.find((p) => p.toLowerCase() === normalise(province));
      if (matched) this.provinceValue.set(matched);
    });
  }
}

/** Google returns the English province names; the app is keyed on the Afrikaans ones. */
const EN_TO_AF: Record<string, string> = {
  'eastern cape': 'oos-kaap',
  'free state': 'vrystaat',
  gauteng: 'gauteng',
  'kwazulu-natal': 'kwazulu-natal',
  limpopo: 'limpopo',
  mpumalanga: 'mpumalanga',
  'northern cape': 'noord-kaap',
  'north west': 'noordwes',
  'north-west': 'noordwes',
  'western cape': 'wes-kaap',
};

function normalise(name: string | undefined): string {
  const key = (name ?? '').trim().toLowerCase();
  return EN_TO_AF[key] ?? key;
}
