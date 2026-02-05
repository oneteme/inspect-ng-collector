import { Router } from "@angular/router";
import { bfCacheHandler, routeHandler, windowUnloadHandler } from "./handlers";
import { BEFOREUNLOAD, PRE_DISPATCH } from "./util";
import { ressourceUsageHandler as ressourceUsageHandler, supportResourceUsage } from "./machine-ressource-monitor.service";
import { ContextManager } from "./context-manager";

export function routerEventsListener(router: Router) {
  router.events.subscribe(routeHandler);
}

export function beforeUnloadListener() {
  window.addEventListener(BEFOREUNLOAD, windowUnloadHandler);
}

export function beforeDispatchListener() {
  if (ContextManager.instance.techConfig.resources && supportResourceUsage()) {
    window.addEventListener(PRE_DISPATCH, ressourceUsageHandler);
  }
}

export function bfCacheListener() {
  window.addEventListener('pageshow', bfCacheHandler);
}
