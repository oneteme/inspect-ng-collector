import {NgModule, APP_INITIALIZER, ModuleWithProviders, ErrorHandler} from '@angular/core';
import { HTTP_INTERCEPTORS, } from '@angular/common/http';
import { logInspect } from './util';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { ApplicationConf, GetInstanceEnvironement, validateAndGetConfig } from './configuration';
import { HttpInterceptorService } from './http-interceptor.service';
import { SessionManager } from './session-manager.service';
import {AnalyticsCollector} from "./analytics-collect.service";
import {GlobalErrorHandlerService} from "./global-error-handler.service";

@NgModule()
export class NgCollectorModule {

  static forRoot(configuration: ApplicationConf): ModuleWithProviders<NgCollectorModule> {
    if (configuration?.enabled) {
      try {
        let config = validateAndGetConfig(configuration);
        let instance = GetInstanceEnvironement(configuration);
        let deps:any[] = [Router, SessionManager]
        logInspect('app',JSON.stringify(config));
        logInspect('app',JSON.stringify(instance));
        config.analytics && deps.push(AnalyticsCollector);

        return {
          ngModule: NgCollectorModule,
          providers: [
            SessionManager,
            { provide: APP_INITIALIZER, useFactory: initializeEvents, deps: deps, multi: true },
            { provide: HTTP_INTERCEPTORS, useClass: HttpInterceptorService, multi: true },
            { provide: 'instance', useValue: instance },
            { provide: 'config', useValue: config },
            { provide: ErrorHandler, useClass: GlobalErrorHandlerService }
          ]
        };
      } catch (e:any) {
        console.warn(`invalid Configuration, Ng-collector is disabled because of this ${e.message}`);
      }
    }
    return {
      ngModule: NgCollectorModule
    }
  }
}

export function initializeEvents(router: Router, sessionManager: SessionManager, analyticsCollector: AnalyticsCollector) {
  return () => {
    logInspect('app','initialize routing events listeners');
    window.addEventListener('beforeunload', event => {
      if(!sessionManager.getCurrentSession().loading){
        sessionManager.newSession();
      }
      sessionManager.sendSessions(true);
    });
    router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        sessionManager.newSession(event.url);
      }
      if (event instanceof NavigationEnd) {
        delete sessionManager.getCurrentSession().loading;
      }
    })
    if(analyticsCollector){
      analyticsCollector.subscribeToEvents();
    }

  }
}


