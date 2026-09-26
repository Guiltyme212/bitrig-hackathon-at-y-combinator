// Clear and Tide are kept for later; onboarding shows Prism only for now.
const allOrbs = [
  { id: 'clear', name: 'Clear', description: 'Quiet, clear glass', scale:1, video: require('../../assets/video/orb-loop.mp4'), poster: require('../../assets/video/orb-poster.jpg') },
  { id: 'prism', name: 'Prism', description: 'Light, in every colour', scale:1.04, video: require('../../assets/video/prism-loop.mp4'), poster: require('../../assets/video/prism-poster.jpg') },
  { id: 'tide', name: 'Tide', description: 'A little room to flow', scale:1.24, video: require('../../assets/video/tide-loop.mp4'), poster: require('../../assets/video/tide-poster.jpg') },
] as const;

export type OrbOption = typeof allOrbs[number];
export const orbOptions: readonly OrbOption[] = allOrbs.filter(orb => orb.id === 'prism');

export function wrappedOrbIndex(index: number) {
  return ((index % orbOptions.length) + orbOptions.length) % orbOptions.length;
}
