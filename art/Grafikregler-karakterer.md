# Grafikregler: karakterer

Reglerne beskriver, hvordan spillets karakterer tegnes, så de kan laves med en AI og stadig passe sammen: spillernes figurer (de fire baggrunde), rustningen, de har på, og de syv NPC-rivaler. Monstre, våben, genstande og byen får deres egne regler senere. Afsnit 1 (fælles stil) gælder også for dem.

Tekster i spillet og i prompts er på engelsk. Navne og id'er står, som de står i spillet (`packages/rules/src/balance.ts`).

Besluttet 2026-11-20: grafikken ses **stejlt oppefra (ca. 60°)**, og figurerne har **8 retninger**.

## 1. Fælles stil (gælder al grafik)

- **Pixel art.** Et felt i spillet er 32 × 32 px. Spillet skalerer med hele tal (2×, 3×), så pixels forbliver skarpe.
- **Perspektiv: stejlt oppefra.** Kameraet ser ned i ca. 60°:
  - Toppen af hovedet og skuldrene fylder mest.
  - Kroppen er forkortet, så højder bliver ca. halvt så lange i billedet, og benene ses, når figuren går.
  - Ansigtet ses kun som en smal stribe under panden.
  - Det er hverken lige oppefra eller fra siden. Mure og huse viser en lav forside.
- **Lys fra øverst til venstre.** Flad skygge med 2–3 toner pr. materiale. Ingen bløde overgange og ingen anti-aliasing.
- **Kontur:** 1 px i paletten mørkeste farve (`#140f0e`), aldrig ren sort.
- **Gennemsigtighed:** baggrunden er gennemsigtig, og en pixel er enten helt synlig eller helt gennemsigtig.
- **Palet:** kun de 48 farver i [`palette.hex`](palette.hex). Den kan indlæses i Aseprite, LibreSprite og de fleste AI-værktøjer til pixel art, og [`palette.png`](palette.png) viser den som billede til værktøjer, der tager et farvebillede. Rampene, mørk til lys:

  | Rampe | Bruges til |
  |---|---|
  | Outline | Kontur og dybeste skygge |
  | Stone | Sten, uldent og ufarvet stof, skæg og grå hår, det lyseste højlys |
  | Iron | Jern, ringbrynje, skæl, metalbeslag |
  | Skin | Hud, fra mørk til lys |
  | Leather | Læder, træ, brunt hår |
  | Madder | Rødt stof |
  | Ochre | Gult og okkerfarvet stof, messing, guld, blondt hår |
  | Moss | Grønt stof |
  | Woad | Blåt stof |
  | **Echo** | **Kun Echo**: krystaller, Echo Arts og det, der er rørt af Echo |
  | **Ember** | **Kun ild og lys**: fakler, gløder, ildkrukker |

  Echo og Ember er de eneste klare farver. Holdes de forbeholdt, kan spilleren altid se magi og ild.
- **Det tegner spillet selv, ikke grafikken:** skygge under figuren, det hvide blink ved et slag, Slowed/Stunned/Corroded, Echo-lys og projektiler, navne og levels, og ringen i partiets eller rivalens farve under fødderne. Sprites har derfor ingen skygge, glød, partikler eller tekst.
- **Tone:** middelalder, slidt og jordnær, ikke heroisk-blank. Intet blod og ingen gore.
- **Originalitet:** nævn aldrig eksisterende spil, serier eller kunstnere i en prompt ("in the style of …"). Beskriv stilen med ord, som i prompts nedenfor. Tjek, at AI-værktøjets vilkår tillader kommerciel brug og offentliggørelse; repoet er offentligt.

## 2. Figuren

- **Billedet** er 64 × 64 px. Figuren er 45–50 px fra issen til tåspidserne, konturen medregnet.
- **Fodpunktet** er (32, 48): punktet på jorden midt under figuren. Det er det punkt, spillet sætter på figurens position. Fødder og skridt må gå ned til y = 61; resten er margen.
- **Bredde:** kollisionen har radius 0,35 felt (11 px). Forfra og bagfra er figuren med arme 28–34 px bred, fra siden ca. 24 px.
- **Proportioner:** hovedet med hue eller hår fylder ca. en tredjedel af figurens højde i billedet. Stiliseret, så hoved, skuldre og hænder kan læses i lille størrelse.
- **Hovedbeklædning** må ikke stikke længere frem end ansigtet. Gør den det, skjuler den ansigtet oppefra.
- **Én fælles dukke.** Alle spillerfigurer deler samme krop: samme proportioner og samme positur i hvert billede af hver animation. Det er det, der gør, at rustning og våben passer på alle fire baggrunde. Den første figur (Miner uden rustning) er dukken, og alle andre laves med den som reference.
- **Tomme hænder.** Hænderne er lukkede, som om de holder om et skaft, men der er intet i dem. Våbnet holdes i højre hånd og tegnes af spillet, som også bestemmer, om det står foran eller bag figuren.
- **Silhuet:** hver baggrund skal kunne kendes på silhuetten oppefra alene (afsnit 5). Oppefra er det især hovedet og skuldrene, der skiller figurerne ad.

## 3. Retninger og ark

- **8 retninger.** Rækkerne står med uret fra nord: **N, NE, E, SE, S, SW, W, NW** (nord, nordøst, øst, sydøst, syd, sydvest, vest, nordvest).
- E, NE og SE må være spejlvendte W, NW og SW, hvis figuren ikke har noget, der kun sidder i én side.
- **Én PNG pr. animation.** Bredden er antal billeder × 64, og højden er 8 × 64. Death har kun én række (S). Ingen mellemrum, rammer eller tekst mellem billederne.
- LPC passer ikke til reglerne: den har 4 retninger og ses mere forfra.

## 4. Animationer

Animationerne er enkle: få billeder og tydelige stillinger. Spillets handlinger sker med det samme, man trykker, så slag, skud og Echo rammer i **første** billede; resten er efterslæb, mens våbnet er klar igen.

| Fil | Billeder | Afspilles | Hvornår og hvordan |
|---|---|---|---|
| `idle` | 4 | i loop, ca. 6 pr. sekund | Står stille og ånder: skuldrene løfter sig 1 px. |
| `walk` | 6 | i loop, tempoet følger farten | Går: benene svinger frem og tilbage, armene modsat. Kroppen gynger højst 1 px. |
| `dash` | 4 | én gang, 0,18 s | Undvigelsen: et lavt, fremadlænet spring på 3 felter. |
| `slash` | 4 | én gang, 0,3–0,5 s | Blades og ubevæbnet (Dagger, Rusty Sword, Short Sword, Fine Dagger, Longsword). 1: armen midt i et vandret hug. 2: gennemsvinget. 3–4: tilbage til hvile. |
| `chop` | 4 | én gang, 0,8–1,1 s | Heavy Weapons (Pickaxe, War Axe, Maul, Greataxe). 1: tohånds-hug oppefra midt i svinget. 2: gennemsvinget, let foroverbøjet. 3–4: tilbage til hvile. |
| `shoot` | 4 | én gang, 0,6–0,7 s | Bows (Short Bow, Hunting Bow, Longbow). Venstre hånd holder buen frem, højre trækker strengen. 1: strengen slippes. 2: efterslæb. 3–4: tilbage til hvile. |
| `cast` | 4 | én gang, ca. 0,55 s | Echo Arts. 1: åben håndflade skudt frem. 2: efterslæb. 3–4: tilbage til hvile. Ingen glød; spillet lægger Echo-lyset på. |
| `use` | 3 | én gang | Drikker en potion eller spiser: hånden op til munden. Lav prioritet. |
| `hurt` | 2 | én gang | Ramt: et lille ryk bagud. |
| `death` | 6 | én gang, kun S | Falder sammen og ligger stille i sidste billede. |

## 5. Baggrundene

Hver baggrund er et kropslag på dukken: hoved, hår, ansigt og tøj. Indtil spilleren kan vælge udseende (åbent valg 1), får de fire baggrunde forskellige hudtoner fra hudrampen.

| Id | Navn (i spillet) | Udseende | Silhuet oppefra | Rampe |
|---|---|---|---|---|
| `miner` | Miner | Bred og kompakt, sodet ansigt, tætsiddende polstret læderhue, grov ulden skjorte med oprullede ærmer, læderbukser, tunge støvler, enkelte små Echo-krystalstænk på tøjet. | Rund hue og meget brede skuldre | Leather, Stone, lidt Echo |
| `poacher` | Poacher | Slank, kort kappe med hætte, læderarmskinne på venstre underarm, bløde støvler, taske i bæltet. | Spids hætte og kappen over skuldrene | Moss, Leather |
| `acolyte` | Temple Acolyte | Spinkel, lang kjortel med rebbælte, kortklippet hår, blækpletter på fingrene, et lille Echo-vedhæng om halsen. | Kortklippet isse og kjortlen, der bliver bredere forneden | Stone (lys), Woad, Echo |
| `runner` | Street Runner | Senet, kort tunika, langt halstørklæde, der flagrer bagud i løb, viklede skinneben, taskerem over brystet. | Halstørklædet og de smalle skuldre | Woad, Madder |

Teksterne i spillet: Miner "Dug Echo crystals in the shafts of Cinderhollow", Poacher "Hunted the Crown's deer by night", Temple Acolyte "Studied the Echo in the temple archives", Street Runner "Ran messages and errands through every alley in Aurum".

## 6. Rustning

- **Et lag pr. rustning**, tegnet oven på kroppen: samme billeder og samme ark som kroppen, gennemsigtigt alle andre steder. Filerne hedder efter rustningens id.
- **Rustningen dækker overkrop, overarme og lår**, aldrig hoved, hænder eller fødder. Så kan baggrunden stadig kendes.
- **Tungere rustning ser tungere ud:** mere jern og bredere skuldre (højst 2 px til hver side). Oppefra er det skuldrene, der viser det. Spilleren skal kunne se fremskridtet med ét blik.

| Id | Navn | Udseende | Rampe |
|---|---|---|---|
| `padded_coat` | Padded Coat | Vatteret stofjakke til låret med synlige syninger | Stone, Ochre |
| `leather_jerkin` | Leather Jerkin | Hærdet lædervest med remme og et spænde | Leather, lidt Ochre |
| `mail_shirt` | Mail Shirt | Ringbrynje til midt på låret, korte ærmer, 1 px prikmønster, læderbælte | Iron, Leather |
| `scale_coat` | Scale Coat | Rækker af overlappende jernskæl, læderkanter, bredere skuldre | Iron, Leather |

Ringe (Iron Ring, Bone Ring) ses ikke på figuren.

## 7. Rivalerne

De syv rivaler bruger foreløbig den baggrund, der passer til deres kampstil (Heavy → `miner`, Bows → `poacher`, Blades → `runner`, Echo → `acolyte`). Spillet viser dem med ringen i deres farve. Senere får hver sit eget kropslag på dukken med ét kendetegn, der passer til deres farve og kan ses oppefra. Forslagene herunder kan ændres:

| Id | Navn | Kampstil | Farve i spillet | Kendetegn (forslag) |
|---|---|---|---|---|
| `cassian` | Cassian Morrow | Heavy | rød | Barberet hoved, ar over øjet, rødt skærf (Madder) |
| `vessa` | Vessa Thorne | Bows | grøn | Lang fletning ned ad ryggen, tornegrøn kappe (Moss) |
| `ash` | Ash Kell | Blades | orange | Søskende med Rook i ens tøj; okkergult tørklæde (Ochre) |
| `rook` | Rook Kell | Blades | brun-orange | Som Ash, men med brunt tørklæde (Leather) |
| `mira` | Mira Silvertongue | Echo | violet | Sølvgråt hår, hætte med Echo-broderi (Stone, Echo) |
| `odo` | Silent Odo | Blades | grå-blå | Klæde for munden, grå kappe (Iron, Stone) |
| `garrick` | Garrick Vane | Heavy | blå | Pelskrave over skuldrene, blå våbenkjortel (Woad) |

## 8. Arbejdsgang med en AI

Brug et AI-værktøj, der er lavet til pixel art og kan lave 8 retninger og animationer ud fra en reference, fx PixelLab. Generelle billed-AI'er rammer sjældent et præcist pixelgitter og ens billeder fra gang til gang; brug dem kun til skitser.

1. **Lav dukken:** Miner uden rustning, stående, mod S. Gør den færdig og godkend den, før du går videre. Alt andet bygger på den. Et første eksempel er lavet i kode som en lille 3D-model, der tegnes som pixel art i 8 retninger med `idle` og `walk` ([`characters/miner.py`](characters/miner.py) og [`characters/render.py`](characters/render.py)). Det kan gives til AI'en som reference eller erstattes af en dukke fra AI'en.
2. **Lav de andre syv retninger** ud fra den.
3. **Lav animationerne én ad gangen**, `idle` og `walk` først, med dukken som reference.
4. **Ryd op** (afsnit 9), og læg filerne ind (afsnit 10). Se dem animeret i [`galleri.html`](galleri.html).
5. **Lav de andre baggrunde** med dukkens ark som reference: samme proportioner og positurer, nyt hoved og tøj.
6. **Lav rustningerne:** generér dukken i rustningen, og slet derefter alt andet end rustningen, så den bliver et lag.
7. **Lav rivalerne** til sidst.

### Stil (indledning til alle prompts)

```
Pixel art game sprite for a top-down action RPG, steep top-down view: the camera looks
down at about 60 degrees, so the top of the head and the shoulders are clearly visible,
the body is foreshortened and only a narrow strip of the face shows below the forehead.
Medieval low fantasy, worn and earthy, muted colours, limited palette. 1 px dark outline,
light from the top left, flat shading with 2-3 tones per material, no anti-aliasing,
no gradients. Transparent background, no ground shadow, no glow, no text.
One character on a 64x64 px canvas, 45-50 px from the top of the head to the toes,
standing on the point 32 px from the left and 16 px above the bottom edge.
Empty hands, closed as if gripping a handle (no weapon, no shield).
```

### Dukken

```
<stil>
A stocky medieval crystal miner: very broad shoulders, sooty face, a close-fitting padded
leather cap that ends above the forehead, rough wool shirt with rolled-up sleeves, leather
trousers, heavy boots, a few small pale blue crystal specks on the clothes.
Standing still, facing the camera (south).
```

### De andre baggrunde

```
<stil>
Use the attached character as reference: keep the body proportions, pose, outline and
shading identical. Change only the head, hair and clothes:
<udseende fra afsnit 5, på engelsk>
```

Udseendet på engelsk:

- **Poacher:** `A lean poacher: short hooded cloak in moss green over the shoulders, leather bracer on the left forearm, soft boots, a pouch on the belt.`
- **Temple Acolyte:** `A slender temple acolyte: ankle-length undyed robe with blue trim and a rope belt, close-cropped hair, ink-stained fingers, a small pale blue crystal pendant.`
- **Street Runner:** `A wiry street runner: short blue tunic, a long dull red scarf trailing behind, wrapped shins, a satchel strap across the chest.`

### Retninger

```
<stil>
The same character as the reference, identical proportions, colours and outline.
Facing <north | north-east | east | south-east | south-west | west | north-west>.
```

### Animation

```
<stil>
Use the attached character as reference and keep it identical.
Animation: <navn>, <antal> frames, facing <retning>. <beskrivelse fra afsnit 4, på engelsk>
The character stays on the same ground point.
```

Eksempel: `Animation: walk cycle, 6 frames, facing south. The legs swing forward and back, the arms swing opposite, and the body bobs at most 1 px.`

### Rustning

```
<stil>
Use the attached character as reference and keep the pose identical. Dress the character
in <rustning>. Do not change the head, hands or boots.
```

Rustningerne på engelsk: `a quilted padded coat to the thigh with visible stitching`, `a hardened leather jerkin with straps and a buckle`, `a riveted mail shirt to mid-thigh with short sleeves and a leather belt`, `a coat of overlapping iron scales with leather edges and broad shoulders`.

## 9. Oprydning efter AI'en

AI'en rammer sjældent alle regler. Ret det i Aseprite eller LibreSprite:

1. **Paletten:** sæt billedet til indekserede farver med `palette.hex`, så farver uden for paletten forsvinder.
2. **Pixels:** fjern halvgennemsigtige pixels og løse pixels, og luk huller i konturen.
3. **Placering:** flyt figuren, så fodpunktet (punktet på jorden midt under den) er (32, 48) i alle billeder.
4. **Ark:** saml billederne i rækkerne N, NE, E, SE, S, SW, W, NW (afsnit 3).
5. **Hånden:** spillet skal vide, hvor højre hånd er i hvert billede, for at sætte våbnet der. Det gøres én gang for dukken, fordi alle deler positurerne. Galleriet får senere et værktøj til det.
6. **Tjek:** kør `python3 art/tools/check_sprites.py` fra repoets rod. Det tjekker størrelse, palet, gennemsigtighed, fodpunkt, margen og midte (afsnit 11) for alle ark under `apps/web/assets/characters`, eller for de filer, du giver det.

## 10. Filer og navne

Arbejdsfilerne ligger under `art/`, og de færdige PNG'er under `apps/web/assets/`. Mapper og filer hedder efter id'erne i spillet og animationerne i afsnit 4.

```
art/
  palette.hex, palette.png             paletten
  galleri.html                         arkene animeret i 8 retninger og på minernes gulv
  tools/check_sprites.py               tjekket i afsnit 11
  characters/…                         arbejdsfiler, fx miner.py og render.py (dukken som 3D-model)
apps/web/assets/characters/
  body/<baggrund>/<animation>.png      miner, poacher, acolyte, runner
  armour/<rustning>/<animation>.png    padded_coat, leather_jerkin, mail_shirt, scale_coat
  rivals/<rival>/<animation>.png       cassian, vessa, ash, rook, mira, odo, garrick
```

Eksempel: `apps/web/assets/characters/body/miner/walk.png` er 384 × 512 px (6 billeder × 8 retninger).

## 11. Tjekliste før en figur godkendes

- [ ] Arket har den rigtige størrelse: antal billeder × 64 i bredden og 8 × 64 i højden (death: 64).
- [ ] Rækkerne står N, NE, E, SE, S, SW, W, NW.
- [ ] Kun farver fra `palette.hex`, og Echo og Ember kun til Echo og ild.
- [ ] Ingen halvgennemsigtige pixels, ingen skygge, glød, baggrund eller tekst.
- [ ] Figuren står om fodpunktet (32, 48), går højst ned til y = 61 og hopper ikke i `idle`.
- [ ] Samme proportioner og positurer som dukken, og samme vinkel oppefra.
- [ ] Tomme hænder.
- [ ] Baggrunden kan kendes på silhuetten oppefra, også i 64 px.
- [ ] Loops (`idle`, `walk`) glider fra sidste billede tilbage til første uden hop.

## 12. Åbne valg

1. **Udseende ved oprettelse:** skal spilleren kunne vælge krop, hudtone og hår? Det er ny adfærd og skal først ind i modellen (Feature-001 Create character).
2. **Brandet:** skal kandidaternes Brand kunne ses på figuren, fx som et lille Echo-mærke på håndryggen? På 1–2 px er det svært at se.
3. **Paletten** kan stadig ændres nu. Når mange figurer er lavet, bliver det dyrt.
