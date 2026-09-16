import { ErrorHandler, Injectable } from "@angular/core";
import { SessionManager } from "./session-manager.service";
import {dispatchReport, dispatchTraces} from "./event-bus";
import {createException} from "./configuration";

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {

  handleError(error: any) {
    try {
      let ex = createException(error, SessionManager.instance.rename(),true)
      if(ex){
        dispatchTraces(ex);
      }
    } catch (e) {
      dispatchReport("GlobalErrorHandlerService.handleError", e);
    }
  }
}
