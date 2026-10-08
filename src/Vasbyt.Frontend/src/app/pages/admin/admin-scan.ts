import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { OrderStatus, ScanLine, ScanResult } from '../../core/api.models';
import { ApiService } from '../../core/api.service';
import { TranslationKey } from '../../i18n/af';
import { I18nService } from '../../i18n/i18n.service';

type Detector = { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type DetectorCtor = (new (o: { formats: string[] }) => Detector) & { getSupportedFormats?(): Promise<string[]> };
// Native QR detection where the browser has it, jsqr otherwise.
const BarcodeDetectorCtor = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
const STATUS: Record<OrderStatus, TranslationKey> = {
  Pending: 'account.statusPending',
  Paid: 'account.statusPaid',
  Cancelled: 'account.statusCancelled',
};

@Component({
  selector: 'vb-admin-scan',
  standalone: true,
  imports: [FormsModule, DatePipe, CurrencyPipe],
  template: `
    <h2>{{ i18n.t('scan.title') }}</h2>
    <p class="lead">{{ i18n.t('scan.intro') }}</p>
    <p class="sr-only" role="status">{{ announcement() }}</p>
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
        <form (ngSubmit)="find()" [class.form--hidden]="result()">
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
        <article #card class="card card--event participant" [attr.data-event]="e.routeCode">
          <p class="entry-number">{{ e.entryNumber }}</p>
          <h2>{{ e.firstName }} {{ e.lastName }}</h2>
          <p class="route">{{ e.route }} <span class="muted">/ {{ i18n.t(e.tariff === 'Student' ? 'reg.student' : 'reg.normal') }}</span></p>
          @if (e.isComplete && e.medicalConditions) {
            <p class="medical"><strong>{{ i18n.t('scan.medicalAlert') }}:</strong> {{ e.medicalConditions }}</p>
          }
          <div class="arrival" [class.arrival--done]="e.checkedInUtc">
            @if (e.checkedInUtc) {
              <strong>✓ {{ i18n.t('scan.checkedIn') }} {{ e.checkedInUtc | date: 'HH:mm' : '+0200' }}
                @if (e.checkedInBy) { {{ i18n.t('scan.checkedInBy') }} {{ e.checkedInBy }} }</strong>
              <button type="button" class="btn btn--ghost" (click)="undoCheckIn(e)" [disabled]="busy()">{{ i18n.t('scan.undo') }}</button>
              <button type="button" class="btn btn--primary" (click)="next()" [disabled]="busy()">{{ i18n.t('scan.next') }}</button>
            } @else if (!e.isComplete) {
              <span>{{ i18n.t('scan.needsForm') }}</span>
            } @else {
              <span>{{ i18n.t('scan.notCheckedIn') }}</span>
              <button type="button" class="btn btn--primary btn--block big" (click)="checkIn(e)" [disabled]="busy()">{{ i18n.t('scan.checkIn') }}</button>
            }
          </div>
          @if (e.siblings.length) {
            <label class="field others">
              <span>{{ i18n.t('scan.others') }} ({{ e.siblings.length }})</span>
              <select [disabled]="busy()" [value]="siblingId()" (change)="siblingId.set($any($event.target).value)">
                <option value="">{{ i18n.t('scan.pickOther') }}</option>
                @for (s of e.siblings; track s.id) {
                  <option [value]="s.id">{{ s.checkedIn ? '✓ ' : '' }}{{ s.fullName }} / {{ s.route }}{{ s.isComplete ? '' : ' (' + i18n.t('scan.incomplete') + ')' }}</option>
                }
              </select>
              <button type="button" class="btn btn--accent" (click)="openSibling()" [disabled]="busy() || !siblingId()">{{ i18n.t('scan.show') }}</button>
            </label>
          }
          @if (e.isComplete) {
            <h3>{{ i18n.t('scan.person') }}</h3>
            <dl>
              <dt>{{ i18n.t('entrant.email') }}</dt><dd><a [href]="'mailto:' + e.email">{{ e.email }}</a></dd>
              <dt>{{ i18n.t('entrant.phone') }}</dt><dd><a [href]="'tel:' + e.phone">{{ e.phone }}</a></dd>
              <dt>{{ i18n.t('entrant.dob') }}</dt><dd>{{ e.dateOfBirth | date: 'yyyy-MM-dd' }} ({{ age(e.dateOfBirth) }} {{ i18n.t('scan.age') }})</dd>
              <dt>{{ i18n.t('entrant.gender') }}</dt><dd>{{ e.gender === 'M' ? i18n.t('entrant.male') : e.gender === 'V' ? i18n.t('entrant.female') : e.gender }}</dd>
              <dt>{{ i18n.t('entrant.idNumber') }}</dt><dd>{{ e.idNumber }}</dd>
              <dt>{{ i18n.t('entrant.shirt') }}</dt><dd>{{ e.shirtSize || i18n.t('scan.optional') }}</dd>
              <dt>{{ i18n.t('entrant.club') }}</dt><dd>{{ e.clubName || i18n.t('scan.optional') }}</dd>
              <dt>{{ i18n.t('entrant.address') }}</dt><dd>{{ e.streetAddress }}, {{ e.town }}, {{ e.province }} {{ e.postalCode }}</dd>
            </dl>
            <section class="emergency">
              <h3>{{ i18n.t('entrant.emergency') }}</h3>
              <p><strong>{{ e.emergencyName }}</strong> ({{ e.emergencyRelationship }})<br />
                <a [href]="'tel:' + e.emergencyPhone">{{ e.emergencyPhone }}</a>
              </p>
              <dl>
                <dt>{{ i18n.t('entrant.medication') }}</dt><dd>{{ e.medication || i18n.t('scan.optional') }}</dd>
                <dt>{{ i18n.t('entrant.medicalScheme') }}</dt><dd>{{ e.medicalFund || i18n.t('scan.optional') }}</dd>
                <dt>{{ i18n.t('entrant.medicalSchemeNumber') }}</dt><dd>{{ e.medicalFundNumber || i18n.t('scan.optional') }}</dd>
              </dl>
            </section>
          }
          <h3>{{ i18n.t('scan.order') }}</h3>
          <dl>
            <dt>{{ i18n.t('scan.reference') }}</dt><dd><strong>{{ e.orderReference }}</strong> / {{ i18n.t(statusKey(e.orderStatus)) }}</dd>
            <dt>{{ i18n.t('scan.paidOn') }}</dt><dd>{{ e.orderPaidUtc | date: 'yyyy-MM-dd HH:mm' : '+0200' }}</dd>
            <dt>{{ i18n.t('scan.buyer') }}</dt><dd>{{ e.buyerName }}<br /><a [href]="'mailto:' + e.buyerEmail">{{ e.buyerEmail }}</a><br /><a [href]="'tel:' + e.buyerPhone">{{ e.buyerPhone }}</a></dd>
            @if (e.accountEmail) { <dt>{{ i18n.t('scan.account') }}</dt><dd>{{ e.accountEmail }}</dd> }
          </dl>
          <ul class="purchases">
            @for (line of e.orderLines; track line.id) {
              <li>
                <span>{{ line.quantity }} × {{ line.description }}
                  @if (line.kind === 'Product') {
                    <br /><span class="muted">{{ line.collectedQuantity }}/{{ line.quantity }} {{ i18n.t('scan.collected') }}</span>
                  }
                </span>
                <span class="line-end">
                  <strong>{{ line.lineTotalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</strong>
                  @if (line.kind === 'Product' && line.collectedQuantity < line.quantity) {
                    <span class="steps">
                      @if (line.quantity > 1) {
                        <button type="button" class="btn btn--ghost" (click)="collect(e, line, line.collectedQuantity + 1)" [disabled]="busy()">+1</button>
                      }
                      <button type="button" class="btn btn--ghost" (click)="collect(e, line, line.quantity)" [disabled]="busy()">{{ i18n.t('admin.markCollected') }}</button>
                    </span>
                  }
                </span>
              </li>
            }
            <li><strong>{{ i18n.t('scan.total') }}</strong><strong>{{ e.orderTotalZar | currency: 'ZAR' : 'symbol-narrow' : '1.2-2' }}</strong></li>
          </ul>
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
    .camera__hint { font-size: 1rem; padding: var(--space-3); margin: 0; }
    .scanner__actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-bottom: var(--space-6); }
    .upload { position: relative; overflow: hidden; }
    .upload input { position: absolute; inset: 0; opacity: 0; width: 100%; cursor: pointer; }
    .upload:focus-within { outline: 3px solid var(--indigo); outline-offset: 3px; }
    .is-disabled { opacity: .45; }
    .entry-number { font-family: var(--font-display); color: var(--indigo); font-size: 1.375rem; margin: 0; }
    .participant h2 { margin: var(--space-2) 0 var(--space-2); font-size: 1.75rem; overflow-wrap: anywhere; }
    .big { min-height: 56px; font-size: 1.125rem; }
    .others select { min-height: 48px; width: 100%; }
    .line-end { display: flex; flex-direction: column; align-items: flex-end; gap: var(--space-2); }
    .line-end .btn { min-height: 44px; }
    .medical { background: #fff1e8; padding: var(--space-4); border-radius: var(--r-sm); margin: var(--space-4) 0 0; font-size: 1.0625rem; overflow-wrap: anywhere; }
    .steps { display: flex; gap: var(--space-2); }
    .others .btn { margin-top: var(--space-2); min-height: 48px; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    h3 { margin: var(--space-6) 0 var(--space-3); font-size: 1.125rem; }
    .route { margin: 0; font-weight: 600; color: var(--ev); }
    .arrival { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); background: var(--karoo-sand-light); padding: var(--space-4); border-radius: var(--r-sm); margin-top: var(--space-6); font-size: 1rem; }
    .arrival strong { overflow-wrap: anywhere; }
    .arrival .btn { min-height: 44px; }
    .arrival--done { color: var(--ok); background: #edf5ed; }
    dl { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: var(--space-2) var(--space-4); font-size: 1rem; }
    dt { color: var(--ink-muted); overflow-wrap: anywhere; } dd { margin: 0; overflow-wrap: anywhere; }
    .emergency { background: #fff1e8; padding: var(--space-4); border-radius: var(--r-sm); margin-block: var(--space-6); }
    .emergency h3 { margin-top: 0; } .emergency p { margin-bottom: 0; }
    summary { cursor: pointer; font-weight: 600; }
    .purchases { list-style: none; padding: 0; font-size: 1rem; }
    .purchases li { display: flex; justify-content: space-between; gap: var(--space-3); padding-block: var(--space-3); align-items: center; border-top: 1px solid var(--rule); }
    .purchases strong { white-space: nowrap; }

    @media(max-width: 800px) { .form--hidden { display: none; } .reception { grid-template-columns: 1fr; } .scanner { position: static; } }
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
  protected readonly siblingId = signal('');
  private readonly card = viewChild<ElementRef<HTMLElement>>('card');
  protected readonly announcement = computed(() => {
    const e = this.result();
    if (!e) return '';
    return `${e.firstName} ${e.lastName}, ${e.route}, ${this.i18n.t(e.checkedInUtc ? 'scan.checkedIn' : 'scan.notCheckedIn')}`;
  });
  private retryTimer?: ReturnType<typeof setTimeout>;
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
      let detector: Detector | null = null;
      try {
        const formats = await BarcodeDetectorCtor?.getSupportedFormats?.().catch(() => [] as string[]);
        if (formats?.includes('qr_code')) detector = new BarcodeDetectorCtor!({ formats: ['qr_code'] });
      } catch { detector = null; }
      let readQr = detector ? null : (await import('jsqr')).default;
      let failures = 0;
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
      const tick = async () => {
        if (this.destroyed || request !== this.cameraRequest) return;
        if (video.readyState >= 2 && video.videoWidth) {
          let text: string | undefined;
          try {
            if (detector) { text = (await detector.detect(video))[0]?.rawValue; failures = 0; }
            else {
              const pixels = this.pixels(video, video.videoWidth, video.videoHeight, canvas);
              text = readQr!(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' })?.data;
            }
          } catch {
            // Ten failed detect() calls in a row means the native path is broken, so switch to jsqr.
            if (detector && ++failures >= 10) { detector = null; readQr = (await import('jsqr')).default; }
          }
          if (this.destroyed || request !== this.cameraRequest) return;
          if (text) { this.stopCamera(); this.lookup(text, true); return; }
        }
        this.cameraTimer = setTimeout(tick, detector ? 120 : 180);
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
    clearTimeout(this.retryTimer); this.retryTimer = undefined;
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
      next: result => { this.show(result); this.busy.set(false); this.code.set(''); navigator.vibrate?.(60); },
      error: e => {
        this.busy.set(false);
        this.error.set(e.error?.detail ?? this.i18n.t('common.error'));
        if (fromCamera && !this.destroyed) this.retryTimer = setTimeout(() => this.startCamera(true), 1200);
      },
    });
  }

  protected checkIn(entrant: ScanResult) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.api.adminCheckIn(entrant.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.show(result); this.busy.set(false); },
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

  private show(result: ScanResult) {
    this.result.set(result); this.siblingId.set('');
    setTimeout(() => this.card()?.nativeElement.scrollIntoView({ block: 'start' }));
  }

  protected openSibling() {
    const id = Number(this.siblingId());
    if (!id || this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.api.adminEntrant(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.show(result); this.busy.set(false); },
      error: e => { this.busy.set(false); this.error.set(e.error?.detail ?? this.i18n.t('common.error')); },
    });
  }

  protected collect(entrant: ScanResult, line: ScanLine, quantity: number) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    this.api.adminCollect(entrant.orderId, [{ orderLineId: line.id, collectedQuantity: quantity }])
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: res => {
          this.result.update(r => r && { ...r, orderLines: r.orderLines.map(l => res.lines.find(x => x.orderLineId === l.id)
            ? { ...l, collectedQuantity: res.lines.find(x => x.orderLineId === l.id)!.collectedQuantity } : l) });
          this.busy.set(false);
        },
        error: e => { this.busy.set(false); this.error.set(e.error?.detail ?? this.i18n.t('common.error')); },
      });
  }

  protected statusKey(status: OrderStatus) { return STATUS[status]; }

  protected age(dob: string) {
    const [y, m, d] = dob.slice(0, 10).split('-').map(Number), now = new Date();
    return now.getFullYear() - y - (now < new Date(now.getFullYear(), m - 1, d) ? 1 : 0);
  }

  protected next() { this.reset(); this.startCamera(); }

  protected reset() { this.stopCamera(); this.result.set(null); this.error.set(''); this.code.set(''); }

  ngOnDestroy() { this.destroyed = true; this.stopCamera(); }
}
