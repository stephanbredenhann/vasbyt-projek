import { Component, HostListener, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProgrammeDay, ProgrammeEntry } from '../../core/api.models';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../i18n/i18n.service';

@Component({
  selector: 'vb-admin-programme',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <h2>{{ i18n.t('programme.editTitle') }}</h2>
    <p class="lead">{{ i18n.t('programme.editIntro') }}</p>
    <p><a routerLink="/program" target="_blank">{{ i18n.t('programme.view') }}</a></p>
    @if (loadFailed()) {
      <p class="alert alert--error">{{ i18n.t('common.error') }}</p>
      <button class="btn btn--primary" type="button" (click)="load()">{{ i18n.t('programme.retry') }}</button>
    } @else if (!days().length) {
      <p class="muted">{{ i18n.t('common.loading') }}</p>
    } @else {
      <form #f="ngForm" (ngSubmit)="save(f)" (input)="changed()">
        @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
        @if (saved()) { <p class="alert alert--ok" role="status">{{ i18n.t('programme.saved') }}</p> }
        <fieldset [disabled]="busy()">
          @for (day of days(); track day.dayNumber) {
            <section class="card day-editor">
              <header><h3>{{ i18n.t('programme.day') }} {{ day.dayNumber }}</h3>
                <label class="field"><span>{{ i18n.t('programme.date') }}</span>
                  <input type="date" [name]="'date' + day.dayNumber" [(ngModel)]="day.dateLocal" required />
                </label>
              </header>
              <div class="field-row">
                <label class="field"><span>{{ i18n.t('programme.heading') }} ({{ i18n.t('programme.af') }})</span>
                  <input type="text" [name]="'titleAf' + day.dayNumber" [(ngModel)]="day.titleAf" required maxlength="160" />
                </label>
                <label class="field"><span>{{ i18n.t('programme.heading') }} ({{ i18n.t('programme.en') }})</span>
                  <input type="text" [name]="'titleEn' + day.dayNumber" [(ngModel)]="day.titleEn" required maxlength="160" />
                </label>
              </div>
              @for (entry of day.entries; track entry; let n = $index) {
                <div class="activity">
                  <div class="activity__tools">
                    <label class="field"><span>{{ i18n.t('programme.time') }}</span>
                      <input type="time" [name]="'time' + key(entry)" [(ngModel)]="entry.timeLocal" required />
                    </label>
                    <div class="controls">
                      <button type="button" class="btn btn--ghost" [disabled]="n === 0" (click)="move(day, n, -1)" [attr.aria-label]="i18n.t('programme.up')">↑</button>
                      <button type="button" class="btn btn--ghost" [disabled]="n === day.entries.length - 1" (click)="move(day, n, 1)" [attr.aria-label]="i18n.t('programme.down')">↓</button>
                      <button type="button" class="btn btn--ghost remove" [disabled]="day.entries.length === 1" (click)="remove(day, n)">{{ i18n.t('programme.remove') }}</button>
                    </div>
                  </div>
                  <div class="field-row">
                    <label class="field"><span>{{ i18n.t('programme.activity') }} ({{ i18n.t('programme.af') }})</span>
                      <input type="text" [name]="'entryAf' + key(entry)" [(ngModel)]="entry.titleAf" required maxlength="160" />
                    </label>
                    <label class="field"><span>{{ i18n.t('programme.activity') }} ({{ i18n.t('programme.en') }})</span>
                      <input type="text" [name]="'entryEn' + key(entry)" [(ngModel)]="entry.titleEn" required maxlength="160" />
                    </label>
                  </div>
                  <div class="field-row">
                    <label class="field"><span>{{ i18n.t('programme.detail') }} ({{ i18n.t('programme.af') }})</span>
                      <textarea rows="2" [name]="'detailAf' + key(entry)" [(ngModel)]="entry.detailAf" maxlength="1000"></textarea>
                    </label>
                    <label class="field"><span>{{ i18n.t('programme.detail') }} ({{ i18n.t('programme.en') }})</span>
                      <textarea rows="2" [name]="'detailEn' + key(entry)" [(ngModel)]="entry.detailEn" maxlength="1000"></textarea>
                    </label>
                  </div>
                </div>
              }
              <button type="button" class="btn btn--ghost" (click)="add(day)" [disabled]="day.entries.length >= 40">{{ i18n.t('programme.add') }}</button>
              <div class="field-row notes">
                <label class="field"><span>{{ i18n.t('programme.note') }} ({{ i18n.t('programme.af') }})</span>
                  <textarea rows="2" [name]="'noteAf' + day.dayNumber" [(ngModel)]="day.noteAf" maxlength="1000"></textarea>
                </label>
                <label class="field"><span>{{ i18n.t('programme.note') }} ({{ i18n.t('programme.en') }})</span>
                  <textarea rows="2" [name]="'noteEn' + day.dayNumber" [(ngModel)]="day.noteEn" maxlength="1000"></textarea>
                </label>
              </div>
            </section>
          }
        </fieldset>
        <div class="save-bar">
          <button type="submit" class="btn btn--primary btn--lg" [disabled]="busy() || f.invalid || !dirty()">{{ i18n.t(busy() ? 'entrant.saving' : 'programme.save') }}</button>
          @if (saved()) { <span role="status">{{ i18n.t('programme.saved') }}</span> }
          @if (error()) { <span class="field__error" role="alert">{{ error() }}</span> }
        </div>
      </form>
    }
  `,
  styles: `
    fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
    .day-editor { margin-bottom: var(--space-6); }
    header, .activity__tools { display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); flex-wrap: wrap; }
    header h3 { font-size: 1.75rem; }
    .activity { border-top: 1px solid var(--rule); padding-top: var(--space-6); margin-top: var(--space-4); }
    .controls { display: flex; gap: var(--space-2); flex-wrap: wrap; }
    .controls .btn { padding: .6rem 1rem; }
    .remove { color: var(--danger); }
    .notes { margin-top: var(--space-6); }
    .save-bar { position: sticky; bottom: 0; background: var(--paper); box-shadow: var(--shadow-2); padding: var(--space-4); display: flex; gap: var(--space-4); align-items: center; flex-wrap: wrap; border-radius: var(--r-md); }
  `,
})
export class AdminProgramme {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  protected readonly days = signal<ProgrammeDay[]>([]);
  protected readonly busy = signal(false);
  protected readonly dirty = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal('');
  protected readonly loadFailed = signal(false);

  private readonly entryKeys = new WeakMap<ProgrammeEntry, number>();
  private nextKey = 0;

  protected key(entry: ProgrammeEntry) {
    if (!this.entryKeys.has(entry)) this.entryKeys.set(entry, ++this.nextKey);
    return this.entryKeys.get(entry)!;
  }

  constructor() { this.load(); }

  @HostListener('window:beforeunload', ['$event'])
  protectUnsaved(event: BeforeUnloadEvent) {
    if (this.dirty()) { event.preventDefault(); event.returnValue = ''; }
  }

  protected load() {
    this.loadFailed.set(false);
    this.api.programme().subscribe({
      next: days => this.days.set(days), error: () => this.loadFailed.set(true),
    });
  }

  protected changed() { this.dirty.set(true); this.saved.set(false); this.error.set(''); }

  protected add(day: ProgrammeDay) {
    day.entries.push({ timeLocal: '06:30', titleAf: '', titleEn: '', detailAf: '', detailEn: '' });
    this.changed();
  }

  protected remove(day: ProgrammeDay, index: number) { day.entries.splice(index, 1); this.changed(); }

  protected move(day: ProgrammeDay, index: number, direction: number) {
    const next = index + direction;
    if (next < 0 || next >= day.entries.length) return;
    [day.entries[index], day.entries[next]] = [day.entries[next], day.entries[index]];
    this.changed();
  }

  protected save(form: NgForm) {
    if (form.invalid || this.busy()) return;
    this.busy.set(true); this.error.set(''); this.saved.set(false);
    const body = this.days().map(d => ({ ...d, entries: d.entries.map(e => ({ ...e, timeLocal: e.timeLocal.length === 5 ? e.timeLocal + ':00' : e.timeLocal })) }));
    this.api.adminSaveProgramme(body).subscribe({
      next: days => { this.days.set(days); this.busy.set(false); this.dirty.set(false); this.saved.set(true); },
      error: e => { this.busy.set(false); this.error.set(e.error?.detail ?? this.i18n.t('common.error')); },
    });
  }
}
