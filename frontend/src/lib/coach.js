import { exOr } from './exercises.js'

const setForCoach = s => {
  const out = { done: !!s.done }
  if (s.w != null) out.weight = s.w
  if (s.r != null) out.reps = s.r
  if (s.sec != null) out.seconds = s.sec
  if (s.min != null) out.minutes = s.min
  if (s.speed != null) out.speedKmh = s.speed
  if (s.rir != null) out.rir = s.rir
  if (s.rpe != null) out.rpe = s.rpe
  return out
}

const exerciseForCoach = cfg => {
  const ex = exOr(cfg.id)
  return {
    id: cfg.id,
    name: ex.n,
    bodyPart: ex.bp || null,
    targetMuscle: ex.tg || null,
    equipment: ex.eq || null,
    sets: cfg.sets || null,
    reps: cfg.reps || null,
    repsMin: cfg.repsMin || null,
    repsMax: cfg.repsMax || null,
    seconds: cfg.sec || null,
    weight: cfg.weight || 0,
    mode: cfg.mode || null,
    progression: cfg.prog || null,
    perSide: !!cfg.side,
    bodyweight: !!cfg.bodyweight
  }
}

const workoutForCoach = w => ({
  date: w.d,
  name: w.name,
  durationMin: w.start && w.end ? Math.round((w.end - w.start) / 60000) : null,
  bodyweight: w.bw ?? null,
  exercises: (w.entries || []).map(e => ({
    id: e.id,
    name: exOr(e.id).n,
    target: e.target ? exerciseForCoach({ ...e.target, id: e.id }) : null,
    topWeight: e.topW || null,
    sets: (e.sets || []).filter(s => s.done).map(setForCoach)
  }))
})

export function buildCoachContext(S) {
  const routines = (S.routines || []).map(r => ({
    id: r.id,
    name: r.name,
    progression: r.prog || null,
    exercises: (r.ex || []).map(exerciseForCoach)
  }))

  const active = S.active ? {
    date: S.active.d,
    name: S.active.name,
    startedAt: S.active.start,
    exercises: (S.active.entries || []).map(e => ({
      id: e.id,
      name: exOr(e.id).n,
      target: e.target ? exerciseForCoach({ ...e.target, id: e.id }) : null,
      suggestedProgression: e.plan || null,
      sets: (e.sets || []).map(setForCoach)
    }))
  } : null

  return {
    unit: S.unit || 'kg',
    targetBodyweight: S.targetW ?? null,
    currentBodyweight: S.bodyweight?.length ? S.bodyweight[S.bodyweight.length - 1].w : null,
    bodyweightHistory: (S.bodyweight || []).slice(-20),
    weeklySchedule: S.week || {},
    dayOverrides: Object.fromEntries(Object.entries(S.dayPlan || {}).slice(-20)),
    routines,
    recentWorkouts: (S.workouts || []).slice(-12).map(workoutForCoach),
    activeWorkout: active,
    effortScale: S.effort || (S.showRir ? 'rir' : 'none')
  }
}
