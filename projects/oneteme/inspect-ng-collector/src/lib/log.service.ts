import {createLogEntry, DISPATCH} from './util';
import {SessionManager} from "./session-manager.service";

export class LogService {
  private constructor() {}

  static info(message: string) {
    if (message) {
      window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  { traces : createLogEntry("INFO", message, SessionManager.instance?.currentSessionID()) } }));
    }
  }
  static warn(message: string) {
    if (message) {
      window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  { traces : createLogEntry("WARN", message, SessionManager.instance?.currentSessionID()) } }));
    }
  }
  static error(message: string) {
    if (message) {
      window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  { traces : createLogEntry("ERROR", message, SessionManager.instance?.currentSessionID()) } }));
    }
  }
}
