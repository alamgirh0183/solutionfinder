const STORAGE_KEY = "solutionfinder.recent-problems";
const RECENT_SEARCHES_EVENT = "solutionfinder:recent-searches";
const MAX_RECENT_SEARCHES = 8;

function notifyRecentProblems(storageError: boolean) {
  window.dispatchEvent(
    new CustomEvent(RECENT_SEARCHES_EVENT, { detail: storageError })
  );
}

export function readRecentProblems(): string[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter(
          (problem): problem is string =>
            typeof problem === "string" && problem.trim().length > 0
        ).slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch (error) {
    console.error(
      "Unable to load browser-only recent searches:",
      error instanceof Error ? error.message : "Local storage is unavailable."
    );
    return [];
  }
}

function writeRecentProblems(problems: string[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(problems));
    notifyRecentProblems(false);
    return true;
  } catch (error) {
    console.error(
      "Unable to update browser-only recent searches:",
      error instanceof Error ? error.message : "Local storage is unavailable."
    );
    notifyRecentProblems(true);
    return false;
  }
}

export function recordRecentProblem(problem: string): boolean {
  const normalized = problem.trim();
  if (!normalized) return false;
  const recent = readRecentProblems().filter((item) => item !== normalized);
  return writeRecentProblems([normalized, ...recent].slice(0, MAX_RECENT_SEARCHES));
}

export function removeRecentProblem(problem: string): boolean {
  return writeRecentProblems(
    readRecentProblems().filter((item) => item !== problem)
  );
}

export function clearRecentProblems(): boolean {
  return writeRecentProblems([]);
}

export function subscribeToRecentProblems(onChange: (storageError: boolean) => void) {
  const handleChange = (event: Event) => {
    if (event instanceof CustomEvent && event.type === RECENT_SEARCHES_EVENT) {
      onChange(event.detail === true);
      return;
    }
    onChange(false);
  };
  window.addEventListener(RECENT_SEARCHES_EVENT, handleChange);
  window.addEventListener("storage", handleChange);
  return () => {
    window.removeEventListener(RECENT_SEARCHES_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}
