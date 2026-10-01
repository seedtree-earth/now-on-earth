/**
 * Where the standalone site keeps ground notes: in this browser only. Nothing
 * is sent anywhere, so nothing written here is seen by anyone else. The
 * Landscape will pass its own store (shared, with accounts and moderation)
 * through the same GroundNoteStore shape.
 */

import { type GroundNote, type GroundNoteStore, sharedNotes } from "now-on-earth/core";

const KEY = "noe-ground-notes";

function read(): GroundNote[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as GroundNote[]) : [];
    return Array.isArray(list) ? sharedNotes(list) : [];
  } catch {
    return [];
  }
}

function write(notes: GroundNote[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    // Storage blocked or full: the note lives for this visit only.
  }
}

let memory: GroundNote[] | null = null;

export const browserNoteStore: GroundNoteStore = {
  where: "in this browser only, for now",
  async list() {
    memory ??= read();
    return [...memory];
  },
  async add(note) {
    memory ??= read();
    memory = [...memory.filter((n) => n.id !== note.id), note];
    write(memory);
  },
  async remove(id) {
    memory ??= read();
    memory = memory.filter((n) => n.id !== id);
    write(memory);
  },
};
