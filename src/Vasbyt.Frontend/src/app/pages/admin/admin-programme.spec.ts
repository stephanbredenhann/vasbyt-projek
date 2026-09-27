import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { ProgrammeDay } from '../../core/api.models';
import { AdminProgramme } from './admin-programme';

it('keeps distinct activity fields and validation after reordering and adding a row', async () => {
  const days: ProgrammeDay[] = [1, 2, 3].map(dayNumber => ({
    dayNumber, dateLocal: `2027-04-${28 + dayNumber}`, titleAf: 'Dag', titleEn: 'Day', noteAf: '', noteEn: '',
    entries: ['Opening', 'Start'].map(title => ({ timeLocal: '06:30:00', titleAf: title, titleEn: title, detailAf: title, detailEn: title })),
  }));
  const save = jasmine.createSpy('save').and.callFake((body: ProgrammeDay[]) => of(body));
  TestBed.configureTestingModule({ imports: [AdminProgramme], providers: [provideRouter([]),
    { provide: ApiService, useValue: { programme: () => of(days), adminSaveProgramme: save } }] });
  const fixture = TestBed.createComponent(AdminProgramme);
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const rows = () => root.querySelectorAll('.day-editor:first-of-type .activity');
  const second = rows()[1];
  (second.querySelector('button[aria-label="Skuif op"]') as HTMLButtonElement).click();
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  expect((rows()[0].querySelector('.field-row input') as HTMLInputElement).value).toBe('Start');
  expect((rows()[1].querySelector('.field-row input') as HTMLInputElement).value).toBe('Opening');
  const input = rows()[0].querySelector('.field-row input') as HTMLInputElement;
  input.value = 'Vroeë wegspring'; input.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  expect(save.calls.mostRecent().args[0][0].entries.map((e: { titleAf: string }) => e.titleAf)).toEqual(['Vroeë wegspring', 'Opening']);
  (root.querySelector('.day-editor button.btn:not(.remove):not([aria-label])') as HTMLButtonElement).click();
  fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
  expect((root.querySelector('.save-bar button') as HTMLButtonElement).disabled).toBeTrue();
});
