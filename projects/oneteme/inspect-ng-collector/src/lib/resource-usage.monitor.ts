import { dateNow, MachineRessourceUsage, TRACE_TYPE_RESOURCE_USAGE } from "./trace.model";
import { dispatchTraces, dispatchReport, addExportListener } from "./event-bus";

export function initResourceUsageMonitor(){
  try{
    if ('memory' in performance) {
      addExportListener(ressourceUsageHandler);
    }
  }
  catch(e){
    dispatchReport('initResourceUsageMonitor', e)
  }
}

function ressourceUsageHandler() {
  try {
    const memory = (performance as any).memory;
    dispatchTraces({
      '@type': TRACE_TYPE_RESOURCE_USAGE,
      instant: dateNow(),
      usedHeap: memory.usedJSHeapSize / (1024 * 1024),
      commitedHeap: memory.totalJSHeapSize / (1024 * 1024),
    } as MachineRessourceUsage);
  } catch (e) {
    dispatchReport('ressourceUsageHandler', e);
  }
}
