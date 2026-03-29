# Hero to Slay — Tabletop Simulator
## Copilot Agent Task Breakdown

> **How to use:** Open VS Code in your repo root. Switch Copilot Chat to **Agent Mode** with **GPT-4.5** (or Claude Sonnet if available). Paste one task at a time. Wait for the agent to finish and verify before moving to the next.

---

## TASK 1 — Project Scaffold & Data Models

**Goal:** Create the folder structure, dependencies, and the three core data model classes.

```
### CONTEXT
You are building a "Hero to Slay" digital tabletop simulator.
This is a private web app for friends, running on localhost via Docker.
No auth, no HTTPS, no game rule enforcement needed.
Tech stack: Node.js 20, Express 4, Socket.io 4, Vue 3 via CDN.
All identifiers, comments, and UI text must be in ENGLISH.
Write every file in its entirety — no placeholders, no truncation, no "// TODO".

### TASK
Create the following files from scratch:

1. package.json
   - name: "hero-to-slay-simulator"
   - dependencies: express, socket.io, uuid
   - devDependencies: jest, socket.io-client
   - scripts:
       "start": "node server/server.js"
       "index": "node indexer.js"
       "test": "jest --runInBand"
       "test:unit": "jest test/unit --runInBand"
       "test:integration": "jest test/integration --runInBand"
       "test:coverage": "jest --coverage --runInBand"
   - jest config (in package.json):
       { "testEnvironment": "node", "testTimeout": 10000, "forceExit": true }

2. server/models/Card.js
   Implement exactly this class:
   class Card {
     constructor(id, name, type, path)
     // Properties: id (int), name (string), type ('hero'|'monster'),
     //             path (string), isFaceUp (bool, default false),
     //             ownerId (string|null, default null)
   }
   Export with module.exports = Card.

3. server/models/Deck.js
   Implement exactly this class:
   class Deck {
     constructor(type, cards[])   // type: 'hero'|'monster'
     shuffle()                    // Fisher-Yates in-place
     draw()                       // returns Card|null, removes from top
     peek(n)                      // returns top-n Cards without removing
     get size()                   // int: remaining cards
   }
   Export with module.exports = Deck.

4. server/models/Player.js
   Implement exactly this class:
   class Player {
     constructor(id, nickname, socketId)
     // Properties: id (string/uuid), nickname, socketId,
     //             hand[] (Card[], default []), board[] (Card[], default [])
   }
   Export with module.exports = Player.

Each file must begin with this comment header:
// ============================================================
// FILE: <relative/path/to/file>
// ============================================================

After creating all files, run: npm install
```

---

## TASK 2 — Indexer Script

**Goal:** Create the standalone script that scans asset folders and generates `cards.json`.

```
### CONTEXT
Continuing the Hero to Slay tabletop simulator project.
card_back images are NOT indexed — they are global UI constants.
All identifiers and comments must be in ENGLISH.
Write the file in its entirety — no placeholders, no truncation.

### TASK
Create indexer.js in the project root.

This is a standalone Node.js script (not part of the server). It must:
- Scan /Assets/Cards/Heroes/ → assign type: "hero"
- Scan /Assets/Cards/Monsters/ → assign type: "monster"
- Accept only image files (.png, .jpg, .jpeg, .webp)
- Output cards.json as an array of objects:
  { "id": <int, auto-incremented>, "name": <string, filename without extension>,
    "path": <string, relative URL path for serving, e.g. "/Assets/Cards/Heroes/card.png">,
    "type": "hero" | "monster" }
- Log how many hero and monster cards were found
- Overwrite cards.json if it already exists
- Exit with code 1 if both folders are empty or missing

Note: These two files are NOT indexed, just referenced directly by the UI:
  /Assets/Cards/hero_card_back.png
  /Assets/Cards/monster_card_back.png

File header:
// ============================================================
// FILE: indexer.js
// ============================================================
```

---

## TASK 3 — Game Logic: RestrictedLog, ApprovalQueue, GameManager

**Goal:** Implement the three core server-side game logic classes.

```
### CONTEXT
Continuing the Hero to Slay tabletop simulator.
Card, Deck, Player classes already exist in server/models/.
No game rule enforcement — the server is a tool, not a referee.
All identifiers and comments must be in ENGLISH.
Write every file in its entirety — no placeholders, no truncation.

### TASK
Create these three files:

---

1. server/game/RestrictedLog.js
   Append-only log of every executed Restricted Action.
   class RestrictedLog {
     constructor()
     // Properties: entries[] (array of log entry objects)
     
     append(entry)
     // entry shape: { timestamp, playerNickname, actionType, details, approvedBy }
     // Formats and stores: "[HH:MM:SS] PlayerX → ACTION_TYPE (details) [APPROVED by PlayerY]"
     // For UNDO entries format: "[HH:MM:SS] PlayerX → UNDO ← reverted above action [APPROVED by PlayerY]"
     
     getAll()   // returns full entries array
     clear()    // resets entries to []
   }
   module.exports = RestrictedLog;

---

2. server/game/ApprovalQueue.js
   Manages one pending restricted action at a time.
   class ApprovalQueue {
     constructor(io)
     // io: Socket.io server instance for emitting events
     
     enqueue(action, onApproved, onDenied)
     // action shape: { actionId, type, requesterId, requesterNickname, payload, details }
     // If queue is busy, new actions wait (sequential queue, not dropped)
     // Starts a 30-second timeout — if no response, auto-denies
     
     approve(actionId, approverId, approverNickname)
     // Resolution: if ≥1 approves AND 0 denials → execute (call onApproved)
     // Clears timeout, processes next queued action
     
     deny(actionId, denier, denierNickname)
     // Any single denial → immediate rejection (call onDenied)
     // Clears timeout, processes next queued action
     
     clear()  // resets queue (on game reset)
   }
   module.exports = ApprovalQueue;

---

3. server/game/GameManager.js
   Singleton managing all game state.
   class GameManager {
     constructor(io, cards)
     // io: Socket.io instance
     // cards: raw array from cards.json
     
     startGame(players)
     // players: Player[] — initializes full game state
     // Builds hero Deck and monster Deck from cards[]
     // Deals 0 cards to start (players draw manually)
     // Sets phase to 'playing'
     
     getState()
     // Returns deep-clone of current GameState object (shape below)
     
     getStateForPlayer(playerId)
     // Returns getState() but replaces other players' hand[] with stubs:
     // { id: card.id, isFaceUp: false, ownerId: card.ownerId }
     // Never expose name or path of face-down hand cards of other players
     
     pushHistory()
     // Deep-clones current state and pushes to historyStack[]
     // Called BEFORE every Restricted Action executes
     
     undo()
     // Pops last snapshot from historyStack and restores state
     // If historyStack is empty, does nothing (no crash)
     
     executeAction(action, approverId, approverNickname)
     // Dispatches action by type, calls pushHistory() first, then mutates state
     // Action types: DRAW_HERO, REVEAL_MONSTER, TAKE_MONSTER,
     //               TAKE_FROM_OPPONENT, DISCARD_CARD, UNDO
     // After execution: broadcasts state_update to all clients (filtered per player),
     //                  appends to RestrictedLog, broadcasts restricted_log
     
     requestAction(action, requesterId)
     // If approvalMode is OFF (and action type is not UNDO): execute immediately
     // If approvalMode is ON (or action is UNDO): enqueue in ApprovalQueue
     
     toggleApprovalMode()
     // Flips approvalMode boolean, broadcasts state_update to all
     
     broadcastState()
     // Sends filtered state_update to each connected player individually
     
     reset()
     // Resets state to 'lobby' phase, clears history, clears log
   }

   // GameState shape (plain serializable object):
   // {
   //   players: Player[],
   //   heroDeck: Card[],
   //   monsterDeck: Card[],
   //   activeMonsters: (Card|null)[],  // always length 3, null = empty slot
   //   discardPile: Card[],
   //   approvalMode: bool,             // default true
   //   phase: 'lobby' | 'playing' | 'ended'
   // }

   module.exports = GameManager;

File headers required on each file:
// ============================================================
// FILE: server/game/<filename>
// ============================================================
```

---

## TASK 4 — Socket.io Handlers & Server Entry Point

**Goal:** Wire up all Socket.io events and create the Express server.

```
### CONTEXT
Continuing the Hero to Slay tabletop simulator.
All game logic classes exist in server/models/ and server/game/.
One lobby, one game at a time. Max 4 players.
All identifiers and comments must be in ENGLISH.
Write every file in its entirety — no placeholders, no truncation.

### SOCKET.IO EVENT CONTRACT (implement ALL of these, no extras needed)

Client → Server:
  join_lobby       { nickname }
  start_game       {}
  request_action   { type, payload }
  respond_approval { actionId, decision }   // decision is bool
  flip_card        { cardId, zone }         // zone: 'hand'|'board'
  view_discard     {}
  roll_dice        {}
  toggle_approval  {}
  reset_lobby      {}

Server → Client:
  lobby_update     { players: [{id,nickname}], gameInProgress }
  game_start       { yourPlayerId }
  state_update     GameState filtered via getStateForPlayer()
  approval_request { actionId, type, requesterNickname, details }
  approval_result  { actionId, granted, approverNickname }
  event_log        { message, timestamp }
  restricted_log   full restricted action history array
  dice_result      { nickname, result }
  error            { message }

### TASK
Create these four files:

---

1. server/socket/lobbyHandlers.js
   Handles: join_lobby, start_game, reset_lobby, disconnect
   
   join_lobby logic:
   - Reject if game is in progress → emit error
   - Reject if queue already has 4 players → emit error
   - Reject if nickname is empty or already taken → emit error
   - Add player to queue, broadcast lobby_update to all
   
   start_game logic:
   - Reject if fewer than 2 players in queue → emit error
   - Call gameManager.startGame(players)
   - Emit game_start to each player with their yourPlayerId
   - Broadcast initial state_update to each player (filtered)
   
   reset_lobby logic:
   - Call gameManager.reset()
   - Broadcast lobby_update with empty queue, gameInProgress: false
   
   disconnect logic:
   - Remove player from queue or active game
   - If game was in progress and a player disconnects, broadcast event_log notice
   - Broadcast updated lobby_update or state_update

---

2. server/socket/approvalHandlers.js
   Handles: respond_approval
   
   respond_approval logic:
   - Find the pending action by actionId
   - If decision is true: call approvalQueue.approve(...)
   - If decision is false: call approvalQueue.deny(...)
   - Broadcast approval_result to all players

---

3. server/socket/gameHandlers.js
   Handles: request_action, flip_card, view_discard, roll_dice, toggle_approval
   
   request_action:
   - Validate that requester is a connected player
   - Call gameManager.requestAction(action, requesterId)
   
   flip_card (FREE action — no approval):
   - Player can only flip their own cards
   - Toggle isFaceUp on the card in the specified zone ('hand'|'board')
   - Broadcast state_update to all (filtered)
   - Emit event_log: "[nickname] flipped a card [face-up|face-down]"
   
   view_discard (FREE action):
   - Emit the full discardPile array only to the requesting socket
   
   roll_dice (FREE action):
   - Generate random int 1–12
   - Emit dice_result to all: { nickname, result }
   - Emit event_log to all: "[nickname] rolled a [result]"
   
   toggle_approval:
   - Call gameManager.toggleApprovalMode()
   - Emit event_log: "[nickname] turned Approval Mode [ON|OFF]"

---

4. server/server.js
   Express + Socket.io entry point.
   - Loads cards.json from project root (exit with error if missing — run indexer.js first)
   - Serves /Assets folder as static (read-only volume mount)
   - Serves /public folder as static
   - Creates GameManager singleton
   - Registers all socket handlers (lobby, game, approval)
   - Listens on port 3000
   - Logs "Server running on http://localhost:3000" on start

File headers required on each file:
// ============================================================
// FILE: server/<path/to/file>
// ============================================================
```

---

## TASK 5 — Frontend: Shell, App Entry & Utility Components

**Goal:** Create the HTML shell, Vue 3 app entry point, and all small utility components.

```
### CONTEXT
Continuing the Hero to Slay tabletop simulator.
Frontend: Vue 3 via CDN only — no Vite, no build step, no .vue SFC files.
Each component is a plain .js file that registers itself via app.component().
Socket.io client is loaded via CDN script tag.
All identifiers and UI text must be in ENGLISH.
Write every file in its entirety — no placeholders, no truncation.

### VISUAL STYLE
- Background: CSS url('/Assets/Miscellaneous/table_background.png'), fallback #1a1a2e
- Card size on table: 80×112px
- Card size in FocusPreview: 240×336px
- Hero card back: /Assets/Cards/hero_card_back.png
- Monster card back: /Assets/Cards/monster_card_back.png
- Card front: path from cards.json served via Express static
- Card hover: scale(1.08), 150ms ease transition
- Fonts: monospace for logs, sans-serif for all other UI
- Active Monster Slots: always show 3 outlined placeholder boxes even if empty

### TASK
Create these files:

---

1. public/index.html
   - Loads Vue 3 from CDN (unpkg or jsdelivr)
   - Loads Socket.io client from CDN
   - Links to /style.css
   - Has a single <div id="app"></div>
   - Loads /app.js and all component files as ES module scripts
     (use type="module" only if needed, otherwise plain script tags in correct order)

---

2. public/components/ApprovalToggle.js
   Registers component: 'approval-toggle'
   Props: approvalMode (bool)
   Emits: toggle
   Renders: clearly visible ON/OFF switch button showing current mode.
   Label: "Approval Mode: ON" or "Approval Mode: OFF"
   Visual: green when ON, grey when OFF.

---

3. public/components/DiceRoller.js
   Registers component: 'dice-roller'
   Emits: roll
   Renders: a "Roll Dice (d12)" button.
   Shows the last roll result next to the button if available.
   Props: lastRoll (int|null)

---

4. public/components/FocusPreview.js
   Registers component: 'focus-preview'
   Props: card (Card object | null)
   Renders: fixed panel on the right side of the screen, 240×336px.
   Shows the card image at full size if card is not null AND card.isFaceUp is true.
   Hidden (display:none) if card is null or face-down.
   Shows card name below the image.

---

5. public/components/ContextMenu.js
   Registers component: 'context-menu'
   Props: visible (bool), x (int), y (int), options (Array of {label, action})
   Emits: select(action), close
   Renders: absolutely positioned menu at (x,y), z-index 1000.
   Disappears when clicking outside.
   Options vary by card zone (passed in from parent as the options prop).

---

6. public/components/ApprovalPopup.js
   Registers component: 'approval-popup'
   Props: request (object | null) — shape: { actionId, type, requesterNickname, details }
   Emits: approve(actionId), deny(actionId)
   Renders: centered modal overlay with semi-transparent dark background.
   Shows: "[requesterNickname] wants to [details]"
   Two buttons: "Approve" (green) and "Deny" (red).
   Hidden if request is null.
   IMPORTANT: The requesting player must NOT see this popup.
   The parent controls visibility — this component just renders when request is not null.

---

7. public/components/EventLog.js
   Registers component: 'event-log'
   Props: entries (Array of {message, timestamp})
   Renders: scrollable sidebar panel, newest entry on top.
   Font: monospace. Max height with overflow-y: auto.
   Each entry shows: [HH:MM:SS] message

---

8. public/components/RestrictedLog.js
   Registers component: 'restricted-log'
   Props: entries (Array of strings — pre-formatted by server)
   Renders: separate scrollable panel (not the same as EventLog).
   Title: "Restricted Action History"
   Font: monospace. Newest entry on top.
   UNDO entries visually distinguished (e.g. different text color or ↩ prefix).

File headers:
// ============================================================
// FILE: public/components/<filename>
// ============================================================
```

---

## TASK 6 — Frontend: Board Components

**Goal:** Create the game board layout components — the center table, player zones, and both main views.

```
### CONTEXT
Continuing the Hero to Slay tabletop simulator.
Vue 3 via CDN. All small utility components from Task 5 already exist.
The full Socket.io event contract is defined below for reference.
All identifiers and UI text must be in ENGLISH.
Write every file in its entirety — no placeholders, no truncation.

### SOCKET.IO EVENTS (client emits these):
  request_action   { type, payload }
    action types: DRAW_HERO, REVEAL_MONSTER, TAKE_MONSTER,
                  TAKE_FROM_OPPONENT, DISCARD_CARD, UNDO
  respond_approval { actionId, decision }
  flip_card        { cardId, zone }
  view_discard     {}
  roll_dice        {}
  toggle_approval  {}
  reset_lobby      {}

### CONTEXT MENU OPTIONS BY ZONE:
  Own hand card   → [Flip, Discard]
  Own board card  → [Flip, Discard]
  Hero Deck       → [Draw, Shuffle]
  Monster Deck    → [Reveal top card, Shuffle]
  Active Monster  → [Take to my board]
  Opponent hand   → [Take (steal)]
  Discard Pile    → [View full pile]

### TASK
Create these files:

---

1. public/components/CardComponent.js
   Registers component: 'card-component'
   Props:
     card (object): { id, name, type, path, isFaceUp, ownerId }
     zone (string): 'hand' | 'board' | 'hero-deck' | 'monster-deck' | 'active-monster' | 'discard'
     isOwn (bool): whether the local player owns this card
   Emits: hover(card), unhover, rightclick({ card, zone, x, y })
   
   Renders:
   - If isFaceUp: show card front image using card.path
   - If face-down: show hero_card_back.png or monster_card_back.png based on card.type
   - Size: 80×112px
   - On mouseenter: emit hover(card)
   - On mouseleave: emit unhover
   - On contextmenu: emit rightclick with coordinates, prevent default browser menu
   - Hover CSS: scale(1.08), 150ms ease

---

2. public/components/CenterTable.js
   Registers component: 'center-table'
   Props:
     heroDeck (Card[]): the hero deck cards
     monsterDeck (Card[]): the monster deck cards
     activeMonsters (Card|null)[]): always length 3
     discardPile (Card[])
   Emits: card-hover(card), card-unhover, card-rightclick({card, zone, x, y})
   
   Renders:
   - Hero Deck: face-down stack (show count). Right-click → [Draw, Shuffle]
   - Monster Deck: face-down stack (show count). Right-click → [Reveal top card, Shuffle]
   - Active Monster Slots: always 3 slots. Each shows the monster card if present,
     or an outlined empty placeholder if null. Right-click on card → [Take to my board]
   - Discard Pile: shows top card face-up. Shows "(N cards)" count. Right-click → [View full pile]
   - Layout: all four elements in a horizontal row with 12px gap

---

3. public/components/PlayerZone.js
   Registers component: 'player-zone'
   Props:
     player (Player object)
     isLocal (bool): true if this is the local player's zone
     position (string): 'bottom' | 'top' | 'left' | 'right'
   Emits: card-hover(card), card-unhover, card-rightclick({card, zone, x, y})
   
   Renders:
   - Player nickname label
   - Hand area: row of card-components. If not isLocal, cards are shown as stubs
     (face-down, no image exposed). Right-click on own card → [Flip, Discard].
     Right-click on opponent card → [Take (steal)]
   - Board area: row of face-up card-components visible to all.
     Right-click on own board card → [Flip, Discard]
   - CSS rotation applied via position prop:
       top → rotate(180deg), left → rotate(90deg), right → rotate(-90deg), bottom → none

---

4. public/components/LobbyView.js
   Registers component: 'lobby-view'
   Props: players ([{id, nickname}]), gameInProgress (bool)
   Emits: join(nickname), start
   
   Renders:
   - If gameInProgress: show "Game in progress — please wait" message only
   - Otherwise:
       - Nickname text input + "Join Queue" button
       - Live list of queued players (nicknames)
       - "Start Game" button (disabled if fewer than 2 players in list)
       - Player count: "X / 4 players"

---

5. public/components/GameView.js
   Registers component: 'game-view'
   Props:
     gameState (full filtered GameState object)
     localPlayerId (string)
     pendingApproval (object|null)
     eventLogEntries ([])
     restrictedLogEntries ([])
     lastDiceRoll (int|null)
     approvalMode (bool)
   Emits: (all user actions — delegates to socket via app.js)
   
   Renders:
   - 4-sided CSS Grid layout:
       Center cell: <center-table>
       Bottom cell: local player's <player-zone position="bottom">
       Top cell: first opponent's <player-zone position="top">
       Left cell: second opponent's <player-zone position="left"> (if exists)
       Right cell: third opponent's <player-zone position="right"> (if exists)
   - Fixed right panel: <focus-preview> (card hovered)
   - Fixed left panel: <event-log> + <restricted-log> stacked
   - Top bar: <approval-toggle>, <dice-roller>, "Undo" button, "Reset" button
   - <approval-popup> overlay (shown only to non-requesters)
   - <context-menu> rendered at cursor position when active
   - Handles all hover/unhover/rightclick events from child components,
     builds context menu options array based on zone and ownership,
     emits correct socket events on context menu selection

---

6. public/app.js
   Vue 3 createApp entry point.
   
   - Creates the Vue app
   - Registers all components (lobby-view, game-view, card-component,
     center-table, player-zone, approval-toggle, dice-roller,
     focus-preview, context-menu, approval-popup, event-log, restricted-log)
   - Connects to Socket.io (auto-detects host: window.location.origin)
   - Root data/state:
       view: 'lobby' | 'game'
       localPlayerId: null
       lobbyPlayers: []
       gameInProgress: false
       gameState: null
       pendingApproval: null
       eventLog: []
       restrictedLog: []
       lastDiceRoll: null
   - Socket event listeners:
       lobby_update   → update lobbyPlayers, gameInProgress
       game_start     → set localPlayerId, switch view to 'game'
       state_update   → update gameState
       approval_request → set pendingApproval (only if localPlayerId !== requester)
       approval_result  → clear pendingApproval, push to eventLog
       event_log      → prepend to eventLog (newest on top)
       restricted_log → replace restrictedLog array
       dice_result    → set lastDiceRoll, push to eventLog
       error          → console.error + optional UI toast
   - Methods that emit to socket:
       joinLobby(nickname)
       startGame()
       requestAction(type, payload)
       respondApproval(actionId, decision)
       flipCard(cardId, zone)
       viewDiscard()
       rollDice()
       toggleApproval()
       resetLobby()

File headers:
// ============================================================
// FILE: public/<path/to/file>
// ============================================================
```

---

## TASK 7 — Stylesheet

**Goal:** Create the complete CSS for the 4-sided board layout, card styling, and all UI panels.

```
### CONTEXT
Continuing the Hero to Slay tabletop simulator.
All Vue components exist. This is the only CSS file for the entire app.
All class names referenced in the components must be styled here.
Write the file in its entirety — no truncation.

### TASK
Create public/style.css with the following requirements:

GLOBAL:
- box-sizing: border-box on *
- Background: url('/Assets/Miscellaneous/table_background.png') center/cover,
  fallback color #1a1a2e
- Font: sans-serif default, monospace for .log-panel and children
- No scrollbars on body (overflow: hidden)

4-SIDED BOARD LAYOUT (.game-board):
- CSS Grid with named areas:
    "top-player    top-player    top-player"
    "left-player   center-table  right-player"
    "bottom-player bottom-player bottom-player"
- Center cell fixed size: roughly 400px wide × 200px tall
- Player zones take remaining space
- Full viewport height

PLAYER ZONE ROTATIONS (.player-zone):
- position="top"   → transform: rotate(180deg)
- position="left"  → transform: rotate(90deg)
- position="right" → transform: rotate(-90deg)
- position="bottom"→ no transform

CENTER TABLE (.center-table):
- Horizontal flex row, gap: 12px, align center
- Semi-transparent dark background (rgba(0,0,0,0.5)), border-radius: 12px, padding: 16px

CARD (.card):
- Width: 80px, height: 112px
- border-radius: 6px
- cursor: pointer
- transition: transform 150ms ease
- box-shadow: 0 2px 6px rgba(0,0,0,0.5)
- img inside: width 100%, height 100%, object-fit: cover, border-radius: 6px

CARD HOVER:
- transform: scale(1.08)

EMPTY MONSTER SLOT (.monster-slot-empty):
- Same dimensions as .card (80×112px)
- Border: 2px dashed rgba(255,255,255,0.3)
- Border-radius: 6px
- Background: rgba(255,255,255,0.05)

FOCUS PREVIEW (.focus-preview):
- Position: fixed, right: 16px, top: 50%, transform: translateY(-50%)
- Width: 240px, height: 336px + label space
- z-index: 100
- Hidden by default (display:none), shown via Vue v-show

CONTEXT MENU (.context-menu):
- Position: fixed (x/y set via inline style)
- Background: #2a2a3e, border: 1px solid rgba(255,255,255,0.2)
- Border-radius: 8px, padding: 4px 0, z-index: 1000
- Each item (.context-menu-item): padding 8px 16px, cursor pointer
- Hover on item: background rgba(255,255,255,0.1)

APPROVAL POPUP (.approval-popup-overlay):
- Position: fixed, inset: 0
- Background: rgba(0,0,0,0.6), z-index: 500
- Display flex, align/justify center
- Inner box (.approval-popup-box): background #2a2a3e, border-radius: 12px,
  padding: 24px, min-width: 300px, text-align: center

APPROVE/DENY BUTTONS:
- .btn-approve: background #27ae60, color white, border-radius 6px, padding 8px 24px
- .btn-deny: background #c0392b, color white, border-radius 6px, padding 8px 24px
- Both: cursor pointer, border none, font-size 1rem

LOG PANELS (.log-panel):
- Position: fixed, left: 0
- Width: 280px, font: monospace, font-size: 0.75rem
- Background: rgba(0,0,0,0.7), color: #ccc, border-radius: 0 8px 8px 0
- Overflow-y: auto, padding: 8px
- .event-log: top: 0, max-height: 40vh
- .restricted-log: top: 42vh, max-height: 40vh

TOP BAR (.top-bar):
- Position: fixed, top: 0, left: 300px, right: 0
- Height: 48px, background: rgba(0,0,0,0.6)
- Display flex, align-items center, gap: 12px, padding: 0 16px

APPROVAL TOGGLE:
- .approval-on: background #27ae60
- .approval-off: background #7f8c8d
- Border-radius: 20px, padding: 6px 16px, color white, cursor pointer, border none

File header:
/* ============================================================
   FILE: public/style.css
   ============================================================ */
```

---

## TASK 8 — Docker & Infrastructure

**Goal:** Create the Dockerfile, docker-compose.yml, and a `.gitignore`.

```
### CONTEXT
Continuing the Hero to Slay tabletop simulator.
App runs on port 3000. Assets are in ./Assets (mounted read-only).
No HTTPS, no auth, private LAN use only.
Everything runs inside Docker — no local npm install is ever needed.
The indexer.js is the only script run locally (once, before docker build).

### TASK
Create these files:

---

1. Dockerfile
   - Base image: node:20-alpine
   - WORKDIR: /app
   - Copy package.json only (no package-lock.json)
   - Run: npm install (this runs INSIDE the container during build)
   - Copy server/ folder
   - Copy public/ folder
   - Copy indexer.js
   - DO NOT copy Assets/ or cards.json — these are mounted via volumes
   - EXPOSE 3000
   - CMD: ["node", "server/server.js"]

---

2. docker-compose.yml
   Two services:

   simulator:
     - build: .
     - ports: "3000:3000"
     - volumes:
         ./Assets:/app/Assets:ro
         ./cards.json:/app/cards.json:ro
     - restart: unless-stopped
     - environment: NODE_ENV=production

   test:
     - build: .
     - volumes:
         ./Assets:/app/Assets:ro
         ./cards.json:/app/cards.json:ro
     - command: npm test
     - profiles: ["test"]
       (this service does NOT start with normal docker-compose up)

   Usage:
     Start the game:    docker-compose up --build
     Run tests:         docker-compose --profile test run --rm test

---

3. .gitignore
   node_modules/
   package-lock.json
   cards.json
   *.log

File headers (use # comments):
# ============================================================
# FILE: <filename>
# ============================================================
```

---

## TASK 9 — Test Suite

**Goal:** Create the full Jest test suite and verify everything passes.

```
### CONTEXT
Continuing the Hero to Slay tabletop simulator.
All source files are complete. Now add tests and make them pass.
Test runner: Jest. Integration tests use socket.io-client.

CRITICAL RULES:
- Tests run INSIDE Docker via: docker-compose --profile test run --rm test
- Do NOT add any npm install instructions anywhere — Docker handles this.
- If a test fails, fix the SOURCE FILE — never modify the test to make it pass.
- server/server.js MUST export { app } separately from the listen() call
  so Jest can import Express without binding to port 3000.
  If server.js does not already do this, fix it now:

    // At the bottom of server/server.js, replace:
    //   app.listen(3000, ...)
    // With:
    //   module.exports = { app };
    //   if (require.main === module) {
    //     httpServer.listen(3000, () => console.log('Server running on http://localhost:3000'));
    //   }

INTEGRATION TEST SETUP PATTERN
Each integration test file must use this exact pattern to avoid port conflicts:

  const { app } = require('../../server/server');
  const http = require('http');
  const { Server } = require('socket.io');
  const { io: Client } = require('socket.io-client');

  let httpServer, ioServer, clientSocket;

  beforeAll((done) => {
    httpServer = http.createServer(app);
    ioServer = new Server(httpServer);
    httpServer.listen(0, () => {
      const { port } = httpServer.address();
      clientSocket = new Client(`http://localhost:${port}`);
      clientSocket.on('connect', done);
    });
  });

  afterAll((done) => {
    clientSocket.disconnect();
    ioServer.close();
    httpServer.close(done);
  });

---

### TASK
Create all test files listed below.

---

1. test/unit/Card.test.js
   - Card instantiation sets id, name, type, path correctly
   - isFaceUp defaults to false
   - ownerId defaults to null

---

2. test/unit/Deck.test.js
   - shuffle() produces a different card order than the original
   - draw() returns the top card and reduces size by 1
   - draw() on an empty deck returns null
   - peek(n) returns top-n cards without removing them (size unchanged)
   - size getter returns the correct remaining card count

---

3. test/unit/Player.test.js
   - Player instantiation sets id, nickname, socketId correctly
   - hand defaults to empty array []
   - board defaults to empty array []

---

4. test/unit/GameManager.test.js
   - startGame() transitions phase from 'lobby' to 'playing'
   - getStateForPlayer() replaces other players' hand cards with stubs
     → stubs must have: id, isFaceUp (false), ownerId
     → stubs must NOT have: name, path
   - getStateForPlayer() does NOT stub the local player's own hand cards
   - pushHistory() + undo() restores the previous state (deep equality check)
   - undo() with empty history stack does nothing and does not throw
   - toggleApprovalMode() flips the approvalMode boolean in state

---

5. test/unit/ApprovalQueue.test.js
   - enqueue() followed by approve() calls the onApproved callback
   - enqueue() followed by deny() calls the onDenied callback
   - deny() does NOT call the onApproved callback
   - timeout after 30 seconds auto-denies (use Jest fake timers:
     jest.useFakeTimers() + jest.advanceTimersByTime(30001))
   - A second enqueue() while the first is pending is queued,
     not dropped — it executes after the first resolves

---

6. test/unit/RestrictedLog.test.js
   - append() adds an entry to the log
   - getAll() returns all entries in insertion order
   - clear() resets entries to an empty array

---

7. test/integration/lobby.test.js
   Use the integration test setup pattern above.
   Spin up 4 separate client sockets to test queue limits.

   Tests:
   - A 5th player joining receives an error event
   - A player joining with a duplicate nickname receives an error event
   - start_game emitted with only 1 player in queue emits an error event
   - A client connecting while a game is in progress receives
     a lobby_update event where gameInProgress === true

---

8. test/integration/game.test.js
   Use the integration test setup pattern above.

   Tests:
   - state_update received by player A never contains another player's
     hand card name or path property (only stubs: id, isFaceUp, ownerId)
   - After toggle_approval is emitted, the next state_update contains
     the flipped approvalMode value

---

9. test/integration/approval.test.js
   Use the integration test setup pattern above.
   Use at least 2 client sockets (requester + approver).

   Tests:
   - With approvalMode ON: request_action causes other clients to receive
     an approval_request event
   - Approve path: after respond_approval with decision true,
     all clients receive approval_result where granted === true
   - Deny path: after respond_approval with decision false,
     all clients receive approval_result where granted === false
   - With approvalMode OFF: request_action executes immediately and
     no approval_request event is emitted to other clients
   - UNDO action always triggers approval_request even when
     approvalMode is OFF

---

### FINAL STEPS (agent must perform these in order)
1. Verify that server/server.js exports { app } correctly (fix if needed)
2. Run the test suite inside Docker:
   docker-compose --profile test run --rm test
3. For each failing test: identify the root cause in the SOURCE file and fix it
4. Re-run: docker-compose --profile test run --rm test
5. Repeat steps 3–4 until the command exits with code 0
6. Report the final status of every test file (passed / failed / skipped)

File headers on every test file:
// ============================================================
// FILE: test/<path/to/file>
// ============================================================
```

---

## Quick Reference — Task Order & Dependencies

| Task | Files Created | Depends On |
|------|--------------|------------|
| 1 | package.json, Card.js, Deck.js, Player.js | nothing |
| 2 | indexer.js | /Assets folders existing |
| 3 | RestrictedLog.js, ApprovalQueue.js, GameManager.js | Task 1 |
| 4 | lobbyHandlers.js, approvalHandlers.js, gameHandlers.js, server.js | Tasks 1, 3 |
| 5 | index.html, utility components (7 files) | Task 4 (event contract) |
| 6 | CardComponent, CenterTable, PlayerZone, LobbyView, GameView, app.js | Task 5 |
| 7 | style.css | Tasks 5, 6 |
| 8 | Dockerfile, docker-compose.yml, .gitignore | Tasks 1–7 |
| 9 | All test files | Tasks 1–8 complete |