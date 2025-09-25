import {inject} from "@angular/core";
import {Router} from "@angular/router";
import {routeHandler, windowUnloadHandler} from "./handlers";
import {BEFOREUNLOAD, PRE_DISPATCH} from "./util";
import {MachineRessourceUsageHandler} from "./machine-ressource-monitor.service";

export function routerEventsListener (){
  inject(Router).events.subscribe(routeHandler);
}

export function beforeUnloadListener(){
  window.addEventListener(BEFOREUNLOAD, windowUnloadHandler);
}

export function beforeDispatchListener(){
  window.addEventListener(PRE_DISPATCH, MachineRessourceUsageHandler);
}
