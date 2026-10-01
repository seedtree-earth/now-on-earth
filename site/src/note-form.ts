/**
 * "Add what you notice": the ground-note form, drawn inside the card. Plain
 * questions, a few words each; the core checks and rounds what is given
 * (makeGroundNote), and the store keeps it. Nothing is shared unless the
 * writer ticks "Share this note".
 */

import {
  type GroundNote,
  type GroundNoteKind,
  type GroundNoteLicence,
  type GroundNoteStore,
  type LngLat,
  GROUND_NOTE_KINDS,
  NAME_MAX,
  NOTE_MAX,
  WHAT_MAX,
  groundNoteWords,
  kindInfo,
  makeGroundNote,
} from "now-on-earth/core";

export type NoteFormOptions = {
  at: LngLat;
  /** The place in words, for the heading ("Lisbon, Portugal"). */
  placeLabel: string;
  /** The day shown on the clock; the form starts there (never past today). */
  day: Date;
  store: GroundNoteStore;
  onSaved: (note: GroundNote) => void;
  onDone: () => void;
};

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
};

/** YYYY-MM-DD in the viewer's own calendar. */
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

let formSeq = 0;

export function showNoteForm(root: HTMLElement, opts: NoteFormOptions) {
  const id = `note-${++formSeq}`;
  const today = isoDay(new Date());
  const startDay = isoDay(opts.day) > today ? today : isoDay(opts.day);

  // What was noticed: weather, then life.
  const kind = el("select", { id: `${id}-kind`, required: true });
  kind.append(el("option", { value: "", textContent: "Choose…" }));
  for (const [group, label] of [
    ["weather", "Weather"],
    ["life", "Life"],
  ] as const) {
    const og = el("optgroup", { label });
    for (const k of GROUND_NOTE_KINDS.filter((k) => k.group === group)) og.append(el("option", { value: k.kind, textContent: k.label }));
    kind.append(og);
  }

  const what = el("input", { id: `${id}-what`, type: "text", maxLength: WHAT_MAX, autocomplete: "off" });
  const whatRow = el("div", { className: "field" }, el("label", { htmlFor: what.id, textContent: "What?" }), what);
  const amount = el("input", { id: `${id}-amount`, type: "number", min: "0", max: "2000", step: "0.1", inputMode: "decimal" });
  const amountRow = el(
    "div",
    { className: "field" },
    el("label", { htmlFor: amount.id, textContent: "How much rain (mm)" }),
    amount,
  );
  const day = el("input", { id: `${id}-day`, type: "date", value: startDay, max: today, required: true });
  const note = el("textarea", { id: `${id}-note`, rows: 2, maxLength: NOTE_MAX, placeholder: "A few words more, if you like" });
  const by = el("input", { id: `${id}-by`, type: "text", maxLength: NAME_MAX, placeholder: "Leave empty to stay unnamed" });

  const licence = (value: GroundNoteLicence, text: string, checked: boolean) =>
    el("label", { className: "choice" }, el("input", { type: "radio", name: `${id}-licence`, value, checked }), ` ${text}`);
  const licences = el(
    "fieldset",
    { className: "field" },
    el("legend", { textContent: "How others may use it" }),
    licence("CC-BY-4.0", "Freely, with credit (CC BY 4.0)", true),
    licence("CC0-1.0", "Freely, no credit needed (CC0)", false),
  );
  const share = el("input", { type: "checkbox", id: `${id}-share` });
  const shareRow = el(
    "label",
    { className: "choice share" },
    share,
    " Share this note. It is placed to about ten kilometres, with no time of day.",
  );
  const problems = el("ul", { className: "problems" });
  problems.setAttribute("role", "alert");

  const sync = () => {
    const info = kind.value ? kindInfo(kind.value as GroundNoteKind) : null;
    whatRow.hidden = !info?.what;
    what.placeholder = info?.whatHint ? `e.g. ${info.whatHint}` : "";
    what.required = info?.what === "required";
    amountRow.hidden = !info?.amount;
  };
  kind.addEventListener("change", sync);
  sync();

  const form = el(
    "form",
    { className: "note-form", noValidate: true },
    el("strong", { textContent: "What did you notice?" }),
    el("p", { className: "note-where", textContent: `Near ${opts.placeLabel}` }),
    el("div", { className: "field" }, el("label", { htmlFor: kind.id, textContent: "What it was" }), kind),
    whatRow,
    amountRow,
    el("div", { className: "field" }, el("label", { htmlFor: day.id, textContent: "The day" }), day),
    el("div", { className: "field" }, el("label", { htmlFor: note.id, textContent: "More (optional)" }), note),
    el("div", { className: "field" }, el("label", { htmlFor: by.id, textContent: "Your name, for credit (optional)" }), by),
    licences,
    shareRow,
    el("p", { className: "note-kept", textContent: `Kept ${opts.store.where}.` }),
    problems,
  );
  const cancel = el("button", { type: "button", className: "quiet", textContent: "Cancel" });
  cancel.addEventListener("click", opts.onDone);
  form.append(el("div", { className: "place-actions" }, el("button", { type: "submit", textContent: "Add it" }), cancel));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const chosen = form.querySelector<HTMLInputElement>(`input[name="${id}-licence"]:checked`);
    const made = makeGroundNote({
      kind: kind.value as GroundNoteKind,
      what: what.value,
      amount: amount.value,
      observedOn: day.value,
      place: opts.at,
      note: note.value,
      by: by.value,
      licence: (chosen?.value ?? "") as GroundNoteLicence,
      shared: share.checked,
    });
    if (!made.ok) {
      problems.replaceChildren(...made.problems.map((p) => el("li", { textContent: p })));
      return;
    }
    await opts.store.add(made.note);
    opts.onSaved(made.note);
    const done = el("button", { type: "button", textContent: "Done" });
    done.addEventListener("click", opts.onDone);
    root.replaceChildren(
      el("strong", { textContent: "Thank you" }),
      el("p", { className: "note-where", textContent: `${groundNoteWords(made.note, new Date())} It is on the globe now, near ${opts.placeLabel}.` }),
      el("div", { className: "place-actions" }, done),
    );
    done.focus();
  });

  root.hidden = false;
  root.replaceChildren(form);
  kind.focus();
}
