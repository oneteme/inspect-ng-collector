import { ErrorHandler, Injectable } from "@angular/core";
import { SessionManager } from "./session-manager.service";
import { dispatchReport } from "./event-bus";

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {

  handleError(error: any) {
    try {
      SessionManager.instance.addException({
        type: error?.name,
        message: error?.message
      })
    } catch (e) {
      dispatchReport("GlobalErrorHandlerService.handleError", e);
    }
    throw error;
  }
}
