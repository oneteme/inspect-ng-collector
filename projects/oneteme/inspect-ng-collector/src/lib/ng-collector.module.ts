import { NgModule, APP_INITIALIZER, ModuleWithProviders } from '@angular/core';
import { HTTP_INTERCEPTORS, } from '@angular/common/http';
import { logInspect } from './util';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { ApplicationConf, GetInstanceEnvironement, setConfig, validateAndGetConfig } from './configuration';
import { HttpInterceptorService } from './http-interceptor.service';
import { SessionManager } from './session-manager.service';
import { EventManagerService } from './event-manager.service';




@NgModule()
export class NgCollectorModule  {

  static forRoot(configuration: ApplicationConf): ModuleWithProviders<NgCollectorModule> {
    if(configuration?.enabled){
      try{
        let config = validateAndGetConfig(configuration);
        let instance = GetInstanceEnvironement(configuration);
        return {
          ngModule: NgCollectorModule,
          providers: [
            SessionManager, 
            //EventManagerService,
            { provide: APP_INITIALIZER, useFactory: initializeEvents, deps: [Router, SessionManager], multi: true },
            { provide: HTTP_INTERCEPTORS, useClass: HttpInterceptorService, multi: true },
            { provide: 'instance', useValue: instance },
            { provide: 'config', useValue: config }
          ]
        };
        
      }catch(e){
        console.warn('invalid Configuration, Ng-collector is disabled because', e);
      }
    }
    return {
      ngModule: NgCollectorModule
    }
  }
}


export function initializeEvents(router:Router, sessionManager: SessionManager) {
  return () => {
    logInspect('initialize routing events listeners');
        window.addEventListener('beforeunload', (event: BeforeUnloadEvent): void => {
            sessionManager.newSession();//force 
            sessionManager.sendSessions();
        });
        router.events.subscribe(event => {
            if (event instanceof NavigationStart) {
                sessionManager.newSession(event.url);
            }
            if (event instanceof NavigationEnd) {
                sessionManager.getCurrentSession().name = document.title;
                sessionManager.getCurrentSession().location = document.URL; 
            }
        })
  }
}


