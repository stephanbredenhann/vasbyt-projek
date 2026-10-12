import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../core/api.service';
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
