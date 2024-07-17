import {  Inject, Injectable, OnDestroy} from "@angular/core";
import { NavigationEnd, NavigationStart, Router } from "@angular/router";
import { MainSession } from "./trace.model";

import { dateNow,initDebug, logInspect, prettySessionFormat } from "./util";
import { SessionManager } from "./session-manager.service";


@Injectable({ providedIn: 'root' }) 
export class RouteTracerService  {


    currentSession!: MainSession; 
    user?: string;
    trySendInstanceEnv:any;
    excludeList: RegExp[] | undefined;

    constructor(private router: Router) {
        console.log('pezfjpezjf')
    }

 

    

  
}

