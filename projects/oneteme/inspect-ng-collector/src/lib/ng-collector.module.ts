import {
  NgModule,
  ModuleWithProviders,
  ErrorHandler,
  provideAppInitializer
} from '@angular/core';
import { HTTP_INTERCEPTORS, } from '@angular/common/http';
import { HttpInterceptorService } from './http-interceptor.service';
import { GlobalErrorHandlerService } from "./global-error-handler.service";
import {ContextManager} from "./context-manager";
import {CollectorConfig} from "./configuration";
import {
  eventTraceScheduledDispatcher,
} from "./event-trace-scheduled-dispatcher.service";

import {beforeDispatchListener, beforeUnloadListener, routerEventsListener } from "./listeners";
import {analyticsEventsListener} from "./analytics-collect.service";
import {eventTraceDebugger} from "./event-trace-debugger";

@NgModule()
export class NgCollectorModule {
  private static forRootCalled: boolean = false;
  static forRoot(configuration: CollectorConfig): ModuleWithProviders<NgCollectorModule> {
    console.log("forRootCalled");
    if (configuration?.enabled && !NgCollectorModule.forRootCalled) {
      NgCollectorModule.forRootCalled = true;
      try {
        ContextManager.init(configuration);
        return {
          ngModule: NgCollectorModule,
          providers: [
             provideAppInitializer(initializeEvents),
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

export function initializeEvents() {
  eventTraceScheduledDispatcher()
  eventTraceDebugger();
  analyticsEventsListener();
  //storageEventListener();
  beforeDispatchListener();
  beforeUnloadListener();
  routerEventsListener();
}


