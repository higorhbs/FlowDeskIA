type FbqFn = (...args: unknown[]) => void;

interface Window {
  fbq?: FbqFn;
  _fbq?: FbqFn;
}
