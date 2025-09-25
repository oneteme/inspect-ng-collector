import {MachineRessourceUsage} from "./trace.model";
import {createReport, dateNow, DISPATCH} from "./util";

  export function MachineRessourceUsageHandler(event: Event){
    window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  { traces : getMemoryInfo() } }));
  }

  function getMemoryInfo():MachineRessourceUsage | null {
    try{
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        return {
          '@type': 'rsrc-usg',
          instant: dateNow(),
          usedHeap: memory.usedJSHeapSize / (1024 * 1024),
          commitedHeap: memory.totalJSHeapSize / (1024 * 1024),
        };
      }
    }catch(e){
      console.warn(e)
      createReport(String(e))
    }
    return null;
  }





