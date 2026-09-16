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

const RESIZE_IDLE_DELAY = 250;
const SCROLL_IDLE_DELAY = 250;
let globalBrowserValues: any = { o : globalThis.devicePixelRatio , c :`${innerWidth}x${innerHeight}` }
let Timer: ReturnType<typeof setTimeout> | undefined;

export function initUserActionMonitor() {
  try {
    globalThis.addEventListener('scroll', scrollHandler, true); // do costum handler with timeout
    globalThis.addEventListener('resize', resizeHandler, true );
    document.addEventListener('visibilitychange', visibilityHandler);
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', globalHandler, { once: true }) : addActionUser('DOMContentLoaded',  null, null);
    //todo move by move to detect changeecran
    traceBrowserConfig();
  }
  catch (e) {
    dispatchReport("initUserActionMonitor", e);
  }
}

function globalHandler(event: Event) {
  const target = event.target as HTMLElement;
  const eventType = event.type;
  try {
    if (eventHandlers.hasOwnProperty(eventType) && !eventHandlers[eventType](target)) {
      return;
    }
    addActionUser(eventType, extractName(target), target.tagName?.toLowerCase() );
  } catch (err) {
    dispatchReport("UserACTION.globalHandler", err)
  }
}



function traceBrowserConfig() {
  dispatchTraces({
    '@type':  TRACE_TYPE_ADDITIONAL_VALUES,
    deviceDisplayResolution:`${screen?.width}x${screen?.height}`,
    deviceOrientation:screen.orientation?.type ?? (innerWidth >= innerHeight ? 'landscape' : 'portrait'),
    deviceConnectivity:(navigator as any).connection?.effectiveType ?? 'unknown',
    windowViewportBounds:`${innerWidth}x${innerHeight}`,
    windowZoomLevel:String(visualViewport?.scale ?? devicePixelRatio),
    userLanguage:navigator.language,
    userTheme:matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
   // navigationReferrer:document.referrer || 'direct';
  } as BrowserConfig)
}






function resizeHandler() {
  if (Timer) {
    clearTimeout(Timer);
  }

  Timer = setTimeout(() => {
    Timer = undefined;
    globalBrowserValues.o = `${innerWidth}x${innerHeight}`
    if (globalBrowserValues.c  != globalThis.devicePixelRatio) {
      addActionUser('zoom', `${Number((globalThis.devicePixelRatio - (globalBrowserValues.c )).toFixed(2)) * 100}%`, null); // todo : new - old
    }else {
      addActionUser('resize',`${innerWidth}x${innerHeight}`, null);
    }
    globalBrowserValues.c = globalThis.devicePixelRatio
  }, RESIZE_IDLE_DELAY);
}

function scrollHandler() {
  if (Timer) {
    clearTimeout(Timer);
  }

  Timer = setTimeout(() => {
    Timer = undefined;
    addActionUser('scroll',null, null); // todo to enhance  ( vertical / horizontal )
  }, SCROLL_IDLE_DELAY);
}


function visibilityHandler() {
    addActionUser(document.hidden? 'DOC_HIDDEN' : 'DOC_VISIBLE', null, null )
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



function addActionUser(eventType: string, value: string | null, location: string | null) {
  const at = dateNow();
  dispatchTraces({
    ...SessionManager.instance.traceSessionMaskUpdate(Mask.EVENT),
    '@type': TRACE_TYPE_SESSION_EVENT,
    type: eventType,
    instant: at,
    value: value,
    location: location
  } as SessionEvent);
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

