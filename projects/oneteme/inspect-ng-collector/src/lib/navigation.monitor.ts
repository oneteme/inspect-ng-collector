import { NavigationCancel, NavigationEnd, NavigationStart, Router } from "@angular/router";
import { Subscription } from "rxjs";
import { SessionManager } from "./session-manager.service";
import { dispatchReload, dispatchReport, dispatchShutown } from "./event-bus";

let monitoredRouter: Router | undefined;
let routerSubscription: Subscription | undefined;

export function initNavigationMonitor(router: Router){
  if (monitoredRouter === router && !routerSubscription?.closed) return;
  try{
    routerSubscription?.unsubscribe();
    initStartupSession();
    routerSubscription = router.events.subscribe(routeHandler);
    monitoredRouter = router;
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
    SessionManager.instance.validateSession( true, 0);
  }
}

function windowUnloadHandler() {
  if (SessionManager.instance.hasValidateSessionBeenCalled())
  SessionManager.instance.navigate();
  dispatchShutown();
}

function initStartupSession() {
  SessionManager.instance.navigate(new URL(document.URL).origin);
  SessionManager.instance.validateSession(false);
}

function bfCacheHandler(event: any) {
  if (event.persisted) { // if the page was restored from bfcache
    dispatchReload();
    SessionManager.instance.navigate(document.URL);
    SessionManager.instance.validateSession( true, 0);
  }
}
