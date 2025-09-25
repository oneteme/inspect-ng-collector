import {
  NgModule,
  ModuleWithProviders,
  ErrorHandler,
  provideAppInitializer
} from '@angular/core';
import { HTTP_INTERCEPTORS, } from '@angular/common/http';
import { logInspect } from './util';
import { HttpInterceptorService } from './http-interceptor.service';
import { GlobalErrorHandlerService } from "./global-error-handler.service";
import {ContextManager} from "./context-manager";
import {CollectorConfig} from "./configuration";
import {storageEventListener} from "./storage-event-trace.service";
import {EventTraceScheduledDispatcherService} from "./event-trace-scheduled-dispatcher.service";

import {beforeDispatchListener, beforeUnloadListener, routerEventsListener } from "./listeners";
import {analyticsEventsListener} from "./analytics-collect.service";

@NgModule()
export class NgCollectorModule {
  private static forRootCalled: boolean = false;
  static forRoot(configuration: CollectorConfig): ModuleWithProviders<NgCollectorModule> {
    if (configuration?.enabled && !NgCollectorModule.forRootCalled) {
      NgCollectorModule.forRootCalled = true;
      try {
        let c = ContextManager.init(configuration);
        logInspect('app',JSON.stringify(c.techConfig));
        logInspect('app',JSON.stringify(c.instanceEnv));
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
  logInspect('app','initialize routing events listeners');
  EventTraceScheduledDispatcherService.init(ContextManager.instance.techConfig, ContextManager.instance.instanceEnv)
  analyticsEventsListener();
  storageEventListener();
  beforeDispatchListener();
  beforeUnloadListener();
  routerEventsListener();
}


