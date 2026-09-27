import { TestBed } from '@angular/core/testing';
import jsQR from 'jsqr';
import { EntrantSummary } from '../core/api.models';
import { QrPass } from './qr-pass';

describe('participant QR pass', () => {
  const payload = 'VASBYT:2027:1cfd51af-a557-4c45-8e03-f6e45e954b9b';
  const entrant: EntrantSummary = {
    id: 1, orderLineId: 1, routeCode: 'ligdraf', routeName: 'Ligdraf', tariffKind: 'Student',
    firstName: 'Anna', lastName: 'Toets', isComplete: true, entryNumber: 'VB2027-0001', qrPayload: payload,
  };

  it('renders a downloadable PNG that a real QR decoder reads as the opaque participant token', async () => {
    TestBed.configureTestingModule({ imports: [QrPass] });
    const fixture = TestBed.createComponent(QrPass);
    fixture.componentRef.setInput('entrant', entrant);
    const image = await renderedImage(() => { fixture.detectChanges(); return fixture.nativeElement.querySelector('img'); });
    const decoded = await decode(image.src);
    expect(decoded).toBe(payload);
    const download = fixture.nativeElement.querySelector('a[download]') as HTMLAnchorElement;
    expect(download.download).toBe('VB2027-0001.png');
    expect(download.href).toBe(image.src);
    expect(decoded).not.toContain('Anna');
  });

  it('renders participant names as text and changes the image when another pass is selected', async () => {
    TestBed.configureTestingModule({ imports: [QrPass] });
    const fixture = TestBed.createComponent(QrPass);
    fixture.componentRef.setInput('entrant', { ...entrant, firstName: '<script>alert(1)</script>' });
    const first = await renderedImage(() => { fixture.detectChanges(); return fixture.nativeElement.querySelector('img'); });
    const firstUrl = first.src;
    expect(fixture.nativeElement.querySelector('script')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('<script>alert(1)</script>');
    const nextPayload = 'VASBYT:2027:759f286e-4e2e-4ba8-9bda-4bfc3d9e061b';
    fixture.componentRef.setInput('entrant', { ...entrant, id: 2, qrPayload: nextPayload });
    const second = await renderedImage(() => {
      fixture.detectChanges();
      const image = fixture.nativeElement.querySelector('img') as HTMLImageElement | null;
      return image?.src !== firstUrl ? image : null;
    });
    expect((await decode(second.src))).toBe(nextPayload);
  });
});

async function renderedImage(read: () => HTMLImageElement | null): Promise<HTMLImageElement> {
  for (let attempt = 0; attempt < 250; attempt++) {
    const image = read();
    if (image) return image;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Participant QR image did not render');
}

async function decode(url: string): Promise<string> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(pixels.data, pixels.width, pixels.height)?.data ?? '';
}
