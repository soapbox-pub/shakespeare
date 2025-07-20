import { useFS as useInternalFS } from '@/contexts/FSContext';

export function useFS() {
  return useInternalFS();
}