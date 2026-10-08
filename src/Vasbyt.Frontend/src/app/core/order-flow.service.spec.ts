import { TestBed } from '@angular/core/testing';
import { Order } from './api.models';
import { OrderFlowService } from './order-flow.service';

describe('OrderFlowService', () => {
  const fresh = () => {
    TestBed.resetTestingModule();
    return TestBed.inject(OrderFlowService);
  };

  beforeEach(() => localStorage.clear());

  it('recovers from corrupt or malformed storage', () => {
    localStorage.setItem('vasbyt.cart', '{not json');
    expect(fresh().isEmpty()).toBeTrue();
    localStorage.setItem('vasbyt.cart', JSON.stringify({ products: [{ productVariantId: 'x', quantity: 2 }, { productVariantId: 3, quantity: 99 }] }));
    expect(fresh().cart().products).toEqual([]);
  });

  it('shares one basket between shop and entries, and dropping tickets keeps products', () => {
    const flow = fresh();
    flow.setProduct(7, 2);
    flow.setTicket(1, 'Normal', 1);
    flow.setProduct(7, 3);
    expect(flow.cart().products).toEqual([{ productVariantId: 7, quantity: 3 }]);
    flow.setTicket(1, 'Normal', 0);
    expect(flow.ticketCount()).toBe(0);
    expect(flow.productCount()).toBe(3);
    expect(fresh().productCount()).toBe(3);
  });

  it('keeps the checkout key for an unchanged basket and rotates it on an edit', () => {
    const flow = fresh();
    flow.setProduct(7, 1);
    const key = flow.checkoutKey();
    expect(flow.checkoutKey()).toBe(key);
    flow.setProduct(7, 1);
    expect(flow.checkoutKey()).toBe(key);
    flow.setProduct(7, 2);
    expect(flow.checkoutKey()).not.toBe(key);
  });

  it('a paid order clears only the basket revision it was made from', () => {
    const flow = fresh();
    flow.setProduct(7, 1);
    const submitted = flow.cart().revision;
    flow.savePending({ token: 'a', version: 1 } as Order, submitted);
    flow.setProduct(8, 1);
    expect(flow.clearIfRevision(submitted)).toBeFalse();
    expect(flow.productCount()).toBe(2);
    flow.clearPending('other');
    expect(flow.pending?.token).toBe('a');
    flow.clearPending('a');
    expect(flow.pending).toBeNull();
  });

  it('sign out forgets the buyer and private pointers but keeps the selections', () => {
    const flow = fresh();
    flow.setProduct(7, 1);
    flow.setBuyer({ firstName: 'A', lastName: 'B', email: 'a@b.co', phone: '' });
    flow.savePending({ token: 'a', version: 1 } as Order, flow.cart().revision);
    flow.signOut();
    expect(flow.cart().buyer.email).toBe('');
    expect(flow.pending).toBeNull();
    expect(flow.token).toBeNull();
    expect(flow.productCount()).toBe(1);
  });
});
