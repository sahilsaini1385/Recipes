/**
 * What to show when a read failed.
 *
 * This exists because three pages did not distinguish "the data isn't there"
 * from "we couldn't fetch it", and said the former. A recipe page told anyone
 * on a patchy connection "Recipe not found" about a recipe that was sitting
 * safely in the database — which, in an archive whose first principle is
 * never to lose anything, is the worst available lie.
 */
export function LoadError({
  what,
  error,
  onRetry,
}: {
  /** What could not be loaded, lower case: "this recipe", "the recipes". */
  what: string;
  error: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-red-200 bg-red-50/60 px-6 py-8 text-center">
      <p className="font-serif text-lg text-red-900">
        Couldn't load {what}.
      </p>
      {/* Worded so it reads for one recipe or for all of them, and so the
          first thing anyone learns is that nothing has been lost. */}
      <p className="mt-1 text-sm text-red-800/80">
        Nothing has been lost — the app just couldn't reach the server.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-50"
        >
          Try again
        </button>
      )}
      <p className="mt-3 text-xs text-red-800/60">{error}</p>
    </div>
  );
}
