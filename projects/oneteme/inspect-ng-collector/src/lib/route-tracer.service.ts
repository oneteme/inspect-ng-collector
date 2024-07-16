import {  Inject, Injectable, OnDestroy} from "@angular/core";
import { NavigationEnd, NavigationStart, Router } from "@angular/router";
import { MainSession } from "./trace.model";
import { ApplicationConf} from "./ng-collector.module";
import { dateNow, getRegArrOrCall, getStringOrCall, initDebug, logInspect, prettySessionFormat } from "./util";
import { SessionManager } from "./session-manager.service";


@Injectable({ providedIn: 'root' }) 
export class RouteTracerService  implements OnDestroy{


    currentSession!: MainSession; 
    user?: string;
    trySendInstanceEnv:any;
    excludeList: RegExp[] | undefined;
    sessionManager : SessionManager;
    constructor(private router: Router,
        @Inject('config') config: ApplicationConf,
        @Inject('host') host: string) {
        this.sessionManager = new SessionManager();
        this.excludeList = getRegArrOrCall(config.exclude);
        this.sessionManager.initialize(config,host);
        this.user = getStringOrCall(config.user);
        initDebug(config.debug ?? false);
    }

    private beforeUnloadHandler = (event: BeforeUnloadEvent): void => {
        this.currentSession.end = dateNow();
        if(this.excludeList!.every((e) => !e.test(this.currentSession.location))){
            this.sessionManager.addSessions(this.currentSession);//force 
            this.sessionManager.sendSessions();
        }
    }

    ngOnDestroy(): void { 
        window.removeEventListener('beforeunload',this.beforeUnloadHandler); 
    }

    initialize() {
        logInspect('initialize');
        window.addEventListener('beforeunload', this.beforeUnloadHandler);
        this.router.events.subscribe(event => {
            if (event instanceof NavigationStart) {
                const now = dateNow();
                if (this.currentSession) {
                    this.currentSession.end = dateNow();
                    if(this.excludeList!.every((e) => !e.test(this.currentSession.location))){
                        this.sessionManager.addSessions(this.currentSession);
                    }
                    logInspect(()=>prettySessionFormat(this.currentSession));
                }
                this.currentSession = {
                    '@type': "main",
                    user: this.user,
                    start: now,
                    type: "VIEW",
                    location: event.url,
                    restRequests: []
                }
            }
            if (event instanceof NavigationEnd) {
                this.currentSession.name = document.title;
                this.currentSession.location = document.URL; 

            }
        })

    }

    getCurrentSession() {
        return this.currentSession;
    }
}

