import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpEvent, HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import { finalize, Observable } from 'rxjs';
import { tap } from 'rxjs/operators'
import { RestRequestMonitor, TRACE_HEADER } from "./rest-request.monitor";
import { ContextManager } from "./context-manager";

@Injectable({ providedIn: 'root' })
export class HttpInterceptorService implements HttpInterceptor {

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {

    const monitor = new RestRequestMonitor();
    monitor.preProcess(req);

    const host = new URL(req.url, window.location.origin).host;
    if (!ContextManager.instance.techConfig.hostExcludes?.some((e: any) => e == host)) {
      req = req.clone({ headers: req.headers.set(TRACE_HEADER, monitor.id) });
    }

    let e: any;
    return next.handle(req).pipe(tap({
      next: (event: any) => {
        if (event instanceof HttpResponse) {
          e = event;
        }
        //TODO else !
      },
      error: (error: any) => {
        e = error;
      },
      unsubscribe: () => {
        e = {
          status: 0,
          name: "Unsubscribed",
          message: "The request was cancelled before completion"
        };
      }
    }),
      finalize(() => {
        e instanceof HttpResponse ? monitor.postProcess(e, null) : monitor.postProcess(null, e ?? {
          status: 0,
          name: "Unavailable",
          message: "The remote server is unavailable",
        })
      }));
  }
}
