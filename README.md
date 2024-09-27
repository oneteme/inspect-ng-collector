
## Installation 
```sh
$ npm i @oneteme/inspect-ng-collector
```
  
## Integration 
Tout d'abord, importer le **NgCollectorModule** dans le module de votre application.

```ts
// <your_app_module>.ts
...
import { environment } from 'src/environments/environment';
import { NgCollectorModule } from '@oneteme/inspect-ng-collector';

@NgModule({
  declarations: [...],
  imports: [
    ...
    NgCollectorModule.forRoot(environment.application),
  ],
  ...
})
export class <your_app_module>{} 
```
## Configuration 
La bibliothèque nécessite certaines configurations pour fonctionner correctement. ces configurations doivent être fournies lors de l'initialisation du module.

```ts
// app.module.ts
export const environment = {
    ...
    application: {
        host: `https://backend-url.fr`,
        name: "<your-app-name>",
        version: "0.0.0",
        env: '<app_environement>',
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
| delay                                                  | **number \|(()=>number )** |   60000ms  |  |
| bufferMaxSize                                          | **number \|(()=>number )**   |    1000  |  |
| debug                                                  | **boolean**  |   false  |  | 
| version                                                | **string\|(()=>string)**  | null  |   |  
| user                                                   | **string\|(()=>string)**   | null  |  |  

