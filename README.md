
## Installation 
```sh
$ npm i @oneteme/inspect-ng-collector
```
  
## Utilisation 
Tout d'abord, importer le **NgCollectorModule** dans le module de votre application.

```ts
// app.module.ts
...
import { NgCollectorModule } from '@oneteme/inspect-ng-collector';
import { environment } from 'src/environments/environment';

@NgModule({
  declarations: [...],
  imports: [
    ...
    NgCollectorModule.forRoot(environment.application),
  ]
})
export class AppModule{} 
```
## Configuration 
La bibliothèque nécessite certaines configurations pour fonctionner correctement. ces configurations doivent être fournies lors de l'initialisation du module.

```ts
// app.module.ts
export const environment = {
    ...
    application: {
        host: `https://backend-url.fr`,
        name: "ihm-name",
        version: "0.0.0",
        env: 'dev/rec...',
        user: () => '',
        instanceApi: 'v3/trace/instance', // instance endpoint
        sessionApi: 'v3/trace/instance/:id/session', // sessions endpoint
        exclude:  [/scope/], // routes to exclude
        delay : 60000,  // trace frequency
        bufferMaxSize: 1000, // maximum number of sessions
        debug: true, // enable debug mode
        enabled: false
    }
};
```

## Référence API

| Request                                                | Description        |  Valeur par défaut    | obligatoire | 
|--------------------------------------------------------|--------------|----|----|
| enabled                                                | **boolean**       |   false  | x  | 
| host                                                   | **string**   |   null  | x  | 
| name                                                   | **string\|(()=>string)** |    null  | x  |
| env                                                    | **string\|(()=>string)** | null | x| 
| instanceApi                                            | **string\|(()=>string)** |    null | x  |
| sessionApi                                             | **string\|(()=>string)**   |   null  | x   |
| exclude                                                | **RegExp[]\|(()=>RegExp[])** |   []  | x   |
| delay                                                  | **number \|(()=>number )** |   60000ms  | optionnel   |
| bufferMaxSize                                          | **number \|(()=>number )**   |    1000  | optionnel  |
| debug                                                  | **boolean**  |   false  | optionnel  | 
| version                                                | **string\|(()=>string)**  | null  |  optionnel  |  
| user                                                   | **string\|(()=>string)**   | null  | optionnel   |  

