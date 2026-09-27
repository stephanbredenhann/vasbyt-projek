import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ScanResult } from '../../core/api.models';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../i18n/i18n.service';

@Component({
  selector: 'vb-admin-scan',
  standalone: true,
  imports: [FormsModule, DatePipe, CurrencyPipe],
  template: `
    <h2>{{ i18n.t('scan.title') }}</h2>
    <p class="lead">{{ i18n.t('scan.intro') }}</p>
    <div class="reception">
      <section class="card scanner">
        <div class="camera" [class.camera--active]="scanning() || starting()">
          <video #preview autoplay muted playsinline [hidden]="!scanning() && !starting()" [attr.aria-label]="i18n.t('scan.ready')"></video>
          @if (!scanning() && !starting()) {
            <svg class="qr-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" aria-hidden="true">
              <path d="M4 22V4h18M42 4h18v18M60 42v18H42M22 60H4V42" />
              <path d="M15 15h12v12H15zM37 15h12v12H37zM15 37h12v12H15zM37 37h5v5h7v7H37z" />
            </svg>
          }
          <p class="camera__hint">{{ i18n.t(scanning() ? 'scan.ready' : 'scan.privacy') }}</p>
        </div>
        <div class="scanner__actions">
          @if (scanning() || starting()) {
            <button type="button" class="btn btn--ghost" (click)="stopCamera()">{{ i18n.t('scan.stop') }}</button>
          } @else {
            <button type="button" class="btn btn--primary" (click)="startCamera(false)" [disabled]="busy()">{{ i18n.t('scan.camera') }}</button>
          }
          <label class="btn btn--ghost upload" [class.is-disabled]="busy()">
            {{ i18n.t('scan.upload') }}
            <input type="file" accept="image/jpeg,image/png,image/webp" (change)="upload($event)" [disabled]="busy()" />
          </label>
        </div>
        <form (ngSubmit)="find()">
          <label class="field">
            <span>{{ i18n.t('scan.manual') }}</span>
            <input type="text" name="code" [(ngModel)]="code" [placeholder]="i18n.t('scan.placeholder')" autocomplete="off" maxlength="160" [disabled]="busy()" />
          </label>
          <button type="submit" class="btn btn--accent btn--block" [disabled]="busy() || !code().trim()">{{ i18n.t(busy() ? 'scan.scanning' : 'scan.find') }}</button>
        </form>
        @if (error()) { <p class="alert alert--error" role="alert">{{ error() }}</p> }
        @if (busy()) { <p role="status" class="muted">{{ i18n.t('scan.scanning') }}</p> }
      </section>

      @if (result(); as e) {
        <article class="card card--event participant" aria-live="polite" [attr.data-event]="e.routeCode">
          <header>
            <p class="entry-number">{{ e.entryNumber }}</p>
            <span class="paid">✓ {{ i18n.t('account.statusPaid') }}</span>
          </header>
          <h2>{{ e.firstName }} {{ e.lastName }}</h2>
          <p class="route">{{ e.route }} <span class="muted">/ {{ i18n.t(e.tariff === 'Student' ? 'reg.student' : 'reg.normal') }}</span></p>
          <div class="arrival" [class.arrival--done]="e.checkedInUtc">
            @if (e.checkedInUtc) {
              <strong>✓ {{ i18n.t('scan.checkedIn') }}</strong>
              <span>{{ e.checkedInUtc | date: 'yyyy-MM-dd HH:mm' : '+0200' }}
                @if (e.checkedInBy) { {{ i18n.t('scan.checkedInBy') }} {{ e.checkedInBy }} }</span>
              <button type="button" class="btn btn--ghost" (click)="undoCheckIn(e)" [disabled]="busy()">{{ i18n.t('scan.undo') }}</button>
            } @else {
              <span>{{ i18n.t('scan.notCheckedIn') }}</span>
              <button type="button" class="btn btn--primary" (click)="checkIn(e)" [disabled]="busy()">{{ i18n.t('scan.checkIn') }}</button>
            }
          </div>
          <h3>{{ i18n.t('scan.contact') }}</h3>
          <dl>
            <dt>{{ i18n.t('entrant.email') }}</dt><dd><a [href]="'mailto:' + e.email">{{ e.email }}</a></dd>
            <dt>{{ i18n.t('entrant.phone') }}</dt><dd><a [href]="'tel:' + e.phone">{{ e.phone }}</a></dd>
            <dt>{{ i18n.t('entrant.dob') }}</dt><dd>{{ e.dateOfBirth | date: 'yyyy-MM-dd' }}</dd>
            <dt>{{ i18n.t('entrant.idNumber') }}</dt><dd>{{ e.idNumber }}</dd>
            <dt>{{ i18n.t('entrant.shirt') }}</dt><dd>{{ e.shirtSize || i18n.t('scan.optional') }}</dd>
            <dt>{{ i18n.t('entrant.address') }}</dt><dd>{{ e.streetAddress }}, {{ e.town }}, {{ e.province }} {{ e.postalCode }}</dd>
            <dt>{{ i18n.t('entrant.club') }}</dt><dd>{{ e.clubName || i18n.t('scan.optional') }}</dd>
          </dl>
          <section class="emergency">
            <h3>{{ i18n.t('entrant.emergency') }}</h3>
            <p><strong>{{ e.emergencyName }}</strong> ({{ e.emergencyRelationship }})<br />
              <a [href]="'tel:' + e.emergencyPhone">{{ e.emergencyPhone }}</a>
            </p>
          </section>
          <details>
            <summary>{{ i18n.t('entrant.medicalTitle') }}</summary>
            <dl>
              <dt>{{ i18n.t('entrant.medical') }}</dt><dd>{{ e.medicalConditions || i18n.t('scan.optional') }}</dd>
              <dt>{{ i18n.t('entrant.medication') }}</dt><dd>{{ e.medication || i18n.t('scan.optional') }}</dd>
              <dt>{{ i18n.t('entrant.medicalScheme') }}</dt><dd>{{ e.medicalFund || i18n.t('scan.optional') }}</dd>
              <dt>{{ i18n.t('entrant.medicalSchemeNumber') }}</dt><dd>{{ e.medicalFundNumber || i18n.t('scan.optional') }}</dd>
            </dl>
          </details>
          <h3>{{ i18n.t('scan.purchases') }}</h3>
          <p class="muted">{{ e.orderReference }}</p>
          <ul class="purchases">
            @for (line of e.orderLines; track line.id) {
              <li><span>{{ line.quantity }} × {{ line.description }}</span><strong>{{ line.lineTotalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</strong></li>
            }
          </ul>
          <button type="button" class="btn btn--ghost next" (click)="reset()" [disabled]="busy()">{{ i18n.t('scan.next') }}</button>
        </article>
      }
    </div>
  `,
  styles: `
    .reception { display: grid; grid-template-columns: minmax(0,.85fr) minmax(0,1.2fr); gap: var(--space-6); align-items: start; }
    .scanner { position: sticky; top: 96px; }
    .camera { background: var(--karoo-sand-light); padding: var(--space-8); border-radius: var(--r-md); text-align: center; margin-bottom: var(--space-6); overflow: hidden; }
    .camera--active { padding: 0; background: var(--indigo-deep); color: white; }
    video { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
    video[hidden] { display: none; }
    .qr-icon { width: 80px; height: 80px; color: var(--indigo); margin: var(--space-4) auto; }
    .camera__hint { font-size: .8125rem; padding: var(--space-3); margin: 0; }
    .scanner__actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-6); }
    .upload { position: relative; overflow: hidden; }
    .upload input { position: absolute; inset: 0; opacity: 0; width: 100%; cursor: pointer; }
    .upload:focus-within { outline: 3px solid var(--indigo); outline-offset: 3px; }
    .is-disabled { opacity: .45; }
    header { display: flex; justify-content: space-between; gap: var(--space-4); align-items: center; flex-wrap: wrap; }
    .entry-number { font-family: var(--font-display); color: var(--indigo); font-size: 1.375rem; margin: 0; }
    .paid { color: var(--ok); font-weight: 600; font-size: .875rem; }
    .participant h2 { margin: var(--space-4) 0 var(--space-2); }
    h3 { margin: var(--space-6) 0 var(--space-3); font-size: 1.125rem; }
    .route { margin: 0; font-weight: 600; color: var(--ev); }
    .arrival { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); background: var(--karoo-sand-light); padding: var(--space-4); border-radius: var(--r-sm); margin-top: var(--space-6); font-size: .875rem; }
    .arrival--done { color: var(--ok); background: #edf5ed; }
    dl { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: var(--space-2) var(--space-4); font-size: .875rem; }
    dt { color: var(--ink-muted); overflow-wrap: anywhere; } dd { margin: 0; overflow-wrap: anywhere; }
    .emergency { background: #fff1e8; padding: var(--space-4); border-radius: var(--r-sm); margin-block: var(--space-6); }
    .emergency h3 { margin-top: 0; } .emergency p { margin-bottom: 0; }
    summary { cursor: pointer; font-weight: 600; }
    .purchases { list-style: none; padding: 0; font-size: .875rem; }
    .purchases li { display: flex; justify-content: space-between; gap: var(--space-3); padding-block: var(--space-3); border-top: 1px solid var(--rule); }
    .purchases strong { white-space: nowrap; } .next { margin-top: var(--space-4); }
    @media(max-width: 800px) { .reception { grid-template-columns: 1fr; } .scanner { position: static; } }
    @media(max-width: 480px) { dl { grid-template-columns: 1fr; gap: .25rem; } dd { margin-bottom: .75rem; } }
  `,
})
export class AdminScan implements OnDestroy {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly preview = viewChild<ElementRef<HTMLVideoElement>>('preview');
  protected readonly code = signal('');
  protected readonly result = signal<ScanResult | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly scanning = signal(false);
  protected readonly starting = signal(false);
  private cameraTimer?: ReturnType<typeof setTimeout>;
  private stream?: MediaStream;
  private cameraRequest = 0;
  private destroyed = false;

  async startCamera(keepError = false) {
    if (this.busy() || this.starting() || this.scanning()) return;
    const request = ++this.cameraRequest;
    this.starting.set(true); this.result.set(null);
    if (!keepError) this.error.set('');
    try {
      const { default: readQr } = await import('jsqr');
      if (this.destroyed || request !== this.cameraRequest) return;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (this.destroyed || request !== this.cameraRequest) { stream.getTracks().forEach(track => track.stop()); return; }
      this.stream = stream;
      const video = this.preview()!.nativeElement;
      video.srcObject = stream;
      await video.play();
      if (this.destroyed || request !== this.cameraRequest) return;
      this.scanning.set(true);
      const canvas = document.createElement('canvas');
      const tick = () => {
        if (this.destroyed || request !== this.cameraRequest) return;
        if (video.readyState >= 2 && video.videoWidth) {
          const pixels = this.pixels(video, video.videoWidth, video.videoHeight, canvas);
          const result = readQr(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' });
          if (result) { this.stopCamera(); this.lookup(result.data, true); return; }
        }
        this.cameraTimer = setTimeout(tick, 180);
      };
      tick();
    } catch {
      if (!this.destroyed && request === this.cameraRequest) { this.stopCamera(); this.error.set(this.i18n.t('scan.cameraError')); }
    } finally {
      if (!this.destroyed && request === this.cameraRequest) this.starting.set(false);
    }
  }

  stopCamera() {
    this.cameraRequest++;
    clearTimeout(this.cameraTimer); this.cameraTimer = undefined;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined;
    const video = this.preview()?.nativeElement;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(track => track.stop());
    if (video) video.srcObject = null;
    this.scanning.set(false); this.starting.set(false);
  }

  protected async upload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0]; input.value = '';
    if (!file || this.busy()) return;
    this.stopCamera(); this.error.set(''); this.result.set(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      this.error.set(this.i18n.t('scan.fileError')); return;
    }
    this.busy.set(true);
    const url = URL.createObjectURL(file);
    try {
      const { default: readQr } = await import('jsqr');
      const image = new Image(); image.src = url;
      await image.decode();
      const pixels = this.pixels(image, image.naturalWidth, image.naturalHeight);
      const decoded = readQr(pixels.data, pixels.width, pixels.height);
      if (!decoded) throw new Error('No QR code');
      if (!this.destroyed) this.lookup(decoded.data);
    } catch {
      if (!this.destroyed) { this.busy.set(false); this.error.set(this.i18n.t('scan.noQr')); }
    } finally { URL.revokeObjectURL(url); }
  }

  private pixels(source: CanvasImageSource, width: number, height: number, canvas = document.createElement('canvas')) {
    const scale = Math.min(1, 1600 / Math.max(width, height));
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }

  protected find() {
    if (this.busy() || !this.code().trim()) return;
    this.stopCamera(); this.lookup(this.code());
  }

  /** A camera miss (unknown, unpaid) goes straight back to scanning so the queue keeps moving. */
  private lookup(code: string, fromCamera = false) {
    this.result.set(null); this.error.set(''); this.busy.set(true);
    this.api.adminScan(code).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.result.set(result); this.busy.set(false); this.code.set(''); navigator.vibrate?.(60); },
      error: e => {
        this.busy.set(false);
        this.error.set(e.error?.detail ?? this.i18n.t('common.error'));
        if (fromCamera && !this.destroyed) setTimeout(() => this.startCamera(true), 1200);
      },
    });
  }

  protected checkIn(entrant: ScanResult) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.api.adminCheckIn(entrant.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.result.set(result); this.busy.set(false); },
      error: e => { this.busy.set(false); this.error.set(e.error?.detail ?? this.i18n.t('common.error')); },
    });
  }

  protected undoCheckIn(entrant: ScanResult) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.api.adminUndoCheckIn(entrant.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.result.set(result); this.busy.set(false); },
      error: e => { this.busy.set(false); this.error.set(e.error?.detail ?? this.i18n.t('common.error')); },
    });
  }

  protected reset() { this.stopCamera(); this.result.set(null); this.error.set(''); this.code.set(''); }

  ngOnDestroy() { this.destroyed = true; this.stopCamera(); }
}
