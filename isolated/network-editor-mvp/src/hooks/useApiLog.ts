import {useCallback, useState} from 'react';
import type {ApiLogEntry} from '@/types/editor';
import {makeUuidLike} from '@/utils/id';

export function useApiLog() {
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);

  const pushLog = useCallback((entry: Omit<ApiLogEntry, 'id' | 'timestamp'>) => {
    const enriched: ApiLogEntry = {
      ...entry,
      id: makeUuidLike(),
      timestamp: new Date().toISOString(),
    };

    setLogs((current) => [enriched, ...current].slice(0, 80));
  }, []);

  return {logs, pushLog};
}
