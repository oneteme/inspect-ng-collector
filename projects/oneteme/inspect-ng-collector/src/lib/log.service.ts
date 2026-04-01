import {dispatchLog} from './event-bus';
import {SessionManager} from "./session-manager.service";

export class InspectLogger {
  static info(message: string) {
    if (message) {
      dispatchLog("INFO", message, SessionManager.instance?.currentSessionID());
    }
  }
  static warn(message: string) {
    if (message) {
      dispatchLog("WARN", message, SessionManager.instance?.currentSessionID());
    }
  }
  static error(message: string) {
    if (message) {
      dispatchLog("ERROR", message, SessionManager.instance?.currentSessionID());
    }
  }
}
