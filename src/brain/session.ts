import type { Outcome } from '../meditation/types';

// One conversation with the Kokoro Orb agent (ElevenLabs, text mode) over a plain
// WebSocket: no SDK and no native code, so it runs in Expo Go (and in Node, for
// server/brain/try.ts). The orb says the replies with its own voice.

export type Proposal = {
  title: string;
  outcome: Outcome;
  situation: string;
  quote: string;
  second_quote?: string;
  feeling: string;
  next?: string;
};
export type Turn = { reply: string; proposal: Proposal | null };

type Pending = { resolve: (turn: Turn) => void; reject: (error: Error) => void; reply: string; proposal: Proposal | null; settle?: ReturnType<typeof setTimeout> };

const OUTCOMES: Outcome[] = ['settle', 'clarity', 'support', 'sleep', 'lift'];

function readProposal(raw: Record<string, unknown>): Proposal | null {
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const outcome = OUTCOMES.includes(raw.outcome as Outcome) ? (raw.outcome as Outcome) : 'settle';
  const situation = text(raw.situation);
  if (!situation) return null;
  return {
    title: text(raw.title) || 'For you', outcome, situation, quote: text(raw.quote), feeling: text(raw.feeling),
    second_quote: text(raw.second_quote) || undefined, next: text(raw.next) || undefined,
  };
}

export class BrainSession {
  private socket: WebSocket;
  private ready: Promise<void>;
  private pending: Pending | null = null;
  private closed = false;

  constructor(url: string, variables: Record<string, string>, private timeoutMs = 16_000) {
    this.socket = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      const fail = setTimeout(() => reject(new Error('The brain didn’t answer the door.')), 8000);
      this.socket.onopen = () => {
        this.socket.send(JSON.stringify({ type: 'conversation_initiation_client_data', dynamic_variables: variables, conversation_config_override: { conversation: { text_only: true } } }));
      };
      this.socket.onmessage = event => {
        let message: Record<string, any>;
        try { message = JSON.parse(String(event.data)); } catch { return; }
        if (message.type === 'conversation_initiation_metadata') { clearTimeout(fail); resolve(); }
        this.handle(message);
      };
      this.socket.onerror = () => { clearTimeout(fail); reject(new Error('The brain couldn’t be reached.')); this.abort('The brain went quiet.'); };
      this.socket.onclose = () => { this.closed = true; clearTimeout(fail); reject(new Error('The brain hung up.')); this.abort('The brain hung up.'); };
    });
    this.ready.catch(() => {});
  }

  opened() { return this.ready; }
  get alive() { return !this.closed; }

  // Says `text` to the agent; resolves with its reply and, when it has enough,
  // its proposal. Rejects on silence, so the caller can fall back.
  async send(text: string): Promise<Turn> {
    await this.ready;
    if (this.closed) throw new Error('The brain hung up.');
    if (this.pending) throw new Error('Still answering.');
    return new Promise<Turn>((resolve, reject) => {
      const timer = setTimeout(() => { if (this.pending) { const p = this.pending; this.pending = null; if (p.reply || p.proposal) p.resolve({ reply: p.reply, proposal: p.proposal }); else reject(new Error('The brain took too long.')); } }, this.timeoutMs);
      this.pending = {
        reply: '', proposal: null,
        resolve: turn => { clearTimeout(timer); resolve(turn); },
        reject: error => { clearTimeout(timer); reject(error); },
      };
      this.socket.send(JSON.stringify({ type: 'user_message', text }));
    });
  }

  close() {
    this.closed = true;
    try { this.socket.close(); } catch {}
  }

  private handle(message: Record<string, any>) {
    if (message.type === 'ping') {
      this.socket.send(JSON.stringify({ type: 'pong', event_id: message.ping_event?.event_id }));
      return;
    }
    const p = this.pending;
    if (!p) return;
    if (message.type === 'agent_response') {
      const reply = String(message.agent_response_event?.agent_response ?? '').trim();
      if (reply) p.reply = p.reply ? `${p.reply} ${reply}` : reply;
      // A proposal can follow its line by a moment; wait briefly for it.
      this.settle(p, p.proposal ? 250 : 900);
    } else if (message.type === 'client_tool_call' && message.client_tool_call?.tool_name === 'propose_meditation') {
      p.proposal = readProposal(message.client_tool_call.parameters ?? {});
      try { this.socket.send(JSON.stringify({ type: 'client_tool_result', tool_call_id: message.client_tool_call.tool_call_id, result: 'Shown to them with a Make it button.', is_error: false })); } catch {}
      this.settle(p, p.reply ? 250 : 2500);
    }
  }

  private settle(p: Pending, ms: number) {
    if (p.settle) clearTimeout(p.settle);
    p.settle = setTimeout(() => {
      if (this.pending !== p) return;
      this.pending = null;
      p.resolve({ reply: p.reply, proposal: p.proposal });
    }, ms);
  }

  private abort(reason: string) {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    if (p.reply || p.proposal) p.resolve({ reply: p.reply, proposal: p.proposal });
    else p.reject(new Error(reason));
  }
}

// Splits a reply into lines the orb can say one at a time (each under the voice's
// 180-character limit), keeping sentences whole where possible.
export function linesOf(reply: string): string[] {
  const sentences = reply.replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]+["”’)]*|[^.!?…]+$/g)?.map(s => s.trim()).filter(Boolean) ?? [];
  const lines: string[] = [];
  for (const sentence of sentences) {
    const last = lines[lines.length - 1];
    if (last && last.length + sentence.length < 90) lines[lines.length - 1] = `${last} ${sentence}`;
    else if (sentence.length <= 175) lines.push(sentence);
    else lines.push(...(sentence.match(/.{1,170}(\s|$)/g) ?? [sentence]).map(s => s.trim()).filter(Boolean));
  }
  return lines;
}
