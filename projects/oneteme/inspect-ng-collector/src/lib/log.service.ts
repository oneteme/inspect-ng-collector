// log.service.ts
import { Injectable } from '@angular/core';
import { SessionManager } from './session-manager.service';
import {createLogEntry} from './util';

@Injectable({ providedIn: 'root' })
export class LogService {
  constructor(private readonly sessionManager: SessionManager) {}

  info(message: string) {
    if (message) {
      this.sessionManager.traceQueue.push(createLogEntry("INFO", message));
    }
  }
  warn(message: string) {
    if (message) {
      this.sessionManager.traceQueue.push(createLogEntry("WARN", message));
    }
  }
  error(message: string) {
    if (message) {
      this.sessionManager.traceQueue.push(createLogEntry("ERROR", message));
    }
  }
}
