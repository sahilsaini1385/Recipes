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
      try {
        lockRef.current = await navigator.wakeLock.request("screen");
      } catch {
        // Wake lock can fail on low battery or unsupported contexts — the
        // cook mode UI still works, the phone just may sleep.
      }
    };

    const onVisibility = () => {
      if (!cancelled && document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
