import {NavigationEnd, NavigationStart} from "@angular/router";
import {SessionManager} from "./session-manager.service";
import {DISPATCH} from "./util";

export function routeHandler(event: any){
    if (event instanceof NavigationStart) {
      SessionManager.instance.newSession(event.url);
    }
    if (event instanceof NavigationEnd) {
      delete SessionManager.instance.getCurrentSession().loading;
    }
}

export function windowUnloadHandler(event:any) {
  if(!SessionManager.instance.getCurrentSession().loading){
    SessionManager.instance.newSession();
  }
  window.dispatchEvent(new CustomEvent( DISPATCH, { detail : { force: true }}));
}

