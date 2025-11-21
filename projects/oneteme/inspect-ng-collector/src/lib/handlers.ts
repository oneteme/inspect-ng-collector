import {NavigationCancel, NavigationEnd, NavigationStart} from "@angular/router";
import {SessionManager} from "./session-manager.service";
import {ContextManager} from "./context-manager";
import {NgCollectorModule} from "./ng-collector.module";

export function routeHandler(event: any){
    if (event instanceof NavigationStart) {
      SessionManager.instance.navigate(event.url);
    }
    if (event instanceof NavigationEnd ||  event instanceof NavigationCancel) {
        SessionManager.instance.updateSession();
    }
}

export function windowUnloadHandler(event:any) {
  SessionManager.instance.navigate();
}

export function bfCacheHandler(event:any)  {
  if (event.persisted) { // if the page was restored from bfcache
    ContextManager.init(NgCollectorModule.configuration);
    SessionManager.instance.navigate(document.URL);
    SessionManager.instance.updateSession();
  }
}
