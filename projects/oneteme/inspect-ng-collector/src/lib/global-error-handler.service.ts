import {ErrorHandler, Injectable} from "@angular/core";
import {SessionManager} from "./session-manager.service";
import {emitReport} from "./util";

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {

  handleError(error:any) {
    try {
      SessionManager.instance.addException({
        type: error?.name,
        message: error?.message
      })
    } catch (e) {
      emitReport("GlobalErrorHandlerService.handleError", e);
    }
    throw error;
  }
}
