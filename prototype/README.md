# The Maw – web-prototype

En spilbar prototype af kerne-loopet i The Maw: gå ned i dybet, slås, bliv bedre af det, du gør, vend tilbage til byen, køb udstyr og gå ned igen. Grafikken er bevidst enkel (figurer og farver). Det er gameplayet, der skal prøves af.

## Start

```bash
python3 serve.py
```

Åbn http://localhost:5180. Serveren slår browserens cache fra, så en ændring altid ses ved genindlæsning.

**På telefonen:** PC og telefon skal være på samme wifi. Find PC'ens IP-adresse (`hostname -I`) og åbn `http://<ip>:5180` på telefonen; drej den til liggende format. Touch-styring slås til af sig selv på en touchskærm og kan ellers slås til under Debug. Blokerer en firewall, skal port 5180 åbnes.

## Styring

| | Tastatur | Touch |
|---|---|---|
| Gå | WASD / pile | joystick (venstre halvdel) |
| Angrib (sigter selv) | Space eller J (hold) | Attack |
| Echo Bolt | K | Bolt |
| Undvig | Shift eller L | Dodge |
| Potion / Ration | Q / R | Potion / Ration |
| Gå ned / gå gennem porten | F eller Enter | knappen, der dukker op |
| Karakter og pause | C eller Esc | ☰ |
| Debug | ` | Debug (nederst til venstre) |

## Hvad prototypen indeholder

- **Karakter:** fire baggrunde, fem egenskaber og fire skills (Blades, Heavy Weapons, Bows, Echo Arts).
- **Skills vokser ved brug:** hvert slag, der rammer, giver XP til våbnets skill, og et drab giver ekstra. Svage fjender giver mindre (mod grind), og Intelligence får alle skills til at lære hurtigere.
- **Marks (niveauer):** Echo fra drab giver Marks, og hvert Mark giver point til egenskaber og skills. Pointene bruges under ☰, også midt i en Tithe.
- **Skills får bonus fra egenskaber:** f.eks. Bows fra Dexterity (70 %) og Strength (30 %). Karakterskærmen viser vægtene og det effektive niveau.
- **En Tithe:** Reach 1, The Old Mines, med 3 tilfældigt genererede dybder. Den sidste er The Foreman's Hall med Warden og porten.
- **Rivaler:** Cassian Morrow, Vessa Thorne, Ash og Rook Kell og Mira Silvertongue. De går også ned gennem dybderne, kæmper mod monstre og nogle gange mod dig, og kan selv blive Champion. Når du ikke ser dem, rykker de frem i samme tempo som på skærmen.
- **Mirrormaster:** forsegler dybder efter en tid, sender monstre, når publikum keder sig, og sponsorgaver ved drabsserier.
- **Sult**, potions og rations; loot med tilfældige egenskaber (Common, Magic, Rare) og caches.
- **The Rim:** Forge (køb og sælg), Apothecary, Patrons' Hall (sponsorgaver efter Renown) og Kronens pengepung efter hver Tithe.
- **Karakteren beholder** skills, egenskaber og udstyr mellem Tithes. Den gemmes i browseren (localStorage).

Ikke med endnu: multiplayer, de andre Reaches, specialiseringer, historie og dialog, rigtig grafik og lyd.

## Justér

Alle tal står i [balance.js](balance.js) med en forklaring på hvert tal: hvor hurtigt skills vokser, egenskabernes vægte, Marks, monstre, loot, priser, rivaler, Mirrormaster og hvad det koster at falde (`rim.fallPenalty`). Det er besluttet, at du mister det udstyr og guld, du fandt i den Tithe (`'lose-found'`), men aldrig det, du gik ned med; `'none'` kan bruges til at mærke forskellen. Ret et tal, gem og genindlæs siden.

**Debug-panelet** kan vise skill-XP for hvert slag, gøre dig udødelig, give et Mark eller guld, vise kortet, dræbe monstrene, springe til næste dybde, vinde en Tithe, spille den samme bane igen (seed) og slette karakteren.

## Spørgsmål, prototypen skal besvare

1. Er det sjovt, at skills vokser ved brug, eller føles det som grind?
2. Føles våbnene forskellige?
3. Holder løkken Tithe → the Rim → køb udstyr → ned igen til en session på 10–15 minutter?
4. Virker touch-styringen til kamp set oppefra?
5. Får rivalerne og Mirrormaster det til at føles som en dødelig turnering?

## Kendte begrænsninger

- Karakteren gemmes, når en Tithe slutter. Genindlæser du siden midt i en Tithe, er den væk, og karakteren er som før den startede.
- Rivaler angriber ikke hinanden, og monstre finder kun vej rundt om vægge, når de jager dig.

## Kode og tests

```
balance.js        alle tal
js/core/          spillets regler uden DOM: character, items, dungeon, world (en Tithe), rim (byen), rng
js/client/        skærm, input, HUD og skærmbilleder
tests/            tests af reglerne, også en hel Tithe spillet af en bot uden skærm
```

```bash
node --test tests/*.test.js
```

Reglerne i `js/core/` kender ikke til skærmen, så de senere kan køre på en server, når der kommer multiplayer. I browserens konsol giver `__maw.state` adgang til spillets tilstand, og `__maw.tick(1/30)` kører én frame i hånden.
