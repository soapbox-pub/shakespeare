import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock localStorage for Node.js 25 compatibility
// Node.js 25 provides a localStorage object but it's incomplete without --localstorage-file
// We override it with a proper mock that implements the full Storage interface
class LocalStorageMock implements Storage {
  private store: Map<string, string> = new Map();

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

global.localStorage = new LocalStorageMock();

// Mock CSS imports
vi.mock('*.css', () => ({}));
vi.mock('*.scss', () => ({}));
vi.mock('*.sass', () => ({}));

// Mock KaTeX CSS specifically
vi.mock('katex/dist/katex.min.css', () => ({}));

// Mock Streamdown component that might be importing KaTeX
vi.mock('streamdown', () => ({
  Streamdown: ({ children }: { children: React.ReactNode }) => children
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: vi.fn(),
});

// Mock Element.scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation((_callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation((_callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock indexedDB for LightningFS
const mockIDBRequest = {
  result: null,
  error: null,
  onsuccess: null,
  onerror: null,
  readyState: 'done',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
};

const mockIDBDatabase = {
  name: 'test-db',
  version: 1,
  objectStoreNames: [],
  close: vi.fn(),
  createObjectStore: vi.fn(),
  deleteObjectStore: vi.fn(),
  transaction: vi.fn().mockReturnValue({
    objectStore: vi.fn().mockReturnValue({
      add: vi.fn().mockReturnValue(mockIDBRequest),
      put: vi.fn().mockReturnValue(mockIDBRequest),
      get: vi.fn().mockReturnValue(mockIDBRequest),
      delete: vi.fn().mockReturnValue(mockIDBRequest),
      clear: vi.fn().mockReturnValue(mockIDBRequest),
      count: vi.fn().mockReturnValue(mockIDBRequest),
      getAll: vi.fn().mockReturnValue(mockIDBRequest),
      getAllKeys: vi.fn().mockReturnValue(mockIDBRequest),
      index: vi.fn(),
      createIndex: vi.fn(),
      deleteIndex: vi.fn(),
    }),
    abort: vi.fn(),
    commit: vi.fn(),
    error: null,
    mode: 'readwrite',
    objectStoreNames: [],
    oncomplete: null,
    onerror: null,
    onabort: null,
  }),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
};

global.indexedDB = {
  open: vi.fn().mockReturnValue({
    ...mockIDBRequest,
    result: mockIDBDatabase,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    onblocked: null,
  }),
  deleteDatabase: vi.fn().mockReturnValue(mockIDBRequest),
  databases: vi.fn().mockResolvedValue([]),
  cmp: vi.fn(),
};