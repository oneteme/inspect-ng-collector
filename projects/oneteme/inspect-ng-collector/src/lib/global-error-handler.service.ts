import {ErrorHandler, Injectable} from "@angular/core";
import {SessionManager} from "./session-manager.service";
import {createReport} from "./util";
import {EventTraceScheduledDispatcherService} from "./event-trace-scheduled-dispatcher.service";

@Injectable({ providedIn: 'root' })
export class  GlobalErrorHandlerService implements ErrorHandler {

  constructor(private readonly sessionManager: SessionManager,
              private readonly dispatcher: EventTraceScheduledDispatcherService) {
  }
  handleError(error:any ) {
    try {
      this.sessionManager.addException({
        type: error?.name,
        message: error?.message
      })

    }catch (e) {
      console.warn(e)
      this.dispatcher.addToQueue(createReport("Erreur dans GlobalErrorHandlerService: " + JSON.stringify(e)));
    }
    throw error;
  }
}
