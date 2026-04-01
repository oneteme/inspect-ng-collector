import { dateNow, UserAction, TRACE_TYPE_USER_ACTION } from "./trace.model"; //TODO extractName in Model !!??? - DONE
import { SessionManager } from "./session-manager.service";
import { dispatchReport, dispatchTraces } from "./event-bus";

const eventHandlers: { [key: string]: (target: HTMLElement) => boolean } = { //TODO let ?? - Done
  'click': (target: HTMLElement) => lookUpChild(target, 1),
}
export function initUserActionMonitor() {
  try {
    const body = window.document.body;
    body.addEventListener('click', globalHandler, true);
    body.addEventListener('change', globalHandler, true); //TODO choose one : globalHandler or event => globalHandler(event) - DONE
    body.addEventListener('scrollend', globalHandler, true);
    body.addEventListener('dragend', globalHandler, true);
    window.document.addEventListener('DOMContentLoaded', globalHandler, true);
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
    console.warn(err); //TODO report - Done
    dispatchReport("UserACTION.globalHandler", JSON.stringify(err))
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
    '@type': TRACE_TYPE_USER_ACTION,
    type: eventType,
    instant: dateNow(),
    name: extractName(target),
    nodeName: target.tagName?.toLowerCase()
  } as UserAction);
}

function getFirst(c: ((t: HTMLElement) => string | null)[], t: HTMLElement) {
  for (const o of c) {
    let r = o(t)?.trim();
    if (r) {
      return r;
    }
  }
  return null;
}

function extractName(t: HTMLElement) {
  try {
    let tagName = t.tagName
    if (tagName) {
      let name;
      let c = MAP[tagName.toLowerCase()];
      if (c) {
        name = getFirst(c, t);
      }
      return name ?? getFirst(genericMap, t)!;
    }

  } catch (err) {
    console.warn(err)
  }
  return null
}



const genericMap: ((t: HTMLElement) => string | null)[] = [
  t => t.getAttribute('placeholder'),
  t => t.getAttribute('title'),
  t => t.innerText,
  t => t.getAttribute('name'),
  t => t.getAttribute('id'),
]

const MAP: { [key: string]: ((t: HTMLElement) => string | null)[] } = {
  'img': [
    t => t.getAttribute('alt'),
    t => t.getAttribute('src'),
  ],
  'input': [
    t => t.getAttribute('name'),
  ],
  'a': [
    t => t.getAttribute('href'),
  ],
  'label': [
    t => t.getAttribute('for'),
  ],
}

