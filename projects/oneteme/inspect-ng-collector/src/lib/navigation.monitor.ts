import { NavigationCancel, NavigationEnd, NavigationStart, Router } from "@angular/router";
import { SessionManager } from "./session-manager.service";
import { dispatchReload, dispatchReport, dispatchShutown } from "./event-bus";

export function initNavigationMonitor(router: Router){
  try{
    initStartupSession();
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
    setTimeout(()=>SessionManager.instance.updateSession(),0)
  }
}

function windowUnloadHandler(event: any) {
  SessionManager.instance.navigate();
  dispatchShutown();
}

function initStartupSession() {
  SessionManager.instance.navigate(new URL(document.URL).host);
  SessionManager.instance.updateSession(false);
}

function bfCacheHandler(event: any) {
  if (event.persisted) { // if the page was restored from bfcache
    dispatchReload();
    SessionManager.instance.navigate(document.URL);
    setTimeout(() => SessionManager.instance.updateSession(), 0);
  }
}
