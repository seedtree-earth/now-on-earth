/**
 * The Layers panel, arranged as lenses. Each lens is a switch (is this way of
 * looking on?) and a disclosure that opens to show its own layers. A layer is
 * drawn when its lens is on and its own switch is on. Layers still to come
 * are listed quietly, switched off, so the shape of each lens is visible.
 */

import { LENSES, type LensId, lensOf } from "now-on-earth/mapbox";

export type LayerEntry = {
  key: string;
  label: string;
  /** Small words after the label, e.g. "(sample)". */
  note?: string;
  /** Built and switchable; otherwise shown as "to come". */
  built: boolean;
  /** Starts switched on (within its lens). */
  on: boolean;
  /** Extra element under the switch (e.g. a credit). */
  after?: HTMLElement;
};

export type LensPanel = {
  isShown(key: string): boolean;
  /** Keys of every drawable layer whose own switch is off. */
  offKeys(): string[];
  lensStates(): Record<LensId, boolean>;
  /** Switch a lens on from elsewhere (e.g. after adding a note to it). */
  openLens(lens: LensId): void;
  closeLens(lens: LensId): void;
  /** Grey out and lock layers that do not apply (e.g. while the Flat model shows). */
  setLocked(keys: string[], locked: boolean): void;
};

const CHEVRON = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function createLensPanel(
  root: HTMLElement,
  entries: LayerEntry[],
  opts: {
    eventLens: Record<string, LensId>;
    /** Settings that live inside a lens, not layers (e.g. finer rings). */
    extras?: Partial<Record<LensId, HTMLElement[]>>;
    /** Upcoming names per lens, beyond those in LENSES. */
    upcoming?: Partial<Record<LensId, string[]>>;
    onLayer(key: string, shown: boolean): void;
    onLens(lens: LensId, on: boolean): void;
  },
): LensPanel {
  const chosen = new Map(entries.map((e) => [e.key, e.on]));
  const lensOn = new Map(LENSES.map((l) => [l.id, l.on]));
  const lensFor = (key: string) => lensOf(key, opts.eventLens);
  const isShown = (key: string) => !!chosen.get(key) && !!lensOn.get(lensFor(key)) && !!entries.find((e) => e.key === key)?.built;
  const inputs = new Map<string, HTMLInputElement>();
  const lensInputs = new Map<LensId, HTMLInputElement>();
  const bodies = new Map<LensId, HTMLElement>();

  const switchRow = (label: string, note: string | undefined, input: HTMLInputElement, coming = false) => {
    const row = document.createElement("label");
    row.className = coming ? "switch is-coming" : "switch";
    const span = document.createElement("span");
    span.textContent = label;
    if (note) {
      const em = document.createElement("em");
      em.textContent = ` ${note}`;
      span.append(em);
    }
    row.append(input, span);
    return row;
  };

  const syncLensLook = (lens: LensId) => bodies.get(lens)?.classList.toggle("is-off", !lensOn.get(lens));

  for (const lens of LENSES) {
    const section = document.createElement("section");
    section.className = "lens";
    section.dataset.lens = lens.id;

    // The lens switch, and the disclosure beside it.
    const head = document.createElement("div");
    head.className = "lens-head";
    const lensInput = document.createElement("input");
    lensInput.type = "checkbox";
    lensInput.checked = !!lensOn.get(lens.id);
    lensInputs.set(lens.id, lensInput);
    const lensRow = switchRow(lens.label, undefined, lensInput);
    lensRow.classList.add("lens-switch");
    const open = document.createElement("button");
    open.type = "button";
    open.className = "lens-open";
    open.innerHTML = CHEVRON;
    open.setAttribute("aria-expanded", "false");
    open.setAttribute("aria-label", `Show the layers in ${lens.label}`);
    head.append(lensRow, open);

    const body = document.createElement("div");
    body.className = "lens-body";
    body.id = `lens-${lens.id}`;
    body.hidden = true;
    open.setAttribute("aria-controls", body.id);
    bodies.set(lens.id, body);

    open.addEventListener("click", () => {
      body.hidden = !body.hidden;
      open.setAttribute("aria-expanded", String(!body.hidden));
      section.classList.toggle("is-open", !body.hidden);
    });
    lensInput.addEventListener("change", () => {
      lensOn.set(lens.id, lensInput.checked);
      syncLensLook(lens.id);
      opts.onLens(lens.id, lensInput.checked);
    });

    // Its layers: event layers first (they belong to a lens by their data), then the lens's own.
    const mine = entries.filter((e) => lensFor(e.key) === lens.id);
    const ordered = [
      ...mine.filter((e) => !lens.layers.includes(e.key)),
      ...lens.layers.map((k) => mine.find((e) => e.key === k)).filter((e): e is LayerEntry => !!e),
    ];
    for (const e of ordered) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.layer = e.key;
      if (e.built) {
        input.checked = !!chosen.get(e.key);
        inputs.set(e.key, input);
        input.addEventListener("change", () => {
          chosen.set(e.key, input.checked);
          // Switching a layer on inside a closed lens opens the lens.
          if (input.checked && !lensOn.get(lens.id)) {
            lensOn.set(lens.id, true);
            lensInput.checked = true;
            syncLensLook(lens.id);
            opts.onLens(lens.id, true);
          }
          opts.onLayer(e.key, isShown(e.key));
        });
        body.append(switchRow(e.label, e.note, input));
      } else {
        input.disabled = true;
        body.append(switchRow(e.label, e.note ?? "· to come", input, true));
      }
      if (e.after) body.append(e.after);
    }
    for (const x of opts.extras?.[lens.id] ?? []) body.append(x);
    for (const name of [...lens.upcoming, ...(opts.upcoming?.[lens.id] ?? [])]) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.disabled = true;
      body.append(switchRow(name, "· to come", input, true));
    }

    syncLensLook(lens.id);
    section.append(head, body);
    root.append(section);
  }

  return {
    isShown,
    offKeys: () => entries.filter((e) => e.built && !chosen.get(e.key)).map((e) => e.key),
    lensStates: () => Object.fromEntries(LENSES.map((l) => [l.id, !!lensOn.get(l.id)])) as Record<LensId, boolean>,
    openLens(lens) {
      if (lensOn.get(lens)) return;
      lensOn.set(lens, true);
      const input = lensInputs.get(lens);
      if (input) input.checked = true;
      syncLensLook(lens);
      opts.onLens(lens, true);
    },
    closeLens(lens) {
      if (!lensOn.get(lens)) return;
      lensOn.set(lens, false);
      const input = lensInputs.get(lens);
      if (input) input.checked = false;
      syncLensLook(lens);
      opts.onLens(lens, false);
    },
    setLocked(keys, locked) {
      for (const k of keys) {
        const input = inputs.get(k);
        if (input) input.disabled = locked;
      }
    },
  };
}
