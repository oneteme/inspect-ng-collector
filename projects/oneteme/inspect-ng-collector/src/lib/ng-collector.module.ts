import {
  NgModule,
  ModuleWithProviders,
  ErrorHandler,
  APP_INITIALIZER
} from '@angular/core';
import { HTTP_INTERCEPTORS, } from '@angular/common/http';
import { HttpInterceptorService } from './http-interceptor.service';
import { GlobalErrorHandlerService } from "./global-error-handler.service";
import { ContextManager } from "./context-manager";
import { CollectorConfig } from "./configuration";
import {
  eventTraceScheduledDispatcher,
} from "./event-trace-scheduled-dispatcher.service";

import {beforeDispatchListener, beforeUnloadListener, bfCacheListener, routerEventsListener} from "./listeners";
import { analyticsEventsListener } from "./analytics-collect.service";
import { eventTraceDebugger } from "./event-trace-debugger";
import {Router} from "@angular/router";
import {DISPATCH} from "./util";

@NgModule()
export class NgCollectorModule {
  private static forRootCalled: boolean = false;
  static configuration: CollectorConfig;
  static forRoot(configuration: CollectorConfig): ModuleWithProviders<NgCollectorModule> {
    this.configuration = configuration;
    if (configuration?.enabled && !NgCollectorModule.forRootCalled) {
      NgCollectorModule.forRootCalled = true;
      try {
        ContextManager.init(configuration);
        return {
          ngModule: NgCollectorModule,
          providers: [
            //provideAppInitializer(initializeEvents),
            { provide: APP_INITIALIZER, useFactory: initializeEvents,deps:[Router], multi: true },
            { provide: HTTP_INTERCEPTORS, useClass: HttpInterceptorService, multi: true },
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

export function initializeEvents(router:Router) {
  return () => {
    initContextManagerAndDispatcher()
    eventTraceDebugger();
    analyticsEventsListener();
    //storageEventListener();
    beforeDispatchListener();
    beforeUnloadListener();
    routerEventsListener(router);
    bfCacheListener();
  }


}

export function initContextManagerAndDispatcher(){
  ContextManager.init(NgCollectorModule.configuration);
  const dispatcher = eventTraceScheduledDispatcher()
  window.addEventListener( DISPATCH, (e: Event) => {
    if((e as CustomEvent).detail.force){
      dispatcher.onDestroy();
    }
  });
}


