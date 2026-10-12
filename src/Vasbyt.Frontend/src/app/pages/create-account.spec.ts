import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { OrderFlowService } from '../core/order-flow.service';
import { CreateAccount } from './create-account';

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
