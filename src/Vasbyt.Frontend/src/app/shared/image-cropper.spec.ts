import { clampOffset, coverSize, sourceRect } from './image-cropper';

/** The crop maths is the only part that can silently produce a wrong image, so it is the part tested. */
describe('image cropper maths', () => {
  const frame = 400;
  const ratio = 4 / 3; // frame is 400 x 300

  it('covers the frame at zoom 1 with a portrait source', () => {
    // 600 x 1200: the width is the tight axis, so it scales to the frame width.
    const size = coverSize(600, 1200, frame, ratio, 1);
    expect(size.w).toBe(400);
    expect(size.h).toBe(800);
    expect(size.h).toBeGreaterThanOrEqual(300);
  });

  it('covers the frame at zoom 1 with a landscape source', () => {
    const size = coverSize(1200, 600, frame, ratio, 1);
    expect(size.h).toBe(300);
    expect(size.w).toBe(600);
  });

  it('crops the full short axis when the frame is centred', () => {
    // Centred on 600 x 1200 at zoom 1: the whole width, a 4/3 band out of the middle.
    const off = { x: 0, y: (300 - 800) / 2 };
    const rect = sourceRect(600, 1200, frame, ratio, 1, off);
    expect(rect.sx).toBe(0);
    expect(rect.sw).toBe(600);
    expect(rect.sh).toBe(450);
    expect(rect.sy).toBe(375);
    // The band sits in the middle: equal source pixels above and below.
    expect(rect.sy).toBe((1200 - rect.sh) / 2);
  });

  it('never crops outside the source image', () => {
    // Drag hard past both edges, then clamp.
    const off = clampOffset(600, 1200, frame, ratio, 1, { x: 999, y: -9999 });
    const rect = sourceRect(600, 1200, frame, ratio, 1, off);
    expect(rect.sx).toBeGreaterThanOrEqual(0);
    expect(rect.sy).toBeGreaterThanOrEqual(0);
    expect(rect.sx + rect.sw).toBeLessThanOrEqual(600);
    expect(rect.sy + rect.sh).toBeLessThanOrEqual(1200);
  });

  it('keeps the frame ratio at every zoom', () => {
    for (const zoom of [1, 1.5, 2.75, 4]) {
      const off = clampOffset(1200, 900, frame, ratio, zoom, { x: -10, y: -10 });
      const rect = sourceRect(1200, 900, frame, ratio, zoom, off);
      expect(rect.sw / rect.sh).toBeCloseTo(ratio, 6);
    }
  });

  it('zooming in crops less of the source', () => {
    const wide = sourceRect(1200, 900, frame, ratio, 1, { x: 0, y: 0 });
    const tight = sourceRect(1200, 900, frame, ratio, 2, { x: 0, y: 0 });
    expect(tight.sw).toBeLessThan(wide.sw);
    expect(tight.sw).toBeCloseTo(wide.sw / 2, 6);
  });
});
