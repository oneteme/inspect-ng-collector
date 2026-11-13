import {
  BrowserConfig,
  dateNow,
  Mask,
  SessionEvent,
  TRACE_TYPE_ADDITIONAL_VALUES,
  TRACE_TYPE_SESSION_EVENT
} from "./trace.model";
import {SessionManager} from "./session-manager.service";
import {dispatchReport, dispatchTraces} from "./event-bus";

const eventHandlers: { [key: string]: (target: HTMLElement) => boolean } = {
  'click': (target: HTMLElement) => lookUpChild(target, 1),
}
export type EventType = "Initialisation" | "Click" | "Dblclick" | "Scroll" | "Change" | "Tab-focus" | "Tab-blur" | "Zoom" | "Resize";
const RESIZE_IDLE_DELAY = 250;
const SCROLL_IDLE_DELAY = 250;
const SELECTION_IDLE_DELAY = 400;
const CLICK_DELAY = 300;
const ELEMENT_EVENTS = [
  'click', 'dblclick', 'change',
];
let globalBrowserValues: any = {c: globalThis.devicePixelRatio, o: `${innerWidth}x${innerHeight}`}
let Timer: ReturnType<typeof setTimeout> | undefined;
let selectionTimer: ReturnType<typeof setTimeout> | undefined;
const clickTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function initUserActionMonitor() {

  try {
    ELEMENT_EVENTS.forEach(type => document.addEventListener(type, globalHandler, true));
    globalThis.addEventListener('scroll', scrollHandler, true); // do costum handler with timeout
    globalThis.addEventListener('resize', resizeHandler, true);
    document.addEventListener('visibilitychange', visibilityHandler);
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', ()=>{addActionUser(createBlankSessionEvent(),'Initialisation', null)}, {once: true}) : addActionUser(createBlankSessionEvent(),'Initialisation', null);
    traceBrowserConfig();
  } catch (e) {
    dispatchReport("initUserActionMonitor", e);
  }
}



function getEventType(eventType: string): EventType | null {
  switch (eventType){
    case "click": return "Click";
    case "dblclick": return "Dblclick"
    case "change": return "Change";
    default: return  null;
  }
}


function traceBrowserConfig() {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  dispatchTraces({
    '@type': TRACE_TYPE_ADDITIONAL_VALUES,
    deviceDisplayResolution: `${screen?.width}x${screen?.height}`,
    deviceOrientation: screen.orientation?.type ?? (innerWidth >= innerHeight ? 'landscape' : 'portrait'),
    deviceConnectivity: connection?.effectiveType ?? 'unknown',
    windowViewportBounds: `${innerWidth}x${innerHeight}`,
    windowZoomLevel: String(visualViewport?.scale ?? devicePixelRatio),
    userLanguage: navigator.language,
    userTheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    saveData: connection?.saveData ?? undefined
  } as BrowserConfig)
}


function resizeHandler() {
  let ua = createBlankSessionEvent();
  if (Timer) {
    clearTimeout(Timer);
  }

  Timer = setTimeout(() => {
    Timer = undefined;
    const previousRatio = globalBrowserValues.c;
    const currentRatio = globalThis.devicePixelRatio;
    globalBrowserValues.o = `${innerWidth}x${innerHeight}`
    if (previousRatio !== currentRatio) {
      // Signed delta: '+' when zooming in, '-' when zooming out.
      const delta = Math.round((currentRatio - previousRatio) * 100);
      const sign = delta > 0 ? '+' : '';
      addActionUser(ua, 'Zoom', `${sign}${delta}%`);
    } else {
      addActionUser(ua, 'Resize', `${innerWidth}x${innerHeight}`);
    }
    globalBrowserValues.c = currentRatio
  }, RESIZE_IDLE_DELAY);
}

function scrollHandler() {
  let ua = createBlankSessionEvent();
  if (Timer) {
    clearTimeout(Timer);
  }

  Timer = setTimeout(() => {
    Timer = undefined;
    addActionUser(ua, 'Scroll', null); // todo to enhance  ( vertical / horizontal )
  }, SCROLL_IDLE_DELAY);
}


function globalHandler(event: Event) {
  let ua = createBlankSessionEvent()
  const target = event.target as HTMLElement;
  let e= getEventType(event.type)
  if(!e)
    return
  try {
    /*if (eventHandlers.hasOwnProperty(eventType) && !eventHandlers[eventType](target)) {
      return;
    } */
    const value = target.attributes.getNamedItem("data-inspect-track")?.value;
    if (!value) {
      return;
    }
    const scope = target.attributes.getNamedItem("data-inspect-scope")?.value;
    const location = target.attributes.getNamedItem("data-inspect-location")?.value;


    if (event.type === 'click') {
      const pendingClick = clickTimers.get(target);
      if (pendingClick) {
        clearTimeout(pendingClick);
      }
      const timer = setTimeout(() => {
        clickTimers.delete(target);
        addActionUser(ua, e, value, scope, location);
      }, CLICK_DELAY);
      clickTimers.set(target, timer);
      return;
    }

    const pendingClick = clickTimers.get(target);
    if (event.type === 'dblclick' && pendingClick) {
      clearTimeout(pendingClick);
      clickTimers.delete(target);
    }
    addActionUser(ua,e, value, scope, location);


  } catch (err) {
    dispatchReport("UserACTION.globalHandler", err)
  }
}


function visibilityHandler() {
  addActionUser(createBlankSessionEvent(), document.hidden ? 'Tab-blur' : 'Tab-focus', null)
}

function createBlankSessionEvent(){
  return {
    ...SessionManager.instance.traceSessionMaskUpdate(Mask.EVENT),
    '@type': TRACE_TYPE_SESSION_EVENT,
    instant: dateNow(),
  }
}

function addActionUser(ua: any,eventType: EventType, value: string | null, scope?: string, location?: string) {
  dispatchTraces({
    ...ua,
    type: eventType,
    value: value,
    scope: scope,
    location: location
  } as SessionEvent);
}


// Debounced; only the selection length is reported, never its content (privacy).
/*function selectionHandler() {
  if (selectionTimer) {
    clearTimeout(selectionTimer);
  }
  selectionTimer = setTimeout(() => {
    selectionTimer = undefined;
    const length = document.getSelection ? String(document.getSelection()).length : 0;
    if (length > 0) {
      addActionUser('select', `length=${length}`);
    }
  }, SELECTION_IDLE_DELAY);
}
*/


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


