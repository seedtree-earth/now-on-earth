/**
 * Hearts Now: the inward view. The globe settles on the person's place and
 * the interface quiets; a single card says where they are on their own
 * wheel, the quality of the light, the moon's quality, one reflection
 * question, and an invitation to go outside.
 *
 * Content comes from content/turning/ (one JSON file per season and
 * turning). On the public site only reviewed files are shown; drafts appear
 * on localhost only, tagged "draft". Nothing anyone reflects on is stored.
 */

import { GO_OUTSIDE, type LngLat, type TurningContent, heartsNow } from "now-on-earth/core";

const files = import.meta.glob<TurningContent>("../../content/turning/**/*.json", { eager: true, import: "default" });
const ALL: TurningContent[] = Object.values(files);
/** Reviewed content everywhere; drafts on localhost only. */
export const HEARTS_CONTENT = import.meta.env.DEV ? ALL : ALL.filter((c) => c.status === "reviewed");

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) => {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** Fill the Hearts Now card for a place and this moment. */
export function renderHearts(root: HTMLElement, opts: { at: LngLat; place: string; onBack: () => void }) {
  const h = heartsNow(new Date(), opts.at, HEARTS_CONTENT);
  const c = h.content;
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const head = el("p", "eyebrow", `Hearts Now · ${opts.place}`);
  const where = el("h2", "hearts-where", h.where);
  const about = c ? el("p", "hearts-about", c.description) : null;

  const list = el("dl", "hearts-list");
  const row = (term: string, text: string) => {
    list.append(el("dt", "", term), el("dd", "", text));
  };
  row("The light", h.light);
  row("The moon", `${cap(h.moon.words)}.`);

  const parts: HTMLElement[] = [head, where];
  if (about) parts.push(about);
  parts.push(list);

  if (c) {
    const q = el("p", "hearts-question", c.reflection);
    if (c.status !== "reviewed") q.append(" ", el("span", "draft-tag", "draft"));
    parts.push(q);
  }
  // Every moment ends outside.
  const invite = el("p", "hearts-invite", c ? c.invitation : GO_OUTSIDE);
  if (c && c.status !== "reviewed") invite.append(" ", el("span", "draft-tag", "draft"));
  parts.push(invite);

  parts.push(
    el("p", "hearts-note", "Nothing you reflect on here is kept. A private seasonal record, in your own keeping, may come later."),
  );
  const back = el("button", "hearts-back", "Back to Earth Now");
  back.type = "button";
  back.addEventListener("click", opts.onBack);
  parts.push(back);

  root.replaceChildren(...parts);
}
