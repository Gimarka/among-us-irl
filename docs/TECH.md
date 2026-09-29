# Technical design

## Architecture
Web app on each phone + one small online server that holds the true game state.

```
Phones (browser) <-- WebSocket (Socket.IO) --> Game server (Node.js, online, HTTPS)
Printed QR codes --scanned by phone camera--> phone sends scan to server
```

- The server is the referee: roles, timers, cooldowns, QR scan validation, votes, win detection.
- Online (not a home laptop) because browsers only allow the camera on HTTPS.
- Free tiers are enough for 6 players.

### How phones stay in sync
- **One object per game** (`server/game.js`) holds all of that game's state, its
  phase (`lobby` → `playing`, with `meeting` interruptions), every rule about who may
  do what in which phase (`RULES`), and every timer. `server/index.js` only handles
  connections; `server/games.js` is the list of running games.
- **State, not events.** After any change, each phone is sent its whole personal view
  of the game (`state`, built by `viewFor`), with a version number. It never contains
  another player's role, deaths outside a meeting, or votes before the vote ends.
  Times are sent as "time left", never clock times. A phone whose view didn't change
  gets nothing. The phone draws its screens from the latest state (`applyState` in
  `client/src/main.js`), so a phone that was asleep or offline is fully caught up by
  the next state it receives (or the one it gets when it joins back).
- **Confirmed actions.** Everything a player does is an `act` the server answers. An
  unanswered action is kept and sent again after reconnecting; each has an id, so one
  that did arrive isn't done twice.
- **Chat** is fetched (`getChat`): the state only carries the latest message's id.
- **Selfies** are served once at `/photos/<player>?v=<n>` and cached; the state only
  carries that address.
- **Connection health.** Heartbeat every 15 s (a dead connection is noticed within
  ~25 s), plus an immediate check when the app comes back to the foreground. Players
  whose phone dropped are shown offline (dimmed) and don't hold up a vote; the phone
  that lost its connection shows a "Connexion perdue" banner. A dropped player stays in
  the game for 15 min before being removed.
- Everything lives in server memory: a restart (deploy, free host sleeping) ends all
  games.

## Stack
| Part | Tool |
| --- | --- |
| Language | JavaScript |
| Phone app | Plain HTML/CSS/JS with Vite |
| Server | Node.js + Socket.IO (rooms + auto-reconnect) |
| QR scanning | html5-qrcode |
| QR printing | Any QR generator; codes contain short IDs |
| Hosting | Free-tier Node host (Render, Railway…) |

UI text in French in `src/texts.fr.js`. Code and comments in English.

## Feature notes
- Secret roles: server sends each phone only its own role (+ partner for imposters).
- Kill is honour-based ("I'm dead" button, hold 2 s); touches cannot be detected.
- Phone disruption: server event; phones overlay a scramble and disable scanning.
- Emergency event 2-player fix: server checks both holds overlap.
- Meeting alerts: sound (enabled by a tap in the lobby), full-screen takeover.

## Risks and mitigations
| Risk | Mitigation |
| --- | --- |
| Screen locks pause the page (missed alerts) | Screen Wake Lock API; auto-reconnect and resume state |
| No vibration on iPhone browsers | Sound + screen; house rule: shout "Meeting!" |
| Wi-Fi in Garage/Garden | Test coverage; mobile data fallback; resume after reconnect |
| Photographed QR codes | Honour rule among friends |
| Battery | ~10–15% per game; fine |
| Traffic inspection | Never send others' roles |

## Roadmap
1. Hello server: two phones join the same room and see each other's names.
2. Roles and lobby: create/join by code, secret roles, colours and avatars.
3. QR tasks: scan a room code, play one mini-game, count progress.
4. Deaths and meetings: "I'm dead", body QR, meetings, voting, win detection. Deploy online. First playtest.
5. Sabotages: door locks, phone disruption, emergency events.
6. Polish: all 10 mini-games, settings, ambient sound, wake lock, reconnect.

## Who does what
- Claude: writes most code, explains it, keeps docs updated, proposes fixes, writes test plans.
- Owner: decisions, runs code on computer and phones, creates accounts and deploys,
  prints/places QR codes, runs playtests, reports bugs (screenshots help).

## Testing
- Claude: automated tests simulating full games with fake players; server tests for
  disconnects and timers; headless browser checks of pages.
- Owner: real phones (camera, iPhone quirks, sound, wake lock), real house (Wi-Fi, walking times).
