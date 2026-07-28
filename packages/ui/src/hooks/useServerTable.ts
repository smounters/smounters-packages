import { useCallback, useEffect, useMemo, useState } from "react";

export interface ServerTableQuery {
  limit: number;
  offset: number;
  sortField: string;
  sortDesc: boolean;
}

/**
 * Пагинация и сортировка на стороне сервера для DataTable. `query` уходит в list-RPC как есть,
 * `onServerSort` отдаётся таблице с `manualSorting`. Смена фильтра на странице → передать её
 * сигнатуру в `resetKey`, иначе останемся на странице, которой в новой выборке нет.
 */
export function useServerTable(initialLimit = 25, resetKey?: unknown) {
  const [offset, setOffset] = useState(0);
  const [limit, setLimitState] = useState(initialLimit);
  const [sort, setSort] = useState<{ id: string; desc: boolean } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey и ЕСТЬ зависимость
  useEffect(() => {
    setOffset(0);
  }, [resetKey]);

  const query = useMemo<ServerTableQuery>(
    () => ({ limit, offset, sortField: sort?.id ?? "", sortDesc: sort?.desc ?? false }),
    [limit, offset, sort],
  );

  // Новая сортировка и новый размер страницы возвращают на первую: старый offset считался по другому
  // порядку/размеру и указывает в никуда.
  const onServerSort = useCallback((s: { id: string; desc: boolean } | null) => {
    setSort(s);
    setOffset(0);
  }, []);

  const setLimit = useCallback((n: number) => {
    setLimitState(n);
    setOffset(0);
  }, []);

  const resetPage = useCallback(() => setOffset(0), []);

  return { query, offset, limit, setOffset, setLimit, onServerSort, resetPage };
}
