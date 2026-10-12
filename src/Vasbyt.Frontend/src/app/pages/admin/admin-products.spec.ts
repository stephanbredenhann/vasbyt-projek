import { mergeProducts } from './admin-products';

type P = { id?: number; name: string };

describe('mergeProducts', () => {
  const a: P = { id: 1, name: 'A edited' };
  const b: P = { id: 2, name: 'B edited' };

  it('keeps the edited draft of another product', () => {
    const out = mergeProducts([a, b], [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], 1);
    expect(out[1]).toBe(b);
  });

  it('takes the fresh copy of the saved product', () => {
    const fresh = { id: 1, name: 'A' };
    expect(mergeProducts([a, b], [fresh, { id: 2, name: 'B' }], 1)[0]).toBe(fresh);
  });

  it('takes the fresh copy for a deleted product when its own id is passed', () => {
    const fresh = { id: 1, name: 'A' };
    expect(mergeProducts([a, b], [fresh], 1)[0]).toBe(fresh);
  });

  it('keeps unsaved new drafts at the top', () => {
    const draft: P = { name: 'New' };
    const out = mergeProducts([draft, a], [{ id: 1, name: 'A' }], 1);
    expect(out[0]).toBe(draft);
    expect(out.length).toBe(2);
  });

  it('adds a product that is new on the server', () => {
    const added = { id: 3, name: 'C' };
    expect(mergeProducts([a], [{ id: 1, name: 'A' }, added], 1)).toContain(added);
  });
});
