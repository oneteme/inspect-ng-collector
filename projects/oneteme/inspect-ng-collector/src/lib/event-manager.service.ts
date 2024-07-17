import {  Injectable} from "@angular/core";
import { NavigationEnd, NavigationStart, Router } from "@angular/router";
import { logInspect} from "./util";
import { SessionManager } from "./session-manager.service";


@Injectable({ providedIn: 'root' }) 
export class EventManagerService  {

    constructor(private router: Router,
                private sessionManager: SessionManager) {
        logInspect('initialize EventManagerService');
        window.addEventListener('beforeunload', (event: BeforeUnloadEvent): void => {
            this.sessionManager.newSession();//force 
            this.sessionManager.sendSessions();
        });
        this.router.events.subscribe(event => {
            if (event instanceof NavigationStart) {
                this.sessionManager.newSession(event.url);
            }
            if (event instanceof NavigationEnd) {
                this.sessionManager.getCurrentSession().name = document.title;
                this.sessionManager.getCurrentSession().location = document.URL; 
            }
        })
    }

 

    

  
}

