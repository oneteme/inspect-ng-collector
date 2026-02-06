import { UserAction, extractName } from "./trace.model"; //TODO extractName in Model !!???
import { SessionManager } from "./session-manager.service";
import { dateNow, dispatchReport, dispatchTraces } from "./util";

let eventHandlers: { [key: string]: (target: HTMLElement) => boolean } = { //TODO let ??
  'click': (target: HTMLElement) => lookUpChild(target, 1),
}
export function initUserActionMonitor() {
  try {
    const body = window.document.body;
    body.addEventListener('click', globalHandler, true);
    body.addEventListener('change', event => globalHandler(event), true); //TODO choose one : globalHandler or event => globalHandler(event) 
    body.addEventListener('scrollend', event => globalHandler(event), true);
    body.addEventListener('dragend', event => globalHandler(event), true);
    window.document.addEventListener('DOMContentLoaded', event => globalHandler(event), true);
  }
  catch (e) {
    dispatchReport("initUserActionMonitor", e);
  }
}

function globalHandler(event: Event | MouseEvent) {
  const target = event.target as HTMLElement;
  const eventType = event.type;
  try {
    if (eventHandlers.hasOwnProperty(eventType) && !eventHandlers[eventType](target)) {
      return;
    }
    addActionUser(eventType, target);
  } catch (err) {
    console.warn(err); //TODO report
  }
}

function lookUpChild(t: HTMLElement, depth: number): boolean {
  if (t.hasChildNodes() && t.children.length <= 5) {
    if (++depth > 5) {
      return false;
    }
    return Array.from(t.childNodes).reduce((acc, c) =>
      acc && lookUpChild(c as HTMLElement, depth), true);
  }
  return true;
}

function addActionUser(eventType: string, target: HTMLElement) {
  dispatchTraces({
    ...SessionManager.instance.initUserAction(),
    '@type': "300",
    type: eventType,
    start: dateNow(),
    name: extractName(target),
    nodeName: target.tagName?.toLowerCase()
  } as UserAction);
}
