import { useCallback, useEffect, useState } from "react";

export function useResource<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const key = JSON.stringify(deps);
  const [result, setResult] = useState<{ key: string; value: T } | null>(null);
  const [status, setStatus] = useState<{ key: string; loading: boolean; error: string | null }>({
    key,
    loading: true,
    error: null,
  });
  const data = result?.key === key ? result.value : null;
  const loading = status.key !== key || status.loading;
  const error = status.key === key ? status.error : null;
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  const setData = useCallback(
    (updater: T | null | ((previous: T | null) => T | null)) => {
      setResult((previous) => {
        const current = previous?.key === key ? previous.value : null;
        const next =
          typeof updater === "function" ? (updater as (value: T | null) => T | null)(current) : updater;
        return next === null ? null : { key, value: next };
      });
    },
    [key],
  );
  useEffect(() => {
    let live = true;
    setStatus({ key, loading: true, error: null });
    load()
      .then((value) => {
        if (live) {
          setResult({ key, value });
          setStatus({ key, loading: false, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (live)
          setStatus({
            key,
            loading: false,
            error: reason instanceof Error ? reason.message : "Có lỗi xảy ra",
          });
      });
    return () => {
      live = false;
    };
    // Resource identity is supplied through deps by each caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, revision, key]);
  return { data, loading, error, reload, setData };
}
