import {NavigationCancel, NavigationEnd, NavigationStart} from "@angular/router";
import {SessionManager} from "./session-manager.service";;

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
