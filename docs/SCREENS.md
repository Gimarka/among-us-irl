# App screens

## Principles
- A glance at someone's phone must never reveal the imposter: identical main screens.
- Big buttons, one hand, little text. French UI.
- Irreversible actions need a hold or confirm.
- Death and imposter actions: silent. Meetings and emergencies: full screen + sound.
- Player colour and avatar everywhere.

## Flow
Home → Create/Join → Lobby → Role reveal → Main screen ⇄ Scanner → Mini-game / Door result
Main screen → Dead screen; Main/Dead → Meeting → Vote → Result → Main screen or Game over.
Sabotage overlays can appear over the main screen at any time.

## Before the game
| Screen | Who | Content |
| --- | --- | --- |
| Home | All | Title; Create game / Join game |
| Create / Join | All | Name, colour + avatar; Join asks for code or scans lobby QR |
| Lobby | All | Game code + QR, player list (4–6), "Tap to enable sound" (also keeps screen awake) |
| Lobby settings | Creator | Settings with defaults; Start (4+ players) |
| Role reveal | All | "Hold to see your role"; imposters also see their partner; hidden on release |

## During play
| Screen | Who | Content |
| --- | --- | --- |
| Main screen | All | Own task list (room + tick), Scan button, Emergency meeting button (uses left), "I'm dead" (hold 2 s; no-op for imposters) |
| Imposter panel | Imposter | Long-press the title to open; kill cooldown, Lock door (pick door), Disrupt phones, Emergency event, shared cooldown; closes on release |
| Scanner | All | Camera view; reads room, door, body codes |
| Mini-game | All | Full screen; pauses on meeting/disruption |
| Door result | All | Green "Open" or red "Locked" + countdown + Unlock mini-game |

## Sabotage and alerts
| Screen | Who | Content |
| --- | --- | --- |
| Disruption | All alive (imposters too) | Glitch overlay 20 s, Scan disabled, countdown |
| Emergency event | All alive | Red alarm + sound, room(s), 90 s countdown |
| Emergency fix | Crewmate in the room | "Hold to fix"; 2-player version shows the other side's status |
| Resolved | All alive | "Fixed!" banner |

## Death
| Screen | Who | Content |
| --- | --- | --- |
| Body | Victim | Dark, silent, large body QR at low brightness |
| Out of play | Dead | "Stay silent in the living room"; sees meeting results |

## Meetings and end
| Screen | Who | Content |
| --- | --- | --- |
| Meeting called | All | Alert + sound; "Body of X found by Y" or "Emergency called by Y"; go to living room |
| Discussion | All | 2 min countdown, players alive/dead, task progress bar |
| Vote | Living | One button per living player + Skip, 45 s, confirm; shows vote count, not choices |
| Result | All | "X was ejected" / "No one was ejected"; role stays secret |
| Game over | All | Winner + reason, all roles revealed, Play again |
