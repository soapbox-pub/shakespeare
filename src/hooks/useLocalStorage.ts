import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Generic hook for managing localStorage state using React Query
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  serializer?: {
    serialize: (value: T) => string;
    deserialize: (value: string) => T;
  }
): readonly [T, (value: T | ((prev: T) => T)) => void] {
  const serialize = serializer?.serialize || JSON.stringify;
  const deserialize = serializer?.deserialize || JSON.parse;
  
  const queryClient = useQueryClient();

  const queryFn = () => {
    try {
      const item = localStorage.getItem(key);
      return item ? deserialize(item) : defaultValue;
    } catch (error) {
      console.warn(`Failed to load ${key} from localStorage:`, error);
      return defaultValue;
    }
  };

  const { data: state } = useQuery({
    queryKey: ['localStorage', key],
    queryFn,
    initialData: queryFn,
    staleTime: Infinity, // localStorage data doesn't become stale
    gcTime: Infinity, // Keep in cache indefinitely
  });

  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      const currentValue = state ?? defaultValue;
      const valueToStore = value instanceof Function ? value(currentValue) : value;
      localStorage.setItem(key, serialize(valueToStore));
      queryClient.setQueryData(['localStorage', key], valueToStore);
    } catch (error) {
      console.warn(`Failed to save ${key} to localStorage:`, error);
    }
  };

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = deserialize(e.newValue);
          queryClient.setQueryData(['localStorage', key], newValue);
        } catch (error) {
          console.warn(`Failed to sync ${key} from localStorage:`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, deserialize, queryClient]);

  return [state, setValue] as const;
}