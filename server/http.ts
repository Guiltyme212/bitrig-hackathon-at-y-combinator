import { request } from 'node:https';

// A JSON POST over Node's own https. The development server's fetch gives up after
// about 30 seconds ("Request timed out"), and writing a whole meditation can take
// longer; this waits exactly as long as we say.
export function postJson<T>(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<{ status: number; json: T }> {
  const payload = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': String(payload.length) } }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk as Buffer));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode ?? 0, json: (text ? JSON.parse(text) : {}) as T }); }
        catch { reject(new Error(`Unreadable answer (${res.statusCode}).`)); }
      });
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('The writer took too long.')));
    req.on('error', reject);
    req.end(payload);
  });
}
