import {NavigationCancel, NavigationEnd, NavigationStart} from "@angular/router";
import {SessionManager} from "./session-manager.service";
import {initContextManagerAndDispatcher, } from "./ng-collector.module";

export function routeHandler(event: any){
    if (event instanceof NavigationStart) {
      SessionManager.instance.navigate(event.url);
    }
    if (event instanceof NavigationEnd ||  event instanceof NavigationCancel) {
        setTimeout(() => SessionManager.instance.updateSession(), 0);
    }
}

export function windowUnloadHandler(event:any) {
  SessionManager.instance.navigate();
}

export function bfCacheHandler(event:any)  {
  if (event.persisted) { // if the page was restored from bfcache
    initContextManagerAndDispatcher();
    SessionManager.instance.navigate(document.URL);
    setTimeout(() => SessionManager.instance.updateSession(), 0);
  }
}
