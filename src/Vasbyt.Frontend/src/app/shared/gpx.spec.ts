import { parseGpx, steepest, thin } from './gpx';

/** A straight line north along a meridian: 0.0045 degrees of latitude is about 500 m. */
function gpx(eles: number[]) {
  const pts = eles.map((e, i) => `<trkpt lat="${(-29.8 + i * 0.0045).toFixed(4)}" lon="24.4"><ele>${e}</ele></trkpt>`);
  return `<gpx><trk><trkseg>${pts.join('')}</trkseg></trk></gpx>`;
}

describe('parseGpx', () => {
  it('counts climb and descent past the 3 m hysteresis, ignoring wobble', () => {
    const t = parseGpx(gpx([1100, 1101, 1100, 1110, 1120, 1119, 1105, 1100]));
    expect(t.climbM).toBe(20);
    expect(t.descentM).toBe(20);
    expect(t.maxEleM).toBe(1120);
  });

  it('finds the steepest 500 m window', () => {
    const t = parseGpx(gpx([1100, 1100, 1125, 1130]));
    expect(t.maxGradePct).toBeCloseTo(5, 0);
    expect(steepest(t.points, 50)).toBe(0);
  });

  it('thins to at most the budget and keeps the last point', () => {
    const t = parseGpx(gpx(Array.from({ length: 1000 }, () => 1100)));
    const out = thin(t.points, 100);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out.at(-1)).toBe(t.points.at(-1)!);
  });
});
