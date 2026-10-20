import "@/i18n";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

// The native Jest environment has no localStorage. A small in-memory one, exposed as
// `Storage` too so tests can make it throw with jest.spyOn(Storage.prototype, ...).
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
}
Object.assign(globalThis, { Storage: MemoryStorage, localStorage: new MemoryStorage() });
