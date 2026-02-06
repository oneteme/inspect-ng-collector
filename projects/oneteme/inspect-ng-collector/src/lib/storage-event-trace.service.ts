import { ContextManager } from "./context-manager";
import { dispatchReport } from "./util";

export function storageEventListener() {
  try {
    if (ContextManager.instance.techConfig.storage) {
      addEventListener("storage", (event) => {
        let storageType = event.storageArea == window.localStorage ? 'localStorage'
          : event.storageArea == window.sessionStorage ? 'sessionStorage'
            : null;
      })
    }
  } catch (e) {
    dispatchReport("storageEventListener", e);
  }
}
function subscribeToStorageEventPrototype() {
  const originalSetItem = Storage.prototype.setItem;
  const originalGetItem = Storage.prototype.getItem;

  Storage.prototype.setItem = function (key: string, value: string) {
    let storageType = this === window.localStorage ? 'localStorage'
      : this === window.sessionStorage ? 'sessionStorage'
        : null;
    window.dispatchEvent(new CustomEvent('storage-set', { detail: { storage: this, key, storageType } }));
    // @ts-ignore
    return originalSetItem.apply(this, arguments);
  };

  Storage.prototype.getItem = function (key: string) {
    let storageType = this === window.localStorage ? 'localStorage'
      : this === window.sessionStorage ? 'sessionStorage'
        : null;
    window.dispatchEvent(new CustomEvent('storage-get', { detail: { storage: this, key, storageType } }));
    // @ts-ignore
    return originalGetItem.apply(this, arguments);
  };

  window.addEventListener('storage-set', (event: any) => {

  });

  window.addEventListener('storage-get', (event: any) => {

  });

}

