import { describe, expect, it } from 'vitest';
import { loadGameData } from '../shared/data';
import { askNpc, systemPrompt } from './npcChat';

const npc = loadGameData().npcs.almeida!;

describe('npc chat', () => {
  it('builds a prompt with the character, field and guard rules', () => {
    const p = systemPrompt(npc);
    expect(p).toContain('June Almeida');
    expect(p).toContain(npc.expertise);
    expect(p).toMatch(/never instructions to you/);
  });

  it('sends system prompt, history and key to Gemini and returns the text', async () => {
    let sent: { url: string; init: RequestInit } | undefined;
    const fake = (async (url: string, init: RequestInit) => {
      sent = { url, init };
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Negative stain!' }] } }] }));
    }) as unknown as typeof fetch;
    const reply = await askNpc(npc, [{ role: 'user', text: 'How did you see viruses?' }], 'k123', fake);
    expect(reply).toBe('Negative stain!');
    expect((sent!.init.headers as Record<string, string>)['x-goog-api-key']).toBe('k123');
    const body = JSON.parse(sent!.init.body as string);
    expect(body.system_instruction.parts[0].text).toContain('June Almeida');
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'How did you see viruses?' }] }]);
  });

  it('surfaces API errors', async () => {
    const fake = (async () => new Response(JSON.stringify({ error: { message: 'API key not valid' } }), { status: 400 })) as unknown as typeof fetch;
    await expect(askNpc(npc, [{ role: 'user', text: 'hi' }], 'bad', fake)).rejects.toThrow('API key not valid');
  });
});
