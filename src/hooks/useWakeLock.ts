import { useEffect, useRef } from "react";

/**
 * Keep the screen awake while active (cook mode). Re-acquires the lock when
 * the tab becomes visible again, since the browser releases it on blur.
 */
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;

    let cancelled = false;

    const acquire = async () => {
      // Drop any previous sentinel first: switching tabs repeatedly would
      // otherwise leak one lock per switch.
      const previous = lockRef.current;
      lockRef.current = null;
      await previous?.release().catch(() => {});
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        // Cook mode may have exited while the request was in flight; the
        // cleanup below has already run, so release it here instead of
        // storing a sentinel nobody will ever let go of.
        if (cancelled) await sentinel.release().catch(() => {});
        else lockRef.current = sentinel;
      } catch {
        // Wake lock can fail on low battery or unsupported contexts — the
        // cook mode UI still works, the phone just may sleep.
      }
    };

    const onVisibility = () => {
      if (!cancelled && document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
