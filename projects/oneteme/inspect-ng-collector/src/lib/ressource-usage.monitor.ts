import { MachineRessourceUsage } from "./trace.model";
import { dateNow, dispatchTraces, dispatchReport, addExportListener } from "./util";

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
      '@type': '01',
      instant: dateNow(),
      usedHeap: memory.usedJSHeapSize / (1024 * 1024),
      commitedHeap: memory.totalJSHeapSize / (1024 * 1024),
    } as MachineRessourceUsage);
  } catch (e) {
    dispatchReport('ressourceUsageHandler', e);
  }
}