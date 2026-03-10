import {useCallback, useState} from 'react';
import type {ApiLogEntry} from '@/types/editor';

export function useApiLog() {
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);

  const pushLog = useCallback((entry: Omit<ApiLogEntry, 'id' | 'timestamp'>) => {
    const enriched: ApiLogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    setLogs((current) => [enriched, ...current].slice(0, 80));
  }, []);

  return {logs, pushLog};
}
