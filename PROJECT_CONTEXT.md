# Contexte projet — `inspect-ng-collector`

## Objectif du projet
`inspect-ng-collector` est une bibliothèque Angular de télémétrie front-end. Elle instrumente une application Angular pour collecter des traces côté navigateur, les regrouper en sessions, puis les envoyer périodiquement vers un backend distant.

## Rôle principal
La librairie permet de suivre :
- la navigation Angular,
- les requêtes HTTP,
- les erreurs globales Angular,
- les actions utilisateur DOM,
- l’usage mémoire JavaScript,
- des étapes locales via le décorateur `@TraceableStage()`,
- des logs applicatifs via `LogService`.

## Surface publique
Le fichier `projects/oneteme/inspect-ng-collector/src/public-api.ts` exporte :
- `NgCollectorModule`
- `TraceableStage`
- `SessionManager`
- `COLLECTOR_CONFIG` (InjectionToken)
- `LogService`

## Point d'entrée principal
Le bootstrap se fait via `NgCollectorModule.forRoot(configuration)` dans `projects/oneteme/inspect-ng-collector/src/lib/ng-collector.module.ts`.

Quand `configuration.enabled` est vrai, la librairie :
- initialise le contexte via `initializeCollector()`,
- enregistre un `APP_INITIALIZER`,
- installe `HttpInterceptorService` avec injection du `COLLECTOR_CONFIG`,
- remplace `ErrorHandler` par `GlobalErrorHandler`.

Au démarrage, elle active ensuite :
- le dispatcher périodique de traces,
- le debugger interne,
- le monitor des actions utilisateur si `analytics.enabled`,
- le monitor des ressources si `resources.enabled`,
- le monitor de navigation.

## Architecture générale
Flux principal :
1. La configuration utilisateur est validée dans `validateAndGetConfig()`.
2. Un objet d'instance (`InstanceEnvironment`) est construit via `createInstance()`.
3. Les monitors produisent des `EventTrace`.
4. Toutes les traces transitent via `event-bus.ts`.
5. `EventTraceScheduledDispatcherService` stocke les traces dans une file mémoire (`Set<EventTrace>`).
6. Un export périodique envoie d'abord l'instance, puis les traces/sessions au backend via `fetch`.

## Fichiers clés et responsabilités

### `projects/oneteme/inspect-ng-collector/src/lib/ng-collector.module.ts`
Module Angular principal qui :
- définit le `InjectionToken COLLECTOR_CONFIG` pour l'injection de dépendances,
- implémente `forRoot(configuration)` pour la configuration au bootstrap,
- expose `initializeCollector(config)` qui crée et initialise le contexte (returns `{tech, instance}`),
- expose `reloadCollector(config)` qui regénère la session avec un nouvel UUID,
- expose `initializeEventsFactory(config, router)` qui active les monitors au démarrage,
- installe `HTTP_INTERCEPTORS` et `ErrorHandler`.

**Modifications récentes** :
- `HttpInterceptorService` est maintenant injecté avec `COLLECTOR_CONFIG` pour accéder à `techConfig`.
- `initializeCollector()` retourne un objet `{tech, instance}` pour plus de flexibilité.
- `reloadCollector()` met à jour l'ID d'instance et relance la tracing.

### `projects/oneteme/inspect-ng-collector/src/lib/configuration.ts`
Définit les interfaces et utilitaires :

**Interfaces principales** :
- `CollectorConfig` : configuration utilisateur avec propriétés **déplacées à la racine** (name, version, env, user, additionalProperties). Les propriétés monitoring restent optionnelles.
- `TechnicalConf` : configuration technique interne avec endpoints calculés.

**Fonctions clés** :
- `validateAndGetConfig(conf, instanceId)` : valide et transforme la config en `TechnicalConf`
- `createInstance(conf, instanceId)` : crée l'objet `InstanceEnvironment` avec gestion sûre de `additionalProperties?.() || {}`
- `adaptedConfig(conf)` : adapte la config pour le backend
- `refreshConfig(tech)` : regénère l'UUID de session via simple remplacement d'UUID dans l'URL sessionApi
- `getOrCall<T>(o)` : utilitaire pour appeler une fonction ou retourner la valeur directe
- `require(v, name)` : valide qu'une propriété est définie
- `matchRegex(v, name, pattern, defaultValue)` : valide contre un regex
- `requirePostitiveValue(v, name, defaultValue)` : valide qu'une valeur est positive
- Détection : `detectOs()`, `detectBrowser()` avec sérialisation correcte des erreurs via `serializeError()`

**Modifications récentes** :
- Propriétés `name`, `version`, `env`, `user`, `additionalProperties` **déplacées à la racine** de `CollectorConfig`
- `additionalProperties` est maintenant **optionnel** avec gestion d'undefined : `conf?.additionalProperties?.() || {}`
- `refreshConfig()` simplifié pour faire un simple remplacement d'UUID dans l'URL
- `detectOs()` et `detectBrowser()` utilisent `serializeError()` pour gérer tous les types d'erreur

### `projects/oneteme/inspect-ng-collector/src/lib/context-manager.ts`
Singleton central qui :
- valide la config,
- calcule les endpoints,
- expose `techConfig` avec **getter et setter**,
- expose `instanceEnv` avec **getter et setter**,
- maintient les états.

**Modifications récentes** :
- **Ajout du setter pour `instanceEnv`** pour permettre de modifier l'environnement après initialisation.

### `projects/oneteme/inspect-ng-collector/src/lib/event-bus.ts`
Bus interne basé sur `EventTarget` avec trois canaux : `trace`, `export`, `shutdown`.

### `projects/oneteme/inspect-ng-collector/src/lib/event-trace-scheduled-dispatcher.service.ts`
Gère :
- la queue mémoire,
- le timer RxJS,
- l’envoi de l’instance,
- l’envoi des traces.

### `projects/oneteme/inspect-ng-collector/src/lib/session-manager.service.ts`
Gère la session courante liée à la navigation :
- ouverture/fermeture de session,
- association des traces à la session active,
- rattachement d’exceptions à la session.

### `projects/oneteme/inspect-ng-collector/src/lib/http-interceptor.service.ts`
Intercepte les requêtes HTTP Angular, crée un `RestRequestMonitor`, injecte le header `x-tracert` et finalise la trace sur réponse/erreur.

### `projects/oneteme/inspect-ng-collector/src/lib/rest-request.monitor.ts`
Construit les traces détaillées de requêtes HTTP :
- méthode,
- protocole,
- host,
- port,
- path,
- query,
- taille du body,
- content-type,
- auth scheme,
- user éventuel,
- status,
- contenu d’erreur éventuel,
- stage de traitement.

### `projects/oneteme/inspect-ng-collector/src/lib/global-error-handler.service.ts`
Capture les erreurs Angular globales et les rattache à la session active.

### `projects/oneteme/inspect-ng-collector/src/lib/navigation.monitor.ts`
Surveille :
- `Router.events`,
- `pageshow` pour le BFCache,
- `beforeunload`.

### `projects/oneteme/inspect-ng-collector/src/lib/user-action.monitor.ts`
Capture des événements DOM (click, change, scrollend, dragend, etc.) et tente d’extraire un nom lisible de l’élément ciblé.

### `projects/oneteme/inspect-ng-collector/src/lib/resource-usage.monitor.ts`
Ajoute des métriques mémoire avant export si `performance.memory` est disponible.

### `projects/oneteme/inspect-ng-collector/src/lib/traceable-stage.decorator.ts`
Décorateur pour tracer des méthodes locales avec début/fin et exception éventuelle.

### `projects/oneteme/inspect-ng-collector/src/lib/log.service.ts`
Expose `info`, `warn`, `error` pour injecter des logs corrélés à la session courante.

### `projects/oneteme/inspect-ng-collector/src/lib/event-trace-debugger.ts`
Outil de debug console interne. Semble partiellement désaligné avec les `@type` effectivement émis dans le reste du code.

### `projects/oneteme/inspect-ng-collector/src/lib/storage-event-trace.service.ts`
Code incomplet / non branché réellement pour le suivi des événements `localStorage` / `sessionStorage`.

## Modèle de configuration actuellement attendu
La configuration réelle dans le code est **imbriquée** et non plus plate.

Structure actuelle :
- `enabled?: boolean`
- `debugMode?: boolean`
- `scheduling?.interval?: number`
- `monitoring?.httpRoute?.excludes?.path?: RegExp[] | (() => RegExp[])`
- `monitoring?.httpRequest?.excludes?.host?: string[]`
- `monitoring?.resources?.enabled?: boolean`
- `monitoring?.analytics?.enabled?: boolean`
- `monitoring?.storage?.enabled?: boolean`
- `monitoring?.name: string | (() => string)`
- `monitoring?.version?: string | (() => string)`
- `monitoring?.env?: string | (() => string)`
- `monitoring?.user?: string | (() => string)`
- `monitoring?.additionalProperties: () => { [key: string]: any }`
- `tracing?.queueCapacity?: number`
- `tracing?.delayIfPending?: number`
- `tracing?.remote?.host?: string`
- `tracing?.remote?.mode?: string`
- `tracing?.remote?.retentionMaxAge?: number`

## Endpoints backend observés dans le code
Dans `ContextManager.validateAndGetConfig(...)`, les endpoints sont actuellement fixés en dur :
- `v4/trace/instance`
- `v4/trace/instance/:id/session`

Ils sont construits à partir de `tracing.remote.host`.

## Types de données / traces observés
Le modèle principal est dans `projects/oneteme/inspect-ng-collector/src/lib/trace.model.ts`.

Types importants :
- `InstanceEnvironment`
- `MainSession`
- `MainSessionCallBack`
- `SessionMaskUpdate`
- `RestRequest`
- `RestRequestCallBack`
- `HttpRequestStage`
- `LocalRequest`
- `LocalRequestCallBack`
- `UserAction`
- `LogEntry`
- `MachineRessourceUsage`

## Données collectées par la lib
La lib peut collecter :
- identité de l’application (`name`, `version`, `env`),
- identité technique du client (browser, OS, client id local),
- utilisateur fourni par config,
- parfois utilisateur déduit du header `Authorization`,
- navigation et URL,
- requêtes/réponses HTTP,
- erreurs globales,
- actions utilisateur,
- métriques mémoire,
- logs métiers,
- propriétés additionnelles métier.

## Incohérences / points d’attention
### 1. Documentation racine désalignée
Le `README.md` racine documente une ancienne configuration plate (`host`, `instanceApi`, `sessionApi`, `exclude`, `delay`, `bufferMaxSize`, `debug`), alors que le code attend une structure imbriquée avec `monitoring`, `tracing`, `scheduling`, `debugMode`.

### 2. Endpoints hardcodés
Le code ne lit plus `instanceApi` / `sessionApi` depuis la config, contrairement à ce que suggère la doc.

### 3. Debugger probablement legacy
`event-trace-debugger.ts` semble attendre des `@type` textuels (`main-ses`, `http-req`, etc.) alors que le reste du code émet surtout des `@type` numériques sous forme de chaînes (`'10'`, `'11'`, `'03'`, `'110'`, `'111'`, `'121'`, `'220'`, `'300'`, `'00'`, `'01'`).

### 4. Suspicion d’erreur de type dans `RestRequestMonitor`
`preProcess()` envoie un `RestRequest` avec `@type: '121'`, ce qui semble se chevaucher avec `RestRequestCallBack`.

### 5. Suspicion sur le masque de session
Dans `SessionManager.initRestRequest(...)`, la mise à jour du `requestMask` utilise `&=` ; cela paraît possiblement incorrect si l’intention était d’activer un bit.

### 6. Suivi storage incomplet
Le fichier `storage-event-trace.service.ts` contient du code préparatoire mais la fonctionnalité n’est pas pleinement activée.

### 7. Dépendance forte au navigateur
Le code repose directement sur `window`, `document`, `localStorage`, `performance`, `crypto.randomUUID()` ; la lib est pensée pour un contexte navigateur.

## Résumé fonctionnel court
C’est une bibliothèque Angular de monitoring / tracing navigateur qui crée des sessions liées à la navigation, capture des événements applicatifs et techniques, puis les envoie à un backend de collecte.

## Convention pour les prochaines questions
Quand une future réponse s’appuie sur ce mémo, prendre ce fichier comme base de contexte de référence : `PROJECT_CONTEXT.md`.

## Limites de ce mémo
Ce document reflète l’état lu dans le dépôt au moment de sa création. Si le code change, il faut le mettre à jour.

