import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpEvent, HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators'
import { SessionManager } from './session-manager.service';
import {RestRequestMonitor} from "./rest-request-monitor";
import {EventTraceScheduledDispatcherService} from "./event-trace-scheduled-dispatcher.service";

@Injectable({ providedIn: 'root' })
export class HttpInterceptorService implements HttpInterceptor {

  constructor(private readonly sessionManager: SessionManager,
              private readonly dispatcher: EventTraceScheduledDispatcherService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let restRequestMonitor: RestRequestMonitor = new RestRequestMonitor(this.sessionManager, req, this.dispatcher);
    req = req.clone({headers :req.headers.set('x-tracert',restRequestMonitor.restRequest.id)});
    return next.handle(req).pipe(tap( // set object response in next and error, move
      (event: any) => {
        if (event instanceof HttpResponse) {
          restRequestMonitor.postProcess(event, null)
        }
      },
      error =>
          restRequestMonitor.postProcess(null, error ?? {
            status: 0,
            name: "ServerUnavailable", // todo to be changed Ioexception , unknownHostException, less text
            message: "The remote server is unavailable or did not respond.",
          })
    ));
  }
}
