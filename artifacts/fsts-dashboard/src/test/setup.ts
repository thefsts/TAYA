import "@testing-library/jest-dom";

// Polyfills for Radix UI / browser APIs that jsdom doesn't provide
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// ResizeObserver stub
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// IntersectionObserver stub
global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof IntersectionObserver;

// Silence Radix UI pointer-events warnings in jsdom
Object.defineProperty(window, "PointerEvent", {
  writable: true,
  value: class PointerEvent extends MouseEvent {},
});
