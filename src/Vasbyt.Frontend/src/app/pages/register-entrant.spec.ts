import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, EMPTY, of, throwError } from 'rxjs';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { RegisterEntrant } from './register-entrant';
import { I18nService } from '../i18n/i18n.service';

afterEach(() => localStorage.setItem('vasbyt.locale', 'af'));

it('lists missing fields on submit and does not save', async () => {
  const saveEntrant = jasmine.createSpy('saveEntrant');
  const order = {
    token: 'abc', buyerFirstName: 'B', buyerLastName: 'B', buyerEmail: 'b@example.com', buyerPhone: '1',
    entrants: [{ id: 5, routeName: 'Route', tariffKind: 'Normal', firstName: '', lastName: '', isComplete: false, entryNumber: null }],
  };
  TestBed.configureTestingModule({ imports: [RegisterEntrant], providers: [provideRouter([]),
    { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ token: 'abc', index: '1' })) } },
    { provide: ApiService, useValue: { draft: () => of(null), saveDraft: () => of(undefined), order: () => of(order), saveEntrant } }] });
  const fixture = TestBed.createComponent(RegisterEntrant);
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const save = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  expect(save.disabled).toBeFalse();
  save.click();
  fixture.detectChanges();
  expect(root.querySelector('.summary')!.textContent).toContain('Naam');
  expect(saveEntrant).not.toHaveBeenCalled();
});

it('clears the missing summary and submitted state when switching participants', async () => {
  const params = new BehaviorSubject(convertToParamMap({ token: 'abc', index: '1' }));
  const slot = (id: number) => ({ id, routeName: 'Route', tariffKind: 'Normal', firstName: '', lastName: '', isComplete: false, entryNumber: null });
  const order = { token: 'abc', buyerFirstName: 'B', buyerLastName: 'B', buyerEmail: 'b@example.com', buyerPhone: '1', entrants: [slot(5), slot(6)] };
  TestBed.configureTestingModule({ imports: [RegisterEntrant], providers: [provideRouter([]),
    { provide: ActivatedRoute, useValue: { paramMap: params } },
    { provide: ApiService, useValue: { draft: () => of(null), saveDraft: () => of(undefined), order: () => of(order), saveEntrant: () => EMPTY } }] });
  const fixture = TestBed.createComponent(RegisterEntrant);
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  root.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  fixture.detectChanges();
  expect(root.querySelector('.summary')).not.toBeNull();
  params.next(convertToParamMap({ token: 'abc', index: '2' }));
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  expect(root.querySelector('.summary')).toBeNull();
  expect(root.querySelector('form')!.classList).not.toContain('ng-submitted');
});

it('restores the server draft and saves edits there when switching participants', async () => {
  const params = new BehaviorSubject(convertToParamMap({ token: 'abc', index: '1' }));
  const entrants = [5, 6].map((id) => ({ id, routeName: 'Route', tariffKind: 'Normal', firstName: '', lastName: '', isComplete: false, entryNumber: null }));
  const saveDraft = jasmine.createSpy('saveDraft').and.returnValue(of(undefined));
  const draft = (_: string, id: number) => of(id === 5 ? { firstName: 'Kept', medication: 'Asma' } : null);
  TestBed.configureTestingModule({ imports: [RegisterEntrant], providers: [provideRouter([]),
    { provide: ActivatedRoute, useValue: { paramMap: params } },
    { provide: ApiService, useValue: { draft, saveDraft, order: () => of({ token: 'abc', buyerFirstName: 'B', buyerLastName: 'B', buyerEmail: 'b@example.com', buyerPhone: '1', entrants }), saveEntrant: () => EMPTY } }] });
  const fixture = TestBed.createComponent(RegisterEntrant);
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  const component = fixture.componentInstance as any;
  expect(component.model.firstName).toBe('Kept');
  expect(component.medical()).toBeTrue();
  const first = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[name="firstName"]')!;
  first.value = 'Edited'; first.dispatchEvent(new Event('input', { bubbles: true })); fixture.detectChanges();
  params.next(convertToParamMap({ token: 'abc', index: '2' }));
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  expect(saveDraft).toHaveBeenCalledOnceWith('abc', 5, jasmine.objectContaining({ firstName: 'Edited' }));
  expect(component.model.firstName).toBe('');
  fixture.destroy();
  expect(saveDraft).toHaveBeenCalledTimes(1);
});

it('warns only while typed answers have not reached the server', async () => {
  const order = { token: 'abc', buyerFirstName: 'B', buyerLastName: 'B', buyerEmail: 'b@example.com', buyerPhone: '1',
    entrants: [{ id: 5, routeName: 'Route', tariffKind: 'Normal', firstName: '', lastName: '', isComplete: false, entryNumber: null }] };
  TestBed.configureTestingModule({ imports: [RegisterEntrant], providers: [provideRouter([]),
    { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ token: 'abc', index: '1' })) } },
    { provide: ApiService, useValue: { draft: () => of(null), saveDraft: () => of(undefined), order: () => of(order), saveEntrant: () => EMPTY } }] });
  const fixture = TestBed.createComponent(RegisterEntrant);
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  const component = fixture.componentInstance as any;
  const warns = () => { const e = new Event('beforeunload', { cancelable: true }); component.warnBeforeLeaving(e); return e.defaultPrevented; };
  expect(warns()).toBeFalse();
  const first = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[name="firstName"]')!;
  first.value = 'Typed'; first.dispatchEvent(new Event('input', { bubbles: true })); fixture.detectChanges();
  expect(warns()).toBeTrue();
  component.flush();
  expect(warns()).toBeFalse();
});

it('fills date of birth and gender from a valid SA ID and flags an invalid one', async () => {
  const order = { token: 'abc', buyerFirstName: 'B', buyerLastName: 'B', buyerEmail: 'b@example.com', buyerPhone: '1',
    entrants: [{ id: 5, routeName: 'Route', tariffKind: 'Normal', firstName: '', lastName: '', isComplete: false, entryNumber: null }] };
  TestBed.configureTestingModule({ imports: [RegisterEntrant], providers: [provideRouter([]),
    { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ token: 'abc', index: '1' })) } },
    { provide: ApiService, useValue: { draft: () => of(null), saveDraft: () => of(undefined), order: () => of(order), saveEntrant: () => EMPTY } }] });
  const fixture = TestBed.createComponent(RegisterEntrant);
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  const component = fixture.componentInstance as any;
  component.onId('8503125800081');
  expect(component.dob()).toBe('1985-03-12');
  expect(component.model.gender).toBe('M');
  expect(component.idCheck()).toBeFalse();
  component.onId('8503125800086');
  expect(component.idCheck()).toBeTrue();
});

for (const locale of ['af', 'en'] as const) {
  it(`translates participant validation errors and keeps the draft in ${locale}`, async () => {
    const slot = { id: 5, routeName: 'Route', tariffKind: 'Normal', firstName: '', lastName: '', isComplete: false, entryNumber: null };
    const order = { token: 'abc', buyerFirstName: 'B', buyerLastName: 'B', buyerEmail: 'b@example.com', buyerPhone: '1', entrants: [slot] };
    TestBed.configureTestingModule({ imports: [RegisterEntrant], providers: [provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ token: 'abc', index: '1' })) } },
      { provide: ApiService, useValue: { draft: () => of(null), saveDraft: () => of(undefined), order: () => of(order), saveEntrant: () => throwError(() => ({ status: 400, error: { code: 'entrant.name_required', detail: 'RAW VALIDATION DETAIL' } })) } }] });
    const fixture = TestBed.createComponent(RegisterEntrant);
    TestBed.inject(I18nService).use(locale);
    fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.model.firstName = 'Typed value';
    component.submit({ invalid: false }, order, slot);
    fixture.detectChanges();
    expect(component.error()).toContain(locale === 'en' ? 'first and last name' : 'naam en van');
    expect(component.error()).not.toContain('RAW VALIDATION DETAIL');
    expect(component.model.firstName).toBe('Typed value');
  });
}

it('uses translated status fallbacks and hides unknown participant details', async () => {
  const slot = { id: 5, routeName: 'Route', tariffKind: 'Normal', firstName: '', lastName: '', isComplete: false, entryNumber: null };
  const order = { token: 'abc', buyerFirstName: 'B', buyerLastName: 'B', buyerEmail: 'b@example.com', buyerPhone: '1', entrants: [slot] };
  TestBed.configureTestingModule({ imports: [RegisterEntrant], providers: [provideRouter([]),
    { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ token: 'abc', index: '1' })) } },
    { provide: ApiService, useValue: { draft: () => of(null), saveDraft: () => of(undefined), order: () => of(order), saveEntrant: () => throwError(() => ({ status: 403, error: { detail: 'RAW SERVER DETAIL' } })) } }] });
  const fixture = TestBed.createComponent(RegisterEntrant);
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  const component = fixture.componentInstance as any;
  component.submit({ invalid: false }, order, slot);
  expect(component.error()).toBe(TestBed.inject(I18nService).t('entrant.errorPayment'));
  expect(component.error()).not.toContain('RAW SERVER DETAIL');
});

it('maps missing order, conflict, and unknown participant errors to translations', async () => {
  const slot = { id: 5, routeName: 'Route', tariffKind: 'Normal', firstName: '', lastName: '', isComplete: false, entryNumber: null };
  const order = { token: 'abc', buyerFirstName: 'B', buyerLastName: 'B', buyerEmail: 'b@example.com', buyerPhone: '1', entrants: [slot] };
  let failure: any = { status: 404, error: { detail: 'RAW NOT FOUND' } };
  TestBed.configureTestingModule({ imports: [RegisterEntrant], providers: [provideRouter([]),
    { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ token: 'abc', index: '1' })) } },
    { provide: ApiService, useValue: { draft: () => of(null), saveDraft: () => of(undefined), order: () => of(order), saveEntrant: () => throwError(() => failure) } }] });
  const fixture = TestBed.createComponent(RegisterEntrant);
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  const component = fixture.componentInstance as any;
  component.submit({ invalid: false }, order, slot);
  expect(component.error()).toBe(TestBed.inject(I18nService).t('entrant.errorNotFound'));
  failure = { status: 409, error: { detail: 'RAW CONFLICT' } };
  component.submit({ invalid: false }, order, slot);
  expect(component.error()).toBe(TestBed.inject(I18nService).t('entrant.errorConflict'));
  failure = { status: 400, error: { code: 'constructor', detail: 'RAW UNKNOWN' } };
  component.submit({ invalid: false }, order, slot);
  expect(component.error()).toBe(TestBed.inject(I18nService).t('common.error'));
  expect(component.error()).not.toContain('RAW UNKNOWN');
});
