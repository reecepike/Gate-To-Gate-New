import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { recentKnee, recentLifts } from '@/lib/db';
import { loadToday } from '@/lib/today';
import { toIso, fmtLong } from '@/lib/plan';
import { DAYS, prescribe, LEFT_FIRST_RULE, PROGRESSION_RULE } from '@/lib/gym';
import { rungFor } from '@/lib/knee';
import { logGymSessionAction } from '../../actions';
import Nav from '../../_components/Nav';
import { Submit } from '../../_components/Submit';

export const dynamic = 'force-dynamic';

/**
 * Log a session in one go.
 *
 * Every exercise is already on the page, because the app prescribed them. All
 * you do is put numbers in the boxes for the ones you actually did, and press
 * save once. Last week's load for the same lift sits next to each box, because
 * the only question that matters standing at the rack is "what did I do last
 * time" — and going to find out means opening another page and losing the form.
 */
export default async function LogGym({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; d?: string }>;
}) {
  if (!(await currentUser())) redirect('/login');
  const params = await searchParams;
  const day = params.day ?? toIso(new Date());

  const [kneeLogs, lifts, t] = await Promise.all([
    recentKnee(day, 40), recentLifts(200), loadToday(day),
  ]);
  const rung = rungFor(day, kneeLogs);

  // Whatever the rotation says is due, unless a session was asked for by name.
  const chosen = params.d ? DAYS.find((x) => x.key === params.d) : t.gym.day;
  const gymDay = chosen ?? t.gym.day;

  if (!gymDay) {
    return (
      <div className="wrap">
        <header className="mast">
          <div>
            <div className="greet">{fmtLong(day)}</div>
            <h1>Log a session</h1>
          </div>
        </header>
        <div className="card empty">
          <div className="ic">🏋</div>
          <b>No gym day scheduled today</b>
          <p>Pick the session you actually did and the exercises will fill themselves in.</p>
        </div>
        <div className="subtabs">
          {DAYS.map((d) => (
            <Link key={d.key} href={`/gym/log?d=${d.key}&day=${day}`}>{d.title}</Link>
          ))}
        </div>
        <Nav active="/gym" />
      </div>
    );
  }

  const p = prescribe(day, gymDay, rung.rung, rung.suspended);
  const list = p.replaces ? p.replaces.exercises : gymDay.exercises.filter((e) => !e.plyo);

  /** The last time this exact lift was logged, so the box has a reference. */
  const lastOf = (name: string) =>
    lifts.find((l) => l.exercise.toLowerCase() === name.toLowerCase() && l.day < day) ?? null;

  return (
    <div className="wrap">
      <header className="mast">
        <div>
          <div className="greet">{fmtLong(day)}</div>
          <h1>{p.replaces ? p.replaces.title : gymDay.title}</h1>
        </div>
      </header>

      <div className="subtabs">
        {DAYS.map((d) => (
          <Link
            key={d.key}
            href={`/gym/log?d=${d.key}&day=${day}`}
            className={d.key === gymDay.key ? 'on' : ''}
          >
            {d.title}
          </Link>
        ))}
      </div>

      {!params.d && (
        <div className="note neutral">
          <b>{t.gym.doneThisWeek} of 5 done in the last seven days.</b> {t.gym.reason}
        </div>
      )}

      <div className="note">
        <b>{LEFT_FIRST_RULE}</b>
      </div>

      {p.notes.map((n, i) => <div key={i} className="note neutral">{n}</div>)}

      {p.plyo.length > 0 && (
        <div className="card">
          <h2>Plyometrics — first, before any fatigue</h2>
          <p className="desc">Rung {rung.rung} of 4. {rung.reason}</p>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            {p.plyo.map((x) => <li key={x} style={{ marginBottom: 5 }}>{x}</li>)}
          </ul>
        </div>
      )}

      <form action={logGymSessionAction}>
        <input type="hidden" name="day" value={day} />
        <input type="hidden" name="gym_day" value={gymDay.key} />
        <input type="hidden" name="title" value={p.replaces ? p.replaces.title : gymDay.title} />
        <input type="hidden" name="n" value={list.length} />

        {list.map((e, i) => {
          const last = lastOf(e.name);
          return (
            <div className="card" key={e.name} style={{ paddingBottom: 14 }}>
              <input type="hidden" name={`ex${i}`} value={e.name} />

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                <h2 style={{ fontSize: 15.5 }}>{e.name}</h2>
                {e.left && <span className="chip key">Left first</span>}
                <span className="mono xs" style={{ marginLeft: 'auto' }}>{e.sets}</span>
              </div>

              <p className="xs" style={{ margin: '4px 0 12px' }}>
                {last
                  ? `Last time: ${last.load_kg ?? '—'} kg × ${last.reps ?? '—'}${last.sets ? ` × ${last.sets} sets` : ''}`
                  : e.start
                    ? `Start at ${e.start}.`
                    : 'First time logging this one.'}
                {last && e.progress ? ` · ${e.progress}` : ''}
              </p>

              <div className="grid3">
                <label className="f">
                  <span className="lab">Load kg</span>
                  <input
                    type="number" step="any" inputMode="decimal" name={`load${i}`}
                    defaultValue={last?.load_kg ?? ''}
                    placeholder={last?.load_kg ? String(last.load_kg) : ''}
                  />
                </label>
                <label className="f">
                  <span className="lab">Reps</span>
                  <input type="number" inputMode="numeric" name={`reps${i}`} defaultValue={last?.reps ?? ''} />
                </label>
                <label className="f">
                  <span className="lab">Sets</span>
                  <input type="number" inputMode="numeric" name={`sets${i}`} defaultValue={last?.sets ?? ''} />
                </label>
              </div>

              {e.left && (
                <input type="hidden" name={`side${i}`} value="left" />
              )}

              <details>
                <summary className="lab" style={{ cursor: 'pointer' }}>Why this one, and a note</summary>
                <p className="small" style={{ margin: '10px 0 8px' }}>{e.note}</p>
                {e.compound && (
                  <p className="xs" style={{ marginBottom: 8 }}>Block prescription: {p.compounds}.</p>
                )}
                <label className="f" style={{ marginBottom: 0 }}>
                  <span className="lab">Note</span>
                  <input type="text" name={`note${i}`} placeholder="Felt heavy, left side lagging…" />
                </label>
              </details>
            </div>
          );
        })}

        <div className="card">
          <h2>The session</h2>
          <div className="grid2">
            <label className="f">
              <span className="lab">Minutes</span>
              <input type="number" inputMode="numeric" name="duration_min" defaultValue={gymDay.minutes} />
            </label>
            <label className="f">
              <span className="lab">RPE 1–10</span>
              <input type="number" inputMode="numeric" name="rpe" min={1} max={10} />
            </label>
          </div>
          <label className="f">
            <span className="lab">How it went</span>
            <textarea name="notes" placeholder="Anything worth remembering in three weeks." />
          </label>
          <label className="f" style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 0 }}>
            <input type="checkbox" name="abandoned" />
            <span className="small">Cut it short</span>
          </label>
        </div>

        <Submit className="wide" busyLabel="Saving the session…">Save the session</Submit>
        <p className="xs center" style={{ marginTop: 12 }}>
          Leave a row blank and it is not recorded. Five of seven logs five lifts, not five lifts and two zeroes.
        </p>
      </form>

      <div className="card" style={{ marginTop: 14 }}>
        <h2>How the load moves</h2>
        <p className="small" style={{ marginBottom: 0 }}>{PROGRESSION_RULE}</p>
      </div>

      <Nav active="/gym" />
    </div>
  );
}
