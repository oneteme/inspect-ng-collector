import { NavigationCancel, NavigationEnd, NavigationStart, Router } from "@angular/router";
import { SessionManager } from "./session-manager.service";
import { initContextManagerAndDispatcher } from "./ng-collector.module"; //TODO cycle dependency
import { dispatchReport, dispatchShutown } from "./util";

export function initNavigationMonitor(router: Router){
  try{
    router.events.subscribe(routeHandler);
    window.addEventListener('pageshow', bfCacheHandler);
    window.addEventListener("beforeunload", windowUnloadHandler);
  }
  catch(e){
    dispatchReport('initNavigationMonitor', e)
  }
}

function routeHandler(event: any) {
  if (event instanceof NavigationStart) {
    SessionManager.instance.navigate(event.url);
  }
  if (event instanceof NavigationEnd || event instanceof NavigationCancel) {
    setTimeout(() => SessionManager.instance.updateSession(), 0);
  }
}

function windowUnloadHandler(event: any) {
  SessionManager.instance.navigate();
  dispatchShutown();
}

function bfCacheHandler(event: any) {
  if (event.persisted) { // if the page was restored from bfcache
    initContextManagerAndDispatcher(); //check context before
    SessionManager.instance.navigate(document.URL);
    setTimeout(() => SessionManager.instance.updateSession(), 0);
  }
}
