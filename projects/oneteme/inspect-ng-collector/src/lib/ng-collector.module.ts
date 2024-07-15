import { NgModule, APP_INITIALIZER, ModuleWithProviders } from '@angular/core';
import { HTTP_INTERCEPTORS, } from '@angular/common/http';
import { HttpInterceptorService } from './http-interceptor.service';
import { RouteTracerService } from './route-tracer.service';
import { getNumberOrCall, requirePostitiveValue, validate, HOST_PATERN, PATH_PATERN, getStringOrCall } from './util';
import { SessionManager } from './session-manager.service';



@NgModule({})
export class NgCollectorModule {

  static forRoot(host: string, configuration: ApplicationConf): ModuleWithProviders<NgCollectorModule> {
    if (configuration?.enabled
        && validate(host, HOST_PATERN)
        && validate(getStringOrCall(configuration?.sessionApi), PATH_PATERN)
        && validate(getStringOrCall(configuration?.instanceApi), PATH_PATERN)) {


       if(!requirePostitiveValue(getNumberOrCall(configuration?.delay),"delay") ||
          !requirePostitiveValue(getNumberOrCall(configuration?.bufferMaxSize),"bufferMaxSize") ){
            console.warn('invalid Configuration, Ng-collector is disabled');
          return {ngModule: NgCollectorModule}
       }  
      return {
        ngModule: NgCollectorModule,
        providers: [
          RouteTracerService,
          SessionManager,
          { provide: APP_INITIALIZER, useFactory: initializeRoutingEvents, deps: [RouteTracerService], multi: true },
          { provide: HTTP_INTERCEPTORS, useClass: HttpInterceptorService, multi: true },
          { provide: 'config', useValue: configuration },
          { provide: 'host', useValue: host }
        ]
      };
    }
    return {
      ngModule: NgCollectorModule
    }

  }
}

export function initializeRoutingEvents(routeTracerService: RouteTracerService) {
  return () => routeTracerService.initialize();
}

export interface ApplicationConf {
  name?: string | (() => string);
  version?: string | (() => string);
  env?: string | (() => string);
  user?: string | (() => string);
  bufferMaxSize?: number | (() => number);
  delay?: number| (() => number);
  instanceApi?: string | (() => string);
  sessionApi?: string | (() => string);
  exclude?: RegExp[] | (() => RegExp[]);
  enabled?: boolean;
}
