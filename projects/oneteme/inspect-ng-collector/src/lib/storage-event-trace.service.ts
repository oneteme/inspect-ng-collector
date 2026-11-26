
import { dispatchReport } from "./event-bus";
import {TechnicalConf} from "./configuration";

let storagePrototypeSubscribed = false;

export function storageEventListener(tech: TechnicalConf) {
  if (!tech.storage || storagePrototypeSubscribed) {
    return;
  }
  try {
    subscribeToStorageEventPrototype();
    storagePrototypeSubscribed = true;
  } catch (e) {
    dispatchReport("Unable to process a storage event for trace synchronization.", "storage-event-trace.storageEventListener", e);
  }
}

function subscribeToStorageEventPrototype() {
  const originalSetItem = Storage.prototype.setItem;
  const originalGetItem = Storage.prototype.getItem;

  Storage.prototype.setItem = function (key: string, value: string) {
    const storageType = getStorageType(this);
    window.dispatchEvent(new CustomEvent('storage-set', { detail: { storage: this, key, storageType } }));
    // @ts-ignore
    return originalSetItem.apply(this, arguments);
  };

  Storage.prototype.getItem = function (key: string) {
    const storageType = getStorageType(this);
    window.dispatchEvent(new CustomEvent('storage-get', { detail: { storage: this, key, storageType } }));
    // @ts-ignore
    return originalGetItem.apply(this, arguments);
  };
}

function getStorageType(storage: Storage): 'localStorage' | 'sessionStorage' | null {
  if (storage === window.localStorage) {
    return 'localStorage';
  }
  if (storage === window.sessionStorage) {
    return 'sessionStorage';
  }
  return null;
}
