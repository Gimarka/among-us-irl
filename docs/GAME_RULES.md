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
