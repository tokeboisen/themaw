// Små hjælpere til at tegne skærmene som HTML.

export const esc = (value: unknown): string =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const $ = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T =>
  root.querySelector(selector) as T;

/** Lytter på klik på elementer med data-act inde i root. */
export function onAction(root: HTMLElement, handler: (act: string, id: string | undefined, el: HTMLElement) => void): void {
  root.addEventListener('click', (event) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    handler(el.dataset.act!, el.dataset.id, el);
  });
}
