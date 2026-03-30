# Prompt 04 - Fix doppio log dei dadi

Agisci direttamente sul progetto HeroToSlay e risolvi il problema del doppio log quando un giocatore lancia i dadi.

## Obiettivo funzionale

1. Un singolo roll_dice deve produrre una sola entry in Event Log.
2. Deve restare visibile il risultato del dado nella UI (last dice roll) senza duplicare il messaggio nel log.

## Contesto tecnico atteso

Attualmente il doppio log puo avvenire perche:
1. Il server emette event_log in risposta a roll_dice.
2. Il client aggiunge un altro evento anche quando riceve dice_result.

## File probabili da aggiornare

1. Srcs/public/app.js
2. Srcs/server/socket/gameHandlers.js
3. test/integration/game.test.js (aggiungere verifica anti-duplicazione)

## Implementazione attesa

1. Scegli una sola fonte di verita per il messaggio di log del dado (consigliato: server event_log).
2. Mantieni dice_result usato solo per aggiornare lastDiceRoll (e UI correlate), senza prepend duplicato nel log client.
3. Non cambiare il payload pubblico degli eventi socket salvo necessita reale.
4. Mantieni invariati i controlli spectator e gameInProgress gia presenti.

## Test richiesti

1. Aggiungi/aggiorna un test di integrazione che verifica:
   - dopo roll_dice arriva dice_result;
   - arriva una sola event_log entry relativa al roll.
2. Esegui test unit/integration rilevanti e correggi eventuali regressioni.

## Criteri di accettazione

1. Un lancio dado produce un solo messaggio nel log eventi.
2. lastDiceRoll continua ad aggiornarsi correttamente.
3. Nessuna regressione su altri eventi di gioco.
4. Test verdi.

## Output finale richiesto

1. Elenco file modificati.
2. Causa radice del doppio log e fix applicato.
3. Test eseguiti e risultato.
