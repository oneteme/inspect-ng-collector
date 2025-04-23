import {ErrorHandler, Injectable} from "@angular/core";
import {SessionManager} from "./session-manager.service";

@Injectable({ providedIn: 'root' })
export class  GlobalErrorHandlerService implements ErrorHandler {

  constructor(private readonly sessionManager: SessionManager) {
  }
  handleError(error:any ) {
      this.sessionManager.getCurrentSession().exceptions.push({
        type: error?.name,
        message: error?.message
      })
      throw (error);
  }
}
