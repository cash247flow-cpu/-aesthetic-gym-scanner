"use client";

import { useEffect, useState } from "react";
import {
  NOTE_MAX,
  dayName,
  loadMissedNotes,
  missedThisWeek,
  setMissedNote,
  skipMissed,
  weekStatus,
  type DayItem,
} from "@/lib/missed";

const KIND: Record<DayItem["kind"], string> = { lift: "Workout", abs: "Abs", forearms: "Forearms", cardio: "Cardio" };

/**
 * Missed workouts, abs and cardio from earlier this week (Sunday–Saturday), each with
 * "Make it up" or "Skip". Each missed day can carry a short note (why it was missed); the note
 * is kept after a skip or make-up and shows in that week's review. A new week starts clean.
 * Browser-only data, so it renders after mount.
 */
export function MissedCard({ onMakeUp }: { onMakeUp: (item: DayItem) => void }) {
  const [items, setItems] = useState<DayItem[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null); // date being edited
  const [draft, setDraft] = useState("");
  const refresh = () => {
    setItems(missedThisWeek(weekStatus()));
    setNotes(loadMissedNotes());
  };
  useEffect(refresh, []);

  if (!items?.length) return null;

  function skip(item: DayItem) {
    if (!window.confirm(`Skip ${dayName(item.date)}'s ${item.label}? It stays recorded as missed.`)) return;
    skipMissed(item.key);
    refresh();
  }

  function startEdit(date: string) {
    setEditing(date);
    setDraft(notes[date] ?? "");
  }

  function save(date: string, text: string) {
    setMissedNote(date, text);
    setEditing(null);
    refresh();
  }

  const firstOfDay = new Set(items.filter((it, i) => items.findIndex((x) => x.date === it.date) === i).map((it) => it.key));

  return (
    <section aria-label="Missed this week" className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Missed this week</p>
      <ul className="mt-2 grid grid-cols-1 gap-2">
        {items.map((it) => (
          <li key={it.key} className="rounded-xl bg-zinc-900 px-3 py-2.5">
            <p className="font-semibold leading-snug">
              {dayName(it.date)} · {it.label}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="flex-1 text-xs text-zinc-400">{KIND[it.kind]} missed</span>
              <button
                type="button"
                onClick={() => skip(it)}
                className="shrink-0 px-2 text-xs font-semibold text-zinc-500 hover:text-zinc-300"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => onMakeUp(it)}
                className="h-9 shrink-0 rounded-full bg-gradient-to-r from-lime-400 to-emerald-300 px-3.5 text-sm font-semibold text-zinc-950 transition active:scale-95"
              >
                Make it up
              </button>
            </div>
            {firstOfDay.has(it.key) && (
              <DayNote
                day={dayName(it.date)}
                note={notes[it.date]}
                editing={editing === it.date}
                draft={draft}
                onDraft={setDraft}
                onEdit={() => startEdit(it.date)}
                onSave={() => save(it.date, draft)}
                onCancel={() => setEditing(null)}
                onDelete={() => save(it.date, "")}
              />
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-zinc-500">Make-ups count until Saturday. Each week starts fresh on Sunday.</p>
    </section>
  );
}

function DayNote({
  day,
  note,
  editing,
  draft,
  onDraft,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  day: string;
  note: string | undefined;
  editing: boolean;
  draft: string;
  onDraft: (v: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  if (editing) {
    return (
      <div className="mt-2 border-t border-zinc-800 pt-2">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Note for {day}</span>
          <textarea
            value={draft}
            onChange={(e) => onDraft(e.target.value.slice(0, NOTE_MAX))}
            rows={2}
            maxLength={NOTE_MAX}
            placeholder="e.g. Sore after going too heavy"
            className="mt-1 w-full resize-none rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="flex-1 text-[11px] text-zinc-500">
            {draft.length}/{NOTE_MAX} · stays on this phone
          </span>
          {note && (
            <button type="button" onClick={onDelete} className="px-2 text-xs font-semibold text-zinc-500 hover:text-red-300">
              Delete
            </button>
          )}
          <button type="button" onClick={onCancel} className="px-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="h-8 rounded-full bg-amber-300 px-3 text-xs font-semibold text-zinc-950 transition active:scale-95"
          >
            Save note
          </button>
        </div>
      </div>
    );
  }
  return note ? (
    <p className="mt-2 flex items-start gap-2 border-t border-zinc-800 pt-2 text-sm text-zinc-300">
      <span className="flex-1 break-words">📝 {note}</span>
      <button type="button" onClick={onEdit} aria-label={`Edit note for ${day}`} className="shrink-0 text-xs font-semibold text-amber-300">
        Edit
      </button>
    </p>
  ) : (
    <button type="button" onClick={onEdit} aria-label={`Add a note for ${day}`} className="mt-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200">
      + Add note
    </button>
  );
}
