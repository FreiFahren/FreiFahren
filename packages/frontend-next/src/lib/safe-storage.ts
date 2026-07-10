export type SafeStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => boolean;
  removeItem: (key: string) => boolean;
};

function createSafeStorage(resolve: () => Storage): SafeStorage {
  return {
    getItem(key) {
      try {
        return resolve().getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        resolve().setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    removeItem(key) {
      try {
        resolve().removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export const safeLocalStorage = createSafeStorage(() => localStorage);
export const safeSessionStorage = createSafeStorage(() => sessionStorage);
