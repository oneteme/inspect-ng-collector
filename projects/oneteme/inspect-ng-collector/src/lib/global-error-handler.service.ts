import {ErrorHandler, Injectable} from "@angular/core";
import {SessionManager} from "./session-manager.service";
import {createReport, DISPATCH} from "./util";
@Injectable({ providedIn: 'root' })
export class  GlobalErrorHandlerService implements ErrorHandler {

  handleError(error:any ) {
    try {
      SessionManager.instance.addException({
        type: error?.name,
        message: error?.message
      })

    }catch (e) {
      window.dispatchEvent(new CustomEvent( DISPATCH,{ detail : { traces : createReport("Erreur dans GlobalErrorHandlerService: " + JSON.stringify(e)) } }));
    }
    throw error;
  }
}
