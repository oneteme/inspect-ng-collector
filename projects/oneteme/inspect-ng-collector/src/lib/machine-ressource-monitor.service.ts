import { Injectable } from '@angular/core';
import {MachineRessourceUsage} from "./trace.model";
import {dateNow} from "./util";

@Injectable({ providedIn: 'root' })
export class MachineRessourceMonitorService {
  constructor() {}


  getMemoryInfo():MachineRessourceUsage | null {
    try{
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        return {
          '@type': 'rsrc-usg',
          instant: dateNow(),
          usedHeap: memory.usedJSHeapSize,
          commitedHeap: memory.totalJSHeapSize,
        };
      }
    }catch(e){
      console.warn(e)
      // todo report error somehow
    }
    return null;
  }



}

