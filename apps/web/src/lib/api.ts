'use client';
import { useCallback, useEffect, useState } from 'react';
import { tr } from '../locales/tr';
export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/v1/' + path, {
      method,
      credentials: 'include',
      headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new Error(tr.networkError);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error?.message || tr.error);
  return result;
}
export function useData<T = any>(path: string | null) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload };
}
