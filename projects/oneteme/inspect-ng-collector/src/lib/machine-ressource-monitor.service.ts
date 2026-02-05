import { MachineRessourceUsage } from "./trace.model";
import { dateNow, emitTrace, emitReport } from "./util";

export function supportResourceUsage() {
  return 'memory' in performance;
}

export function ressourceUsageHandler() {
  try {
    const memory = (performance as any).memory;
    emitTrace({
      '@type': '01',
      instant: dateNow(),
      usedHeap: memory.usedJSHeapSize / (1024 * 1024),
      commitedHeap: memory.totalJSHeapSize / (1024 * 1024),
    } as MachineRessourceUsage);
  } catch (e) {
    emitReport("ressourceUsageHandler", e);
  }
}