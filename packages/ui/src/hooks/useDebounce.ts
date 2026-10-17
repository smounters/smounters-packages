import { useEffect, useState } from "react";

/** Значение с задержкой — для поиска: запрос уходит после паузы в наборе, а не на каждую букву. */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
