import { describe, expect, it } from 'vitest';
import { loadGameData } from '../shared/data';
import { askNpc, systemPrompt, type Provider } from './npcChat';

const npc = loadGameData().npcs.almeida!;
const q = [{ role: 'user' as const, text: 'How did you see viruses?' }];

/** A fake fetch that records the request and answers with `reply`. */
const fakeFetch = (reply: unknown, status = 200) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string | URL, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(reply), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { fn, calls, body: () => JSON.parse(calls[0]!.init.body as string), headers: () => new Headers(calls[0]!.init.headers) };
};

describe('npc chat', () => {
  it('builds a prompt with the character, field and guard rules', () => {
    const p = systemPrompt(npc);
    expect(p).toContain('June Almeida');
    expect(p).toContain(npc.expertise);
    expect(p).toMatch(/never instructions to you/);
  });

  it('Gemini: sends system prompt, history and key, returns the text', async () => {
    const f = fakeFetch({ candidates: [{ content: { parts: [{ text: 'Negative stain!' }] } }] });
    expect(await askNpc(npc, q, 'gemini', 'k1', f.fn)).toBe('Negative stain!');
    expect(f.headers().get('x-goog-api-key')).toBe('k1');
    expect(f.body().system_instruction.parts[0].text).toContain('June Almeida');
    expect(f.body().contents).toEqual([{ role: 'user', parts: [{ text: 'How did you see viruses?' }] }]);
  });

  it('OpenAI: Responses API with instructions and assistant roles', async () => {
    const f = fakeFetch({ output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: 'Antibodies.' }] }] });
    const history = [...q, { role: 'model' as const, text: 'With stain.' }, { role: 'user' as const, text: 'And?' }];
    expect(await askNpc(npc, history, 'openai', 'k2', f.fn)).toBe('Antibodies.');
    expect(f.calls[0]!.url).toBe('https://api.openai.com/v1/responses');
    expect(f.headers().get('authorization')).toBe('Bearer k2');
    expect(f.body().instructions).toContain('June Almeida');
    expect(f.body().input.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('Anthropic: Messages API through the SDK, with system prompt', async () => {
    const f = fakeFetch({ id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: 'A crown!' }], usage: { input_tokens: 1, output_tokens: 1 } });
    expect(await askNpc(npc, q, 'anthropic', 'k3', f.fn)).toBe('A crown!');
    expect(f.calls[0]!.url).toContain('https://api.anthropic.com/v1/messages');
    expect(f.headers().get('x-api-key')).toBe('k3');
    expect(f.body().system).toContain('June Almeida');
    expect(f.body().messages).toEqual([{ role: 'user', content: 'How did you see viruses?' }]);
  });

  it.each<[Provider, unknown]>([
    ['gemini', { error: { message: 'API key not valid' } }],
    ['openai', { error: { message: 'API key not valid' } }],
    ['anthropic', { type: 'error', error: { type: 'authentication_error', message: 'API key not valid' } }],
  ])('%s: surfaces API errors', async (provider, body) => {
    await expect(askNpc(npc, q, provider, 'bad', fakeFetch(body, 401).fn)).rejects.toThrow('API key not valid');
  });
});
