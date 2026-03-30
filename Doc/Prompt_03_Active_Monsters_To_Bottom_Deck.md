# Prompt 03 - Action per mettere in fondo al Monster Deck le carte Active Monster

Agisci direttamente sul progetto HeroToSlay e implementa la feature end-to-end, facendo modifiche reali ai file e verificando i test.

## Obiettivo funzionale

1. Deve esistere una action per spostare una carta dalla zona Active Monsters al fondo del Monster Deck.
2. La action deve funzionare su una carta specifica (scelta cardId), non solo su una carta casuale.
3. Dopo l'azione, lo slot in activeMonsters deve diventare vuoto (null) e la carta deve essere inserita in coda a monsterDeck.
4. La carta rimessa nel deck deve essere coperta e non associata a un owner.

## Vincoli tecnici

1. Riusa il flusso esistente request_action + approval queue + restricted_log.
2. Non rompere le azioni gia presenti su active monster (es. TAKE_MONSTER, REVEAL_MONSTER).
3. Mantieni naming e stile coerenti con il progetto.

## File probabili da aggiornare

1. Srcs/public/components/GameView.js
2. Srcs/public/components/CenterTable.js
3. Srcs/server/game/GameManager.js
4. test/unit/GameManager.test.js
5. test/integration/game.test.js oppure test/integration/approval.test.js

## Implementazione attesa

1. Introduci un nuovo action type server-side, ad esempio RETURN_ACTIVE_MONSTER_TO_BOTTOM.
2. In GameManager:
   - aggiungi il nuovo type nei supportedActionTypes;
   - aggiungi describeAction per il nuovo type;
   - implementa handler dedicato che trova la carta in activeMonsters tramite cardId (o slotIndex opzionale), la rimuove dagli active slot e la inserisce in fondo a monsterDeck;
   - prima del push in monsterDeck, imposta ownerId = null e isFaceUp = false.
3. In UI (context menu):
   - sulla zona active-monster aggiungi opzione tipo Return to bottom of Monster Deck;
   - l'azione deve inviare request_action con payload contenente almeno cardId.
4. Garantisci comportamento corretto con Approval Mode ON e OFF.

## Casi limite da coprire

1. Nessuna carta nello slot selezionato: nessuna mutazione stato.
2. cardId inesistente: nessuna mutazione stato.
3. Monster deck inizialmente vuoto: la carta viene comunque inserita come prima in coda.

## Test richiesti

1. Unit test su GameManager:
   - la carta active scelta viene rimossa da activeMonsters;
   - la carta finisce in fondo a monsterDeck;
   - ownerId e isFaceUp sono resettati correttamente.
2. Integration test:
   - flow request_action + approvazione + state_update coerente.

## Criteri di accettazione

1. Da context menu su Active Monsters compare la nuova action.
2. Eseguendo la action, la carta scompare dallo slot active e va in fondo al Monster Deck.
3. L'azione compare nel restricted action history.
4. Nessuna regressione sulle azioni esistenti.
5. Test verdi.

## Output finale richiesto

1. Elenco file modificati.
2. Breve spiegazione delle scelte.
3. Test eseguiti e risultato.
