import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpEvent, HttpHandler, HttpRequest, HttpResponse, HttpErrorResponse, HttpResponseBase } from '@angular/common/http';
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
    if (!ContextManager.instance.techConfig.hostExcludes?.some((e: any) => e == host)) { //TODO some comment why excludes URL
      req = req.clone({ headers: req.headers.set(TRACE_HEADER, monitor.id) });
    }

    let response: HttpResponseBase | null = null;
    let error: HttpErrorResponse | null = null;

    return next.handle(req).pipe(tap({
      next: (event: HttpEvent<any>) => {
        if (event instanceof HttpResponse) {
          response = event;
        }
        //todo  autres types d'événements (UploadProgress, DownloadProgress, etc.) ignorés pour les traces
      },
      error: (err: HttpErrorResponse) => {
        error = err;
      }
    }),
      finalize(() => {
        // Si pas de réponse et pas d'erreur capturé, la requête a été annulée
        if (!response && !error) {
          error = new HttpErrorResponse({
            error: 'The request was cancelled before completion',
            status: 0,
            statusText: 'Cancelled',
            url: req.url
          });
        }
        monitor.postProcess(response, error);
      }));
  }
}
