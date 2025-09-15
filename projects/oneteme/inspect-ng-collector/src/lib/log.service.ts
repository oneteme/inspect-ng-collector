import {Injectable} from '@angular/core';
import {createLogEntry} from './util';
import {EventTraceScheduledDispatcherService} from "./event-trace-scheduled-dispatcher.service";
import {SessionManager} from "./session-manager.service";

@Injectable({ providedIn: 'root' })
export class LogService {

  constructor(private readonly dispatcher: EventTraceScheduledDispatcherService,
              private readonly sessionManager: SessionManager) {
  }

  info(message: string) {
    if (message) {
      this.dispatcher.addToQueue(createLogEntry("INFO", message, this.sessionManager.currentSessionID()));
    }
  }
  warn(message: string) {
    if (message) {
      this.dispatcher.addToQueue(createLogEntry("WARN", message, this.sessionManager.currentSessionID()));
    }
  }
  error(message: string) {
    if (message) {
      this.dispatcher.addToQueue(createLogEntry("ERROR", message, this.sessionManager.currentSessionID()));
    }
  }
}
