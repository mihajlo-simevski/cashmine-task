// Browser storage that never throws. Private browsing, blocked site data or a full
// quota make localStorage throw; callers get null/false instead.

function local(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export const storage = {
  get(key: string): string | null {
    try {
      return local()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  /** Returns false when the value could not be stored. */
  set(key: string, value: string): boolean {
    try {
      const store = local();
      if (!store) return false;
      store.setItem(key, value);
      return store.getItem(key) === value;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    try {
      local()?.removeItem(key);
    } catch {
      // Nothing to do: the value is unreachable anyway.
    }
  },
};
