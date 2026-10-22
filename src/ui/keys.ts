// Key hints written as [E] in a text are drawn as keycaps (the kbd style lives in index.html).

/** Set `el`'s text, drawing every [Key] (up to 6 characters, no spaces) as a keycap. */
export function withKeys(el: HTMLElement, text: string) {
  el.replaceChildren(...text.split(/\[([^\]\s]{1,6})\]/).map((s, i) => (i % 2 ? Object.assign(document.createElement('kbd'), { textContent: s }) : s)));
}
