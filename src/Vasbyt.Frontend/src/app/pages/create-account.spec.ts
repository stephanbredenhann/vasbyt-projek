import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { CreateAccount } from './create-account';
import { AuthService } from '../core/auth.service';
import { I18nService } from '../i18n/i18n.service';
import { throwError } from 'rxjs';

afterEach(() => localStorage.setItem('vasbyt.locale', 'af'));

async function open(terug: string) {
  TestBed.configureTestingModule({ imports: [CreateAccount], providers: [provideRouter([]),
    { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ terug }) } } },
    { provide: OrderFlowService, useValue: { cart: () => ({ buyer: { firstName: 'Shop', lastName: 'Buyer', email: 'shop@example.com' } }) } },
    { provide: ApiService, useValue: { order: () => of({ reference: '000017', buyerFirstName: 'Receipt', buyerLastName: 'Buyer', buyerEmail: 'r@example.com' }) } }] });
  const fixture = TestBed.createComponent(CreateAccount);
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  return fixture;
}
const first = (el: HTMLElement) => el.querySelector<HTMLInputElement>('input[name="firstName"]')!;

it('starts blank from a receipt and fills the buyer only on request', async () => {
  const fixture = await open('/bestel/abc/klaar');
  const root = fixture.nativeElement as HTMLElement;
  expect(first(root).value).toBe('');
  root.querySelector<HTMLButtonElement>('form > button.btn--ghost')!.click();
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  expect(first(root).value).toBe('Receipt');
});

it('prefills from the basket at checkout', async () => {
  const fixture = await open('/bestel');
  expect(first(fixture.nativeElement).value).toBe('Shop');
});

for (const locale of ['af', 'en'] as const) {
  it(`shows a translated duplicate-email registration error in ${locale}`, async () => {
    TestBed.configureTestingModule({ imports: [CreateAccount], providers: [provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      { provide: AuthService, useValue: { createAccount: () => throwError(() => ({ status: 400, error: { code: 'registration.email_duplicate', detail: 'RAW IDENTITY DETAIL' } })) } }] });
    const fixture = TestBed.createComponent(CreateAccount);
    const i18n = TestBed.inject(I18nService); i18n.use(locale);
    const component = fixture.componentInstance as any;
    component.model = { firstName: 'A', lastName: 'B', email: 'a@example.com', password: 'Vasbyt2026' };
    component.submit({ invalid: false });
    fixture.detectChanges();
    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')!.textContent!;
    expect(alert).toContain(locale === 'en' ? 'already registered' : 'reeds geregistreer');
    expect(alert).not.toContain('RAW IDENTITY DETAIL');
  });

  for (const testCase of [
    { code: 'registration.password_requirements', text: locale === 'en' ? 'uppercase letter' : 'hoofletter' },
    { code: 'registration.invitation_invalid', text: locale === 'en' ? 'invitation is invalid' : 'uitnodiging is ongeldig' },
  ]) {
    it(`translates ${testCase.code} in ${locale}`, () => {
      TestBed.configureTestingModule({ imports: [CreateAccount], providers: [provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: AuthService, useValue: { createAccount: () => throwError(() => ({ status: 400, error: { code: testCase.code, detail: 'RAW DETAIL' } })) } }] });
      const fixture = TestBed.createComponent(CreateAccount);
      TestBed.inject(I18nService).use(locale);
      const component = fixture.componentInstance as any;
      component.model = { firstName: 'A', lastName: 'B', email: 'a@example.com', password: 'Vasbyt2026' };
      component.submit({ invalid: false });
      expect(component.error()).toContain(testCase.text);
      expect(component.error()).not.toContain('RAW DETAIL');
    });
  }
}

it('hides unknown registration details behind the translated generic error', () => {
  TestBed.configureTestingModule({ imports: [CreateAccount], providers: [provideRouter([]),
    { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
    { provide: AuthService, useValue: { createAccount: () => throwError(() => ({ status: 500, error: { detail: 'RAW SERVER SECRET' } })) } }] });
  const fixture = TestBed.createComponent(CreateAccount);
  const component = fixture.componentInstance as any;
  component.model = { firstName: 'A', lastName: 'B', email: 'a@example.com', password: 'Vasbyt2026' };
  component.submit({ invalid: false });
  expect(component.error()).toBe(TestBed.inject(I18nService).t('common.error'));
});

it('treats inherited object property names as unknown registration codes', () => {
  TestBed.configureTestingModule({ imports: [CreateAccount], providers: [provideRouter([]),
    { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
    { provide: AuthService, useValue: { createAccount: () => throwError(() => ({ status: 400, error: { code: 'constructor', detail: 'RAW DETAIL' } })) } }] });
  const fixture = TestBed.createComponent(CreateAccount);
  const component = fixture.componentInstance as any;
  component.model = { firstName: 'A', lastName: 'B', email: 'a@example.com', password: 'Vasbyt2026' };
  component.submit({ invalid: false });
  expect(component.error()).toBe(TestBed.inject(I18nService).t('common.error'));
});
