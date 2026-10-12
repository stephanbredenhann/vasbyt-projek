import { mergeProducts } from './admin-products';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AdminProducts } from './admin-products';

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

describe('AdminProducts save scope', () => {
  const product = () => ({ id: 1, name: 'Shirt', description: 'Edited description', imageFileName: null, imageUrl: null,
    sortOrder: 1, isActive: true, variants: [
      { id: 10, label: 'S', priceZar: 100, stock: 5, trackStock: true, isActive: true, version: 2 },
      { id: 11, label: 'M', priceZar: 120, stock: 6, trackStock: true, isActive: true, version: 3 },
    ] });

  function open(api: Partial<ApiService>) {
    TestBed.configureTestingModule({ imports: [AdminProducts], providers: [{ provide: ApiService, useValue: api }] });
    const fixture = TestBed.createComponent(AdminProducts);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.products.set([{ ...product(), multiple: true }]);
    return { fixture, component };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('refreshes one saved variant without replacing sibling and detail drafts', () => {
    const fresh = { ...product(), description: 'Server description', variants: [
      { id: 10, label: 'S', priceZar: 110, stock: 5, trackStock: true, isActive: true, version: 3 },
      { id: 11, label: 'M', priceZar: 120, stock: 6, trackStock: true, isActive: true, version: 3 },
    ] };
    const { component } = open({ adminProducts: () => of([fresh]) as any, adminSaveVariant: () => of({}) as any });
    const draft = component.products()[0];
    draft.variants[0].priceZar = 110;
    draft.variants[1].priceZar = 135;
    draft.variants[1].stock = 9;
    component.saveVariant(1, draft.variants[0]);
    expect(component.products()[0].variants[1].priceZar).toBe(135);
    expect(component.products()[0].variants[1].stock).toBe(9);
    expect(component.products()[0].description).toBe('Edited description');
  });

  it('preserves newer edits made while a product save and refetch are pending', () => {
    const response = new Subject<any>();
    const { component } = open({ adminProducts: () => of([product()]) as any, adminSaveProduct: () => response as any });
    const draft = component.products()[0];
    component.save(draft);
    draft.description = 'Typed while saving';
    response.next({}); response.complete();
    expect(component.products()[0].description).toBe('Typed while saving');
    expect(component.products()[0].variants[1].priceZar).toBe(120);
  });

  it('keeps edited and new variant rows when saving product details', () => {
    const { component } = open({ adminProducts: () => of([product()]) as any, adminSaveProduct: () => of({}) as any });
    const draft = component.products()[0];
    draft.variants[1].priceZar = 145;
    draft.variants.push({ label: 'L', priceZar: 150, stock: 2, trackStock: true, isActive: true, version: 0 });
    component.save(draft);
    expect(component.products()[0].variants[1].priceZar).toBe(145);
    expect(component.products()[0].variants[2].label).toBe('L');
  });

  it('uses a returned new variant id on the next save', () => {
    const saved: any = jasmine.createSpy('adminSaveVariant').and.returnValues(of({ id: 12 }), of(undefined));
    const server = { ...product(), variants: [...product().variants, { id: 12, label: 'L', priceZar: 150, stock: 2, trackStock: true, isActive: true, version: 1 }] };
    const { component } = open({ adminProducts: () => of([server]) as any, adminSaveVariant: saved });
    const draft = component.products()[0];
    const row: any = { label: 'L', priceZar: 150, stock: 2, trackStock: true, isActive: true, version: 0 };
    draft.variants.push(row);
    component.saveVariant(1, row);
    expect(row.id).toBe(12);
    component.saveVariant(1, row);
    expect(saved.calls.argsFor(1)[1].id).toBe(12);
  });

  it('takes the confirmed version for a saved single-product price row', () => {
    const single = { ...product(), variants: [{ ...product().variants[0], label: '', version: 4 }] };
    const variant = { ...single.variants[0], version: 3 };
    const { component } = open({ adminProducts: () => of([single]) as any, adminSaveProduct: () => of({}) as any,
      adminSaveVariant: () => of(undefined) as any });
    const draft = component.products()[0]; draft.multiple = false; draft.variants = [variant];
    component.save(draft);
    expect(component.products()[0].variants[0].version).toBe(4);
  });

  it('rebases a single-product row on the server stock and version after a conflict so a retry can succeed', () => {
    const server = { ...product(), variants: [{ ...product().variants[0], label: '', stock: 3, version: 7 }] };
    const { component } = open({ adminProducts: () => of([server]) as any, adminSaveProduct: () => of({}) as any,
      adminSaveVariant: () => throwError(() => ({ status: 409, error: { detail: 'raw' } })) as any });
    const draft = component.products()[0]; draft.multiple = false;
    draft.variants = [{ ...product().variants[0], label: '', priceZar: 99 }];
    component.save(draft);
    const row = component.products()[0].variants[0];
    expect(row.version).toBe(7);
    expect(row.stock).toBe(3);
    expect(row.priceZar).toBe(99);
    expect(component.products()[0].error).toBeTruthy();
  });

  it('rebases one variant on the server stock and version after a conflict, leaving siblings alone', () => {
    const server = { ...product(), variants: [{ ...product().variants[0], stock: 1, version: 9 }, product().variants[1]] };
    const { component } = open({ adminProducts: () => of([server]) as any,
      adminSaveVariant: () => throwError(() => ({ status: 409, error: { detail: 'raw' } })) as any });
    const draft = component.products()[0];
    draft.variants[0].priceZar = 130;
    draft.variants[1].priceZar = 135;
    component.saveVariant(1, draft.variants[0]);
    const [s, m] = component.products()[0].variants;
    expect(s.version).toBe(9);
    expect(s.stock).toBe(1);
    expect(s.priceZar).toBe(130);
    expect(s.error).toBeTruthy();
    expect(m.priceZar).toBe(135);
    expect(m.version).toBe(3);
  });

  it('assigns real IDs and confirmed versions to variants on a new product first save', () => {
    const server = { id: 3, name: 'New', description: '', imageFileName: null, imageUrl: null, sortOrder: 1, isActive: true,
      variants: [
        { id: 20, label: 'S', priceZar: 100, stock: 0, trackStock: true, isActive: true, version: 1 },
        { id: 21, label: 'M', priceZar: 120, stock: 6, trackStock: true, isActive: true, version: 1 },
      ] };
    const saveVariant = jasmine.createSpy('adminSaveVariant').and.returnValues(of({ id: 20 }), of({ id: 21 }));
    const { component } = open({ adminProducts: () => of([server]) as any, adminSaveProduct: () => of({ id: 3 }) as any, adminSaveVariant: saveVariant });
    component.products.set([]); component.add();
    const draft = component.products()[0]; draft.multiple = true;
    Object.assign(draft.variants[0], { label: 'S', priceZar: 100, stock: 5, trackStock: true });
    component.addVariant(draft);
    Object.assign(draft.variants[1], { label: 'M', priceZar: 120, stock: 6, trackStock: true });
    draft.variants[0].stock = null as any;
    component.save(draft);
    expect(saveVariant).toHaveBeenCalledTimes(2);
    expect(saveVariant.calls.argsFor(0)[1].stock).toBe(0);
    expect(component.products()[0].variants.map((v: any) => [v.id, v.version])).toEqual([[20, 1], [21, 1]]);
  });

  it('keeps the returned ID if refetch fails, so retry updates instead of creating a duplicate', () => {
    const products = jasmine.createSpy('adminProducts').and.returnValues(of([product()]), throwError(() => new Error('offline')), of([{ ...product(), variants: [...product().variants, { id: 12, label: 'L', priceZar: 150, stock: 2, trackStock: true, isActive: true, version: 1 }] }]));
    const saveVariant = jasmine.createSpy('adminSaveVariant').and.returnValues(of({ id: 12 }), of(undefined));
    const { component } = open({ adminProducts: products, adminSaveVariant: saveVariant });
    const row: any = { label: 'L', priceZar: 150, stock: 2, trackStock: true, isActive: true, version: 0 };
    component.products()[0].variants.push(row);
    component.saveVariant(1, row);
    expect(row.id).toBe(12);
    component.saveVariant(1, row);
    expect(saveVariant.calls.argsFor(1)[1].id).toBe(12);
  });

  it('keeps unsent new rows when a first-save batch partially fails', () => {
    const server = { id: 3, name: 'New', description: '', imageFileName: null, imageUrl: null, sortOrder: 1, isActive: true,
      variants: [{ id: 20, label: 'S', priceZar: 100, stock: 5, trackStock: true, isActive: true, version: 1 }] };
    const saveVariant = jasmine.createSpy('adminSaveVariant').and.returnValues(of({ id: 20 }), throwError(() => ({ error: { detail: 'failed' } })));
    const { component } = open({ adminProducts: () => of([server]) as any, adminSaveProduct: () => of({ id: 3 }) as any, adminSaveVariant: saveVariant });
    component.products.set([]); component.add();
    const draft = component.products()[0]; draft.multiple = true;
    Object.assign(draft.variants[0], { label: 'S', priceZar: 100, stock: 5 });
    component.addVariant(draft);
    Object.assign(draft.variants[1], { label: 'M', priceZar: 120, stock: 6 });
    component.save(draft);
    expect(component.products()[0].variants.map((v: any) => [v.label, v.id])).toEqual([['S', 20], ['M', undefined]]);
  });

  it('does not allow dropping a submitted draft variant while the first product save is pending', () => {
    const response = new Subject<any>();
    const { fixture, component } = open({ adminProducts: () => of([]) as any, adminSaveProduct: () => response as any });
    component.products.set([]); component.add();
    const draft = component.products()[0]; draft.multiple = true; draft.variants[0].label = 'S';
    component.save(draft);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('tbody tr .actions-cell button')).toBeNull();
    response.complete();
  });

  it('keeps newer input typed while a variant save is in flight and uses its confirmed version', () => {
    const response = new Subject<any>();
    const fresh = { ...product(), variants: [
      { id: 10, label: 'S', priceZar: 120, stock: 5, trackStock: true, isActive: true, version: 3 }, product().variants[1],
    ] };
    const { component } = open({ adminProducts: () => of([fresh]) as any, adminSaveVariant: () => response as any });
    const row = component.products()[0].variants[0];
    row.priceZar = 120;
    component.saveVariant(1, row);
    row.priceZar = 125;
    response.next(undefined); response.complete();
    expect(component.products()[0].variants[0].priceZar).toBe(125);
    expect(component.products()[0].variants[0].version).toBe(3);
    expect(component.products()[0].variants[1].version).toBe(3);
  });

  it('keeps the old version when newer stock input would otherwise skip a concurrent sale', () => {
    const response = new Subject<any>();
    const fresh = { ...product(), variants: [
      { id: 10, label: 'S', priceZar: 100, stock: 4, trackStock: true, isActive: true, version: 4 }, product().variants[1],
    ] };
    const { component } = open({ adminProducts: () => of([fresh]) as any, adminSaveVariant: () => response as any });
    const row = component.products()[0].variants[0];
    row.stock = 5;
    component.saveVariant(1, row);
    row.stock = 8;
    response.next(undefined); response.complete();
    expect(component.products()[0].variants[0].stock).toBe(8);
    expect(component.products()[0].variants[0].version).toBe(2);
  });

  it('preserves sibling drafts after a variant is deactivated', () => {
    const fresh = { ...product(), variants: [
      { id: 10, label: 'S', priceZar: 100, stock: 5, trackStock: true, isActive: false, version: 3 },
      { id: 11, label: 'M', priceZar: 120, stock: 6, trackStock: true, isActive: true, version: 3 },
    ] };
    spyOn(window, 'confirm').and.returnValue(true);
    const { component } = open({ adminProducts: () => of([fresh]) as any, adminDeleteVariant: () => of({ hardDeleted: false }) as any });
    component.products()[0].description = 'Unsent description';
    component.products()[0].variants[1].stock = 9;
    component.removeVariant(1, 10);
    expect(component.products()[0].description).toBe('Unsent description');
    expect(component.products()[0].variants.find((v: any) => v.id === 10).isActive).toBeFalse();
    expect(component.products()[0].variants.find((v: any) => v.id === 11).stock).toBe(9);
  });
});
