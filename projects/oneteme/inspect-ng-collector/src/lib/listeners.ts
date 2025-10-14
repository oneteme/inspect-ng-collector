import {Router} from "@angular/router";
import {routeHandler, windowUnloadHandler} from "./handlers";
import {BEFOREUNLOAD, PRE_DISPATCH} from "./util";
import {machineRessourceUsageHandler} from "./machine-ressource-monitor.service";
import {ContextManager} from "./context-manager";

export function routerEventsListener (router: Router){
  router.events.subscribe(routeHandler);
}

export function beforeUnloadListener(){
  window.addEventListener(BEFOREUNLOAD, windowUnloadHandler);
}

export function beforeDispatchListener(){
  if (ContextManager.instance.techConfig.resources && 'memory' in performance) {
    window.addEventListener(PRE_DISPATCH, machineRessourceUsageHandler);
  }
}
