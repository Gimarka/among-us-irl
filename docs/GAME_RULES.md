# Game rules (Game Design Document)

Source: claude.ai design project. Status: design complete.

## Concept
Real-life Among Us in one house. Each player's phone is their game device.
Crewmates scan room QR codes to play mini-game tasks; hidden imposters kill by touch
and sabotage through the app.

## Players and platform
- 4–6 players, no game master. Everyone plays; the app runs the game.
- Imposters: always exactly 1, drawn at random each game.
- Web app in the phone browser (no install). Join by lobby QR code or short game code.
- The victim reports their own death by tapping "I'm dead" right after being touched.

## Roles
| Role | Goal | Can do |
| --- | --- | --- |
| Crewmate | Finish all tasks or vote out every imposter | Scan room codes to play tasks, scan door codes, report bodies, call meetings, vote |
| Imposter | Kill all crewmates | Kill by touch, lock doors, disrupt phones, trigger emergency events, fake tasks (same mini-games, no progress), vote |
| Dead player | — | Lies down until found; after the meeting sits silently in the living room. No ghost tasks (a walking ghost looks like a living player) |

## Game loop
Free roam (tasks, kills, sabotages) → meeting (body found or emergency meeting) →
discussion → vote → result → back to free roam, until a win condition.
Target game length: 15–30 minutes.

## Tasks, rooms and doors
- 6 task rooms: Kitchen, Bathroom, Bedroom 1, Bedroom 2, Garage, Garden. Details in HOUSE_MAP.md.
- Meeting room: living room (no tasks).
- Each crewmate gets a task list (default 6). Scanning the right room's QR opens a 30–60 s mini-game.
- Players see only their own tasks. A shared task progress bar is shown to everyone,
  updated only at meetings.
- Gated doors (Bathroom, Bedroom 1, Bedroom 2): real doors, kept closed; scan the
  door QR then solve the Code entry mini-game to open (see MINIGAMES.md).

## Imposter abilities
| Ability | Effect |
| --- | --- |
| Kill | Touch a crewmate; they tap "I'm dead" and lie down. Cooldown 60 s |
| Lock door | A gated door cannot be opened at all for 15 s, no matter what; scanning it just shows "Locked" |
| Phone disruption | All phones (imposters' too, to avoid tells) scramble and cannot scan for 20 s |
| Emergency event | Crewmates must fix it in a given room within 90 s or imposters win. 1 fixer at 4 players; at 5–6 players 2 fixers in two rooms at the same time |

- Lock door, disruption and emergency event share one 90 s cooldown.
- No sabotages during meetings.

## Death, meetings and voting
- Silent death: after "I'm dead" the phone shows a dark screen with a personal body QR code, no sound.
- Body report: the finder scans the body QR on the dead player's phone.
- Emergency meeting: any living player, 1 per player per game.
- Meeting: all phones alert with sound, naming who found the body / called the meeting.
  Everyone goes to the living room. Dead players attend silently and do not vote.
- Discussion 2 min, then 45 s secret vote in the app. Skip option exists.
  A tie, or Skip getting the most votes, ejects nobody.
- The ejected player's role is NOT revealed.

## Win conditions
| Winner | Condition |
| --- | --- |
| Crewmates | All tasks completed |
| Crewmates | Every imposter voted out |
| Imposters | All crewmates killed (no "imposters = crewmates" parity rule: it would reveal the count) |
| Imposters | An emergency event timer runs out |

## Game settings (adjustable in the lobby by the game creator)
| Setting | Default | Range |
| --- | --- | --- |
| Tasks per crewmate | 6 | 3–10 |
| Discussion time | 2 min | 1–5 min |
| Voting time | 45 s | 20–90 s |
| Emergency meetings per player | 1 | 0–3 |
| Kill cooldown | 60 s | 30–120 s |
| Sabotage cooldown (shared) | 90 s | 45–180 s |
| Emergency event timer | 90 s | 60–180 s |
| Phone disruption length | 20 s | 10–40 s |
| Door lock length | 30 s | 15–60 s |

## Version 1 extras
Player colours and avatars; ambient sound. Later: end-of-game replay, spectator feed, stats.

## Decision log (newest first)
- Server reworked for sync (see TECH.md "How phones stay in sync"): every phone
  gets its whole view of the game after each change, actions are confirmed and
  resent after a lost connection, selfies are loaded once. New visible behaviour:
  a phone that lost its connection shows "Connexion perdue, nouvelle tentative…";
  players whose phone dropped are dimmed in the lobby and the vote, and the vote no
  longer waits for them. Tasks, chat, alert, interference, the hand scanner and new
  reports are refused during a meeting.
- Surveillance screen (TEST SURVEILLANCE in the test menu, for now): a live
  feed, newest first, of what every player in the game does - door opened,
  minigame or task finished - with their character, name and how long ago.
  Also the hand scanner: each player who held it gets "a désactivé
  l'alerte". Never the alert or interference (imposter-only actions), or
  deaths. No history: opening the
  screen shows only the latest action, then new ones as they happen;
  closing it loses them.
  Its back button returns to the main menu.
- The voting screen has a green bar at the top: the innocents' tasks done,
  all innocents together (dead ones included; imposters' fake tasks left
  out). The game's name is no longer shown on the main menu.
- Before the vote result, 5 s showing who voted for whom: each voter's small
  character appears under the player they voted for (or under PASSER). The
  eliminated player is only crossed out once the result is shown.
- Body report and vote (TEST REPORT in the test menu, for now). Any player
  in the game can trigger it. Every phone drops what it's doing (minigames,
  scanner, chat, dead screen), the alert is paused and any interference cut.
  "CADAVRE TROUVÉ" on dark yellow for 5 s, then the vote: every player in the
  game shown like in the lobby, dead players with a red cross, a 30 s
  countdown (server-timed, same on every phone) and a PASSER button. Living
  players tap a player (themselves included, never a dead one) or PASSER and
  can change their vote until the vote ends; dead players can't vote. Votes
  are secret. The vote ends at 0 or as soon as every living player has voted.
  Then 10 s of black: the player with the most votes (no tie, and PASSER not
  on top) is eliminated - marked dead, "<name> A ÉTÉ ÉLIMINÉ" with their
  character - otherwise "AUCUN JOUEUR N'A ÉTÉ ÉLIMINÉ". Everyone, the
  eliminated player included, goes back to the menu and the alert resumes
  with the time it had left. "OUI, JE SUIS MORT" now tells the server the
  player is dead.
- New mini-game "Hand scanner" (TEST SCANNER in the test menu): two players
  must hold the hand at the same time for 3 s to switch off the alert. Alone,
  the screen shows "En attente d'un autre joueur"; if one lets go early the
  scan restarts. The server times the 3 s. The test menu scrolls, since the
  list of mini-games is getting long (only that screen scrolls).
- Host settings (⚙️ in the lobby, host only, before JOUER): number of
  imposters 1-3 (default 1; always at least one crewmate, so fewer are drawn
  if there aren't enough players - this replaces "always exactly 1
  imposter"), tasks per player 1-9 (default 6), alert length 20 s-2 min in
  10 s steps (default 60 s), interference length 5-60 s in 5 s steps
  (default 10 s). Each game has its own settings; the server enforces the
  ranges.
- Character customisation moved to the lobby. The home screen only has the
  title, the name, REJOINDRE and NOUVELLE PARTIE. Entering a game keeps the
  phone's saved colour if nobody in that game has it (otherwise a random
  free one), plus its saved selfie and hat. In the lobby, PERSONNALISER opens
  the customisation screen (colours taken in that game are crossed out);
  VALIDER saves the look for everyone. The look is fixed once in the game;
  a player still customising when JOUER is pressed goes in with their last
  saved look.
- Named games, several at once (replaces the single numbered session
  below). The character screen has REJOINDRE (a live list of running games
  with their player count and "En attente"/"En cours", or "Aucune partie en
  cours") and NOUVELLE PARTIE (name the game, max 20 characters, a name
  already used by a running game is refused; its creator is the host). Each
  game is fully separate: its own players, chat, roles, tasks, alert and
  interference. Only the host sees JOUER in the lobby; if the host leaves,
  the player who has been in the game the longest becomes host. A started
  game stays joinable: newcomers wait in the lobby and press CONTINUER to
  enter as a crewmate. A game is deleted once its last player has left.
  Suit colours only need to be unique within one game. A phone still part of
  a running game goes straight back to it when the app opens.
- Each task has a fixed room (from the house map), shown in the task list as
  "Tri | Cuisine". During an alert, every player's list shows a red
  "Oxygène | Terrasse" row on top; the Terrace is a new room for it.
- Game sessions. The first "JOUER" creates a session (numbered 1, 2, 3...,
  counting up for as long as the server runs) and sends everyone in the
  lobby at that moment to the role reveal together. The session holds all
  game state (chat, roles, tasks, alert, interference), reset at every new
  session. It lasts until every player has left: either on purpose, or
  15 min after their phone lost its connection. While it runs, the lobby
  button reads "CONTINUER" and brings in just that player, always as a
  crewmate. A player who was already in the session and comes back (after
  a disconnect, a reload, or a trip back to the character screen) skips
  the lobby and keeps their role and tasks. On opening the app: no session
  goes to the character screen, a running session goes to the lobby
  (newcomer) or straight to the menu (already in it). Characters (name,
  colour, hat, selfie) are stored on the server per phone, outside any
  session, and pre-fill the character screen. Everything is in server
  memory only: a restart (deploy, or the free host going to sleep) ends
  the session and forgets characters.
- Code entry is now the universal door mechanic: required to open any of
  the 3 gated doors, not just a Bedroom 1 task. Lock door simplified to a
  flat 15 s hard lock with no early-unlock mini-game (dropped Door unlock).
  Task mini-games now have French display names (see MINIGAMES.md/texts.fr.js).
- Simplified to always exactly 1 imposter, picked at random, dropping the
  1-or-2 odds table (and the now-pointless "imposters know each other").
- Roles are drawn once per round, on the first "Jouer" click from whoever's
  in the lobby at that moment. A player who joins after that draw defaults
  to crewmate rather than reshuffling everyone else - there's no "new
  round" reset yet. Each player's role is sent to them privately and
  revealed with a 3 s fade-to-black screen (INNOCENT in blue, TRAÎTRE in
  red) before the menu.
- UI in French; docs, code, discussion in English.
- Screens: identical main screen for all roles; imposter panel opens by long-pressing the title;
  imposters see a no-op "I'm dead" button; meeting alerts name who found/called.
- Built by the owner (beginner) and Claude; web app + online game server.
- 2-player emergency fix in Garden + Bedroom 2. Steady hand uses finger drag.
- Settings adjustable in lobby; defaults validated.
- Progress bar shared, updated at meetings. Dead players wait in the living room.
- No ghost tasks. Imposters get fake tasks.
- Gated doors: Bathroom, Bedroom 1, Bedroom 2. Stairs have no special rules.
- Random hidden imposter count (1–2). Skip votes; ties eject nobody; roles hidden.
- Meetings in the living room. Doors are physically closed. Victim taps "I'm dead".
- 4–6 players, no game master, web app, 15–30 min games.
