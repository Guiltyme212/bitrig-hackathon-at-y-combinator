export const failedStatuses = new Set(['failed', 'canceled', 'cancelled', 'nsfw', 'moderated']);

export function completedVideo(status: string, value?: string): string {
  if (status !== 'completed') throw new Error(`Generation is ${status}; no successful video is available.`);
  if (!value) throw new Error('The completed request did not contain a video URL.');
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('The video result must be an HTTPS URL.');
  return url.href;
}
