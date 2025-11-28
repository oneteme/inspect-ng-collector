import {MachineRessourceUsage} from "./trace.model";
import {createReport, dateNow, DISPATCH} from "./util";

  export function machineRessourceUsageHandler(event: Event){
    window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  { traces : getMemoryInfo() } }));
  }

  function getMemoryInfo():MachineRessourceUsage | null {
    try{
      const memory = (performance as any).memory;
      return {
        '@type': '01',
        instant: dateNow(),
        usedHeap: memory.usedJSHeapSize / (1024 * 1024),
        commitedHeap: memory.totalJSHeapSize / (1024 * 1024),
      };
    }catch(e){
      createReport(JSON.stringify(e));
    }
    return null;
  }





