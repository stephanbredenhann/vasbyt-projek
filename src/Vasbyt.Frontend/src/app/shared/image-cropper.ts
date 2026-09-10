import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { I18nService } from '../i18n/i18n.service';

/** The slot ratios are fixed, so a crop never needs to be wider than the widest slot on the site. */
const MAX_WIDTH = 1600;

export interface Offset {
  x: number;
  y: number;
}

/**
 * Displayed size of the image inside the frame: at zoom 1 it covers the frame exactly, so no crop
 * can ever include empty space.
 */
export function coverSize(nw: number, nh: number, frameW: number, ratio: number, zoom: number) {
  const cover = Math.max(frameW / nw, frameW / ratio / nh) * zoom;
  return { w: nw * cover, h: nh * cover };
}

/** Keep the frame inside the image: an offset can never expose an edge. */
export function clampOffset(nw: number, nh: number, frameW: number, ratio: number, zoom: number, off: Offset): Offset {
  const size = coverSize(nw, nh, frameW, ratio, zoom);
  return {
    x: Math.min(0, Math.max(frameW - size.w, off.x)),
    y: Math.min(0, Math.max(frameW / ratio - size.h, off.y)),
  };
}

/** The frame mapped back onto the source image's own pixels, which is what drawImage crops. */
export function sourceRect(nw: number, nh: number, frameW: number, ratio: number, zoom: number, off: Offset) {
  const scale = coverSize(nw, nh, frameW, ratio, zoom).w / nw;
  return {
    sx: -off.x / scale,
    sy: -off.y / scale,
    sw: frameW / scale,
    sh: frameW / ratio / scale,
  };
}

/**
 * Aspect-locked crop before upload: drag to pan, the slider zooms, and what fills the frame is
 * exactly what gets uploaded. Pointer events and a canvas do the whole job, so no crop dependency.
 */
@Component({
  selector: 'vb-image-cropper',
  standalone: true,
  template: `
    <div
      class="stage"
      #stage
      [style.aspect-ratio]="ratio()"
      (pointerdown)="grab($event)"
      (pointermove)="pan($event)"
      (pointerup)="release()"
      (pointercancel)="release()"
    >
      @if (src(); as s) {
        <img
          [src]="s"
          [style.width.px]="size().w"
          [style.height.px]="size().h"
          [style.transform]="'translate(' + off().x + 'px,' + off().y + 'px)'"
          draggable="false"
          alt=""
        />
      }
    </div>

    <label class="field">
      <span>{{ i18n.t('admin.cropZoom') }}</span>
      <input type="range" min="1" max="4" step="0.01" [value]="zoom()" (input)="setZoom($event)" />
      <span class="field__hint">{{ i18n.t('admin.cropHint') }}</span>
    </label>

    <div class="actions">
      <button class="btn btn--primary" type="button" [disabled]="!size().w" (click)="apply()">
        {{ i18n.t('admin.cropApply') }}
      </button>
      <button class="btn btn--ghost" type="button" (click)="cancelled.emit()">
        {{ i18n.t('admin.cropCancel') }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .stage {
      position: relative;
      width: 100%;
      overflow: hidden;
      border-radius: var(--r-lg);
      background: var(--karoo-sand);
      cursor: grab;
      /* Without this a touch drag scrolls the admin page instead of moving the crop. */
      touch-action: none;
    }

    .stage img {
      display: block;
      max-width: none;
      user-select: none;
    }

    .actions {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
      margin-top: var(--space-3);
    }
  `,
  host: { '(window:resize)': 'measure()' },
})
export class ImageCropper {
  readonly file = input.required<File>();
  /** A number, not a CSS string: the crop maths needs it and CSS accepts it either way. */
  readonly ratio = input(4 / 3);
  readonly cropped = output<File>();
  readonly cancelled = output<void>();

  protected readonly i18n = inject(I18nService);
  protected readonly src = signal<string | null>(null);
  protected readonly zoom = signal(1);
  protected readonly off = signal<Offset>({ x: 0, y: 0 });

  protected readonly size = computed(() => {
    const { w: nw, h: nh } = this.natural();
    const frame = this.frameWidth();
    if (!frame || !nw) return { w: 0, h: 0 };
    return coverSize(nw, nh, frame, this.ratio(), this.zoom());
  });

  private readonly stage = viewChild.required<ElementRef<HTMLDivElement>>('stage');
  private readonly frameWidth = signal(0);
  private readonly natural = signal({ w: 0, h: 0 });
  private from: Offset | null = null;

  constructor() {
    effect((onCleanup) => {
      const url = URL.createObjectURL(this.file());
      this.src.set(url);

      const probe = new Image();
      probe.onload = () => {
        this.natural.set({ w: probe.naturalWidth, h: probe.naturalHeight });
        this.measure();
        this.centre();
      };
      probe.src = url;

      onCleanup(() => URL.revokeObjectURL(url));
    });
  }

  protected measure() {
    this.frameWidth.set(this.stage().nativeElement.clientWidth);
    this.clamp();
  }

  /** Zoom around the middle of the frame, so the subject does not slide out from under the slider. */
  protected setZoom(event: Event) {
    const next = +(event.target as HTMLInputElement).value;
    const factor = next / this.zoom();
    const w = this.frameWidth();
    const h = w / this.ratio();
    this.off.update((o) => ({
      x: (o.x - w / 2) * factor + w / 2,
      y: (o.y - h / 2) * factor + h / 2,
    }));
    this.zoom.set(next);
    this.clamp();
  }

  protected grab(event: PointerEvent) {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.from = { x: event.clientX - this.off().x, y: event.clientY - this.off().y };
  }

  protected pan(event: PointerEvent) {
    if (!this.from) return;
    event.preventDefault();
    this.off.set({ x: event.clientX - this.from.x, y: event.clientY - this.from.y });
    this.clamp();
  }

  protected release() {
    this.from = null;
  }

  protected async apply() {
    const { w: nw, h: nh } = this.natural();
    const rect = sourceRect(nw, nh, this.frameWidth(), this.ratio(), this.zoom(), this.off());

    const canvas = document.createElement('canvas');
    // Never upscale: a small original crops to a small file.
    canvas.width = Math.min(MAX_WIDTH, Math.round(rect.sw));
    canvas.height = Math.round(canvas.width / this.ratio());

    const source = new Image();
    source.src = this.src()!;
    await source.decode();
    canvas
      .getContext('2d')!
      .drawImage(
        source,
        rect.sx,
        rect.sy,
        rect.sw,
        rect.sh,
        0,
        0,
        canvas.width,
        canvas.height,
      );

    // PNG keeps a sponsor logo's transparency. Everything else is a photo, so JPEG is smaller.
    const type = this.file().type === 'image/png' ? 'image/png' : 'image/jpeg';
    canvas.toBlob(
      (blob) => blob && this.cropped.emit(new File([blob], this.file().name, { type })),
      type,
      0.9,
    );
  }

  private centre() {
    const size = this.size();
    const w = this.frameWidth();
    this.off.set({ x: (w - size.w) / 2, y: (w / this.ratio() - size.h) / 2 });
  }

  private clamp() {
    const { w: nw, h: nh } = this.natural();
    if (!nw || !this.frameWidth()) return;
    this.off.update((o) =>
      clampOffset(nw, nh, this.frameWidth(), this.ratio(), this.zoom(), o),
    );
  }
}
