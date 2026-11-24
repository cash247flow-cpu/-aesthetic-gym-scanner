"use client";

import { AccentLast, TITLE } from "@/components/ui";
import { TRAINING_TERMS } from "@/lib/trainingTerms";

/** Plain-English glossary of the words the plan uses. Static: nothing is stored. */
export function TrainingTerms({ onBack }: { onBack: () => void }) {
  return (
    <section className="mt-2">
      <button type="button" onClick={onBack} className="text-sm text-zinc-400">
        ← Back
      </button>
      <h1 className={`${TITLE} mt-2`}>
        <AccentLast text="Training terms" />
      </h1>
      <p className="mt-1 text-sm text-zinc-400">The words your plan uses, in plain English.</p>

      {TRAINING_TERMS.map((group) => (
        <section key={group.title} aria-label={group.title} className="mt-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{group.title}</h2>
          <dl className="mt-2 grid grid-cols-1 gap-2">
            {group.terms.map((t) => (
              <div key={t.term} className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <dt className="font-semibold text-zinc-100">{t.term}</dt>
                <dd className="mt-1 text-sm text-zinc-300">{t.meaning}</dd>
                {t.inApp && (
                  <dd className="mt-1.5 text-sm text-lime-200/90">
                    <span className="font-semibold text-lime-300">In your plan · </span>
                    {t.inApp}
                  </dd>
                )}
              </div>
            ))}
          </dl>
        </section>
      ))}
    </section>
  );
}
