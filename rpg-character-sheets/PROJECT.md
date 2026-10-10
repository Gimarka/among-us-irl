# RPG Character Sheets: project notes

> Memory of the project. Read this first in every session.
> **Status: discussion / planning. No code yet.**
>
> Note: this file temporarily lives in the `among-us-irl` repo (the only repo attached to
> the session where the project started). It will move to its own repository at step 0.

---

## 1. Goal

A small website where the players of my tabletop RPG campaign log in **on their phone**
and see their **character sheet**. I (the game master) have an **admin page** to edit
characters and to add items, skills, weapons, and so on. **Every change is recorded in a
history** so I can see what was used, when, and by whom.

- Users: 1 game master (admin) + about 5 players.
- Language: **French UI** (the game is played in France). Code and docs in English.
- Cost: **100% free**. No credit card, no paid plan.
- Look: tabletop medieval-fantasy feel (parchment, ink, serif titles), but **ease of use
  comes first**. Readable on a phone at the table, big touch targets, no clutter.

## 2. The example sheet (CARMEN DELERANVRI)

This is what one sheet contains today (from the Word/PDF example):

| Block | Content in the example | Fields |
|---|---|---|
| Identity | Carmen Deleranvri, Age 23, Taille 1m75, Niveau 1 | name, age, height, level, portrait (optional) |
| Characteristics | PHYSIQUE 70, MENTAL 40, SOCIAL 55, AGILITE 50, CHARISME 45 | 5 numeric values |
| Health | PV 90 | current PV / max PV (to confirm) |
| Description | Free text background | long text |
| Compétences | Intimidation p+15; Cri de ralliement "+5 au prochain jet de chaque joueur (1 seule fois par combat)"; Œil d'aigle "Voit de loin" p+15; Sang froid "Résiste au stress" P+5 | name, description, modifier |
| Incompétences | Berserk "Doublement de sa puissance, perte de contrôle"; Naïveté "Se laisse facilement bernée" p-10; Superstitieuse | name, description, modifier |
| Vêtements / Armure | Armure légère p+10; Fourrure de renard; Amulette sacrée +10 en chance | name, effect / modifier |
| Armes | Hâche à 2 mains 12+1D6; Bouclier p-10; Couteau de poche 2+1D6 | name, damage formula or modifier |
| Inventaire | ¼ de saucisson ×1, guitare mal accordée ×1, torche ×2, potion d'hilarité ×1 | name, quantity |
| Money | 440 PA | amount |

## 3. Features (first draft)

### Player side (phone first)
- Log in with a **username only, no password** (trust basis). Stay logged in on the phone.
- See their own character sheet, organised in clear sections (tabs or collapsible
  blocks): Identité, Caractéristiques, Compétences, Équipement, Inventaire.
- **Health bar** for PV (current / max), visible at the top of the sheet.
- Can **view the other characters** of the party, read-only.
- Can **remove an item they used** (or lower its quantity: torche ×2 → ×1). They can
  **not edit** anything else (names, stats, PV, descriptions...). Each removal goes to
  the history, with an optional short note.
- Live updates: when the GM gives an item or changes PV, the phone updates without
  reloading.
- Never sees the GM's hidden notes.

### Admin side (GM)
- Designed **for a laptop first** (wide screen, tables, keyboard). It should still work
  on a phone in an emergency, but that is not the priority.
- **Hidden notes**: GM-only secret notes on a character, never sent to players.
- Manage players (accounts) and characters (create, edit, archive).
- **Catalogue**: a library of reusable entries (items, weapons, armour, skills,
  incompetences, potions...), defined once and then given to any character.
  It must still be possible to add a one-off custom entry directly on a sheet.
- Edit any field of any sheet. Quick actions for use at the table: ±PV, ±money,
  give or remove an item, change a quantity.
- **History page**: every change with date, author (GM or player), character, what changed
  (old value → new value), optional note. Filters by character, game session, and type.
- (Nice to have) Undo a change from the history.
- (Nice to have) Group changes by **game session** ("Séance 3 – 12/10").

### History ("historisation"), how it should work
- Every change to a sheet produces one history line. Nothing is ever really deleted:
  removed items are marked as removed, so the history stays complete.
- History lines are written **by the database itself** (a trigger), not by the web page.
  That way no change can escape the history, whatever screen made it.

## 4. Proposed technical solution (all free)

| Need | Proposal | Why |
|---|---|---|
| Code storage | **GitHub** (new repo, e.g. `fiches-jdr`) | Free, already used, Claude Code works with it |
| Database + login + live updates | **Supabase** (free plan) | Real database (Postgres), built-in login, live updates, triggers for the history, and a web dashboard that works as an emergency admin. No credit card |
| Website hosting | **Cloudflare Pages** (or Netlify) | Free, HTTPS, automatic deploy on every push, a preview URL per branch for testing on phones |
| Front-end | Plain HTML/CSS/JS with **Vite** (same as the Among Us IRL project) | Easy to read for a beginner, no framework to learn |
| Fonts / look | Google Fonts (e.g. *Cinzel* for titles, *EB Garamond* or *Crimson Pro* for text), CSS parchment textures | Free |

Free plan limits are far above what 6 users need (Supabase: 500 MB database, 50,000
monthly users).

**Known catch:** a free Supabase project is **paused after 7 days without activity**.
The data is kept, and it is restarted with one click in the dashboard, but a player
opening the site before a game would see an error. Fix: a free scheduled GitHub Action
that pings the database every few days so it never sleeps.

**Alternative if we want zero pausing risk:** Cloudflare Pages + Cloudflare D1
(SQLite) + Workers. Also free and never paused, but we would have to build login and
live updates ourselves, so more code and more things that can break. Not recommended for v1.

## 5. Data model (first draft, to be validated)

- `profiles`: one per user. Role `admin` or `player`.
- `characters`: identity, 5 characteristics, PV current/max, money, description, owner (player).
- `catalog_entries`: reusable library. Type (`competence`, `incompetence`, `armure`,
  `arme`, `objet`...), name, description, modifier / damage formula.
- `character_entries`: what a character has. Link to a catalog entry **or** custom
  text, quantity, modifier override, `removed_at`.
- `game_sessions`: optional, for grouping history ("Séance 3").
- `history`: who, when, character, table, field, old value, new value, note, session.

- `gm_notes`: hidden notes, in a separate table that players can never read.

Security rules (enforced by the database, not only by the page):
- A player can read every character (read-only), but never the hidden notes.
- A player can only remove / decrease items on **their own** character. Nothing else.
- Only the admin can edit sheets and the catalogue.
- Nobody can edit or delete history lines.

Note on "username without password": anyone who knows the site address and a username
can open that player's sheet. Accepted (trust basis, and players can only remove their
own used items). The **admin access must still be protected by a password**, otherwise
anyone could open the admin page and read the hidden notes.

## 6. Plan of action

Each step ends with something you can open and test on a phone before the next one starts.

0. **Prerequisites & decisions.** Create the accounts and repo (see §7), answer the open
   questions (§8), freeze the data model.
1. **Database.** Create the Supabase project, tables, security rules, history trigger.
   Load Carmen's sheet as test data.
2. **Player sheet, read-only.** Login page and Carmen's sheet on a phone. Deployed on
   Cloudflare Pages. Mobile layout first, basic styling.
3. **Admin, characters.** List characters, edit every field, create players and characters.
4. **Admin, catalogue.** Create entries, give them to characters, quantities, custom entries.
5. **History.** History page with filters, notes, game sessions; undo if wanted.
6. **Player actions.** Remove a used item / lower its quantity, with optional note.
7. **Medieval look & polish.** Theme, icons, empty states, error messages in French.
8. **Real test** with the players at a game, then fixes.
9. Later / optional: dice roller (d100, 1D6...), printable/PDF sheet, portraits, private
   player notes, offline mode.

## 7. Prerequisites (what you need to do)

| # | What | Cost | Notes |
|---|---|---|---|
| 1 | GitHub account | Free | You already have one (`gimarka`) |
| 2 | New GitHub repository for this project (e.g. `fiches-jdr`, private is fine) | Free | Then add it to Claude Code so I can work in it |
| 3 | Supabase account (sign up with GitHub) | Free | No credit card |
| 4 | Cloudflare account (sign up, then connect GitHub in Pages) | Free | Or Netlify, same idea |
| 5 | The players' usernames | – | No emails needed |
| 6 | The other character sheets (Word/PDF) | – | To load the real data |
| – | Domain name | Not needed | Free address like `fiches-jdr.pages.dev` |
| – | Node.js on your computer | Optional | Only if you want to run the site locally; deploy previews are enough |

## 8. Open questions

Each question has a suggested default in brackets. "OK" keeps it.

Game rules:
1. `p+15` = target +15. Is each skill tied to one characteristic (e.g. Intimidation
   → Charisme), so the app can show the final target (45 + 15 = 60)? Or is the
   characteristic chosen at the moment of the roll? [chosen at roll time: show "+15" only]
2. Are the 5 characteristics (Physique, Mental, Social, Agilité, Charisme) the same for
   every character? [yes, fixed list]
3. "PA" = pièces d'argent? Any other currency (gold, copper)? [one currency, PA]
4. Does the level do anything (e.g. raise max PV), or is it just a number you change?
   [just a number]
5. Who changes PV during a fight: only you, or players too? [only you]

Items, catalogue, history:
6. If you change an item in the catalogue (e.g. fix a potion's effect), should every
   character who already has it get the change? [yes]
7. Hidden notes: only one notes field per character, or also hidden notes on items
   (the player sees "Amulette sacrée", you see "cursed")? [both]
8. Can a player undo a removal they made by mistake, or do they ask you? [they ask you;
   you can restore from the history]
9. Group history by game session ("Séance 3 – 12/10")? [yes, you click "Start session"]
10. Are the sheet sections fixed (Compétences, Incompétences, Vêtements/Armure, Armes,
    Inventaire), or do you want to create your own? [fixed]

Viewing others & access:
11. When looking at another character, do players see everything (stats, inventory,
    description) or only a summary (name, portrait, health bar)? [everything except
    hidden notes]
12. Add one shared table password to enter the site (players then pick their username)
    so a stranger who finds the address can't get in? [no, address is enough]

Look & extras:
13. Character portraits (upload an image)? [yes, optional]
14. Dark theme (candle-lit table) or light parchment? [light parchment + dark mode switch]
15. A name for the site? [e.g. "Les Fiches de la Compagnie"]

## 9. Decision log

| Date | Decision |
|---|---|
| 2026-10-10 | Project started. No code until the plan and prerequisites are agreed. |
| 2026-10-10 | Proposed stack (not yet validated): Supabase + Cloudflare Pages + Vite/plain JS. |
| 2026-10-10 | Game uses a d100. `p+15` means the roll target +15. |
| 2026-10-10 | PV shown as a health bar (current / max). |
| 2026-10-10 | Players can remove items they used (or lower the quantity), nothing else. |
| 2026-10-10 | Player login: username only, no password (trust basis). Admin keeps a password. |
| 2026-10-10 | Players can view other characters, read-only. |
| 2026-10-10 | GM hidden notes, never visible to players. |
| 2026-10-10 | Admin page is designed for laptop first. |
