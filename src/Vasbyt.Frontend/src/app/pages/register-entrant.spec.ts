import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, EMPTY, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { RegisterEntrant } from './register-entrant';

it('lists missing fields on submit and does not save', async () => {
  const saveEntrant = jasmine.createSpy('saveEntrant');
  const order = {
    token: 'abc', buyerFirstName: 'B', buyerLastName: 'B', buyerEmail: 'b@example.com', buyerPhone: '1',
    entrants: [{ id: 5, routeName: 'Route', tariffKind: 'Normal', firstName: '', lastName: '', isComplete: false, entryNumber: null }],
  };
  TestBed.configureTestingModule({ imports: [RegisterEntrant], providers: [provideRouter([]),
    { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ token: 'abc', index: '1' })) } },
    { provide: ApiService, useValue: { order: () => of(order), saveEntrant } }] });
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
    { provide: ApiService, useValue: { order: () => of(order), saveEntrant: () => EMPTY } }] });
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

it('keeps no draft for an untouched slot, so the shared address still prefills it', async () => {
  const params = new BehaviorSubject(convertToParamMap({ token: 'abc', index: '2' }));
  const slot = (id: number) => ({ id, routeName: 'Route', tariffKind: 'Normal', firstName: '', lastName: '', isComplete: false, entryNumber: null });
  const order = { token: 'abc', buyerFirstName: 'B', buyerLastName: 'B', buyerEmail: 'b@example.com', buyerPhone: '1', entrants: [slot(5), slot(6)] };
  TestBed.configureTestingModule({ imports: [RegisterEntrant], providers: [provideRouter([]),
    { provide: ActivatedRoute, useValue: { paramMap: params } },
    { provide: ApiService, useValue: { order: () => of(order), saveEntrant: () => EMPTY } }] });
  const flow = TestBed.inject(OrderFlowService);
  const fixture = TestBed.createComponent(RegisterEntrant);
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  params.next(convertToParamMap({ token: 'abc', index: '1' }));
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  expect(flow.draft('abc', 6)).toBeUndefined();
});
