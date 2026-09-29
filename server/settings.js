// What the host can change with ⚙️ in the lobby, before JOUER. The defaults
// are how the game played before settings existed. The phone has a copy of
// these limits (SETTINGS_LIMITS in client/src/main.js) - this one is enforced.
export const SETTINGS_LIMITS = {
  imposterCount: { min: 1, max: 3, step: 1, default: 1 },
  tasksPerPlayer: { min: 1, max: 9, step: 1, default: 6 }, // 9 = every task in the pool
  alertSeconds: { min: 20, max: 120, step: 10, default: 60 },
  interferenceSeconds: { min: 5, max: 60, step: 5, default: 10 },
};

export function defaultSettings() {
  return Object.fromEntries(Object.entries(SETTINGS_LIMITS).map(([key, limit]) => [key, limit.default]));
}

// Only known settings, each a whole number of steps within its range;
// anything missing or unusable keeps its current value.
export function cleanSettings(requested, current) {
  const cleaned = { ...current };
  Object.entries(SETTINGS_LIMITS).forEach(([key, { min, max, step }]) => {
    const value = Number(requested?.[key]);
    if (!Number.isFinite(value)) return;
    const stepped = min + Math.round((value - min) / step) * step;
    cleaned[key] = Math.min(max, Math.max(min, stepped));
  });
  return cleaned;
}
