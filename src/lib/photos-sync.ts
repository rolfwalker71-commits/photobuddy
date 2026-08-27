const EVENT = "photobuddy:photos-changed";
const DIRTY_KEY = "photobuddy.photos-dirty";

type Listener = () => void;

const listeners = new Set<Listener>();
let generation = 0;

export function getPhotosGeneration() {
  return generation;
}

export function notifyPhotosChanged() {
  generation += 1;
  try {
    sessionStorage.setItem(DIRTY_KEY, String(generation));
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
  for (const listener of listeners) listener();
}

export function consumePhotosDirty() {
  try {
    const raw = sessionStorage.getItem(DIRTY_KEY);
    if (!raw) return false;
    sessionStorage.removeItem(DIRTY_KEY);
    return true;
  } catch {
    return false;
  }
}

export function subscribePhotosChanged(listener: Listener) {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener(EVENT, listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener(EVENT, listener);
    }
  };
}
