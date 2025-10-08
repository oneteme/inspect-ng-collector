import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpEvent, HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import {finalize, Observable} from 'rxjs';
import { tap } from 'rxjs/operators'
import {RestRequestMonitor} from "./rest-request-monitor";
import {DISPATCH} from "./util";
import {ContextManager} from "./context-manager";

@Injectable({ providedIn: 'root' })
export class HttpInterceptorService implements HttpInterceptor {

  constructor() {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let restRequestMonitor: RestRequestMonitor = new RestRequestMonitor(req);
    let e:any;
    window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  { traces : restRequestMonitor.restRequest } }));
    const host = new URL(req.url, window.location.origin).host;
    if(!ContextManager.instance.techConfig.hostExcludes?.some((e:any) => e== host)) {
      req = req.clone({headers :req.headers.set('x-tracert',restRequestMonitor.restRequest.id)});
    }
    return next.handle(req).pipe(tap(
      (event: any) => {
        if (event instanceof HttpResponse) {
          e = event;
        }
      },
      error => {
          e = error
      }
    ),finalize(()=> {
        e instanceof HttpResponse ?  restRequestMonitor.postProcess(e, null): restRequestMonitor.postProcess(null, e ?? {
        status: 0,
        name: "IOException",
        message: "The remote server is unavailable.",
      })
    }));
  }
}
