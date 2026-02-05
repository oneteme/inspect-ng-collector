import {emitLog} from './util';
import {SessionManager} from "./session-manager.service";

export class LogService {
  static info(message: string) {
    if (message) {
      emitLog("INFO", message, SessionManager.instance?.currentSessionID());
    }
  }
  static warn(message: string) {
    if (message) {
      emitLog("WARN", message, SessionManager.instance?.currentSessionID());
    }
  }
  static error(message: string) {
    if (message) {
      emitLog("ERROR", message, SessionManager.instance?.currentSessionID());
    }
  }
}
