// Feature-030 VIEW-01 Help: genvejstasterne og korte tekster om spillet, som et gennemsigtigt overlay i Rim og under en
// Tithe. Tastelisten viser det, der faktisk ligger på hotbaren hos den karakter, der spilles.

import { BALANCE as B, HOTBAR_KEYS, type Hotbar } from '@maw/rules';
import { esc } from './dom.ts';

const TOPICS: [string, string][] = [
  ['The Tithe', 'Up to eight candidates – players and NPC rivals – race to the Warden. Slay him and walk through the gate to be the Champion. A fall, or leaving, loses what you found in the Tithe, but never what you brought down.'],
  ['The Reaches', 'A Tithe is in one of two Reaches. The Old Mines: three depths of tunnels with The Foreman at the bottom. The Broken City: one great ruin with The Smelter in the foundry in the middle; its districts are sealed from the outside in, and large houses and factories have upper floors up the stairs.'],
  ['Fighting', 'Aim is automatic: you strike the nearest enemy in reach. A number key chooses what Space uses – a weapon, which you draw, or Echo Bolt. Blades swing narrow arcs, heavy weapons wide ones, bows shoot arrows. Monsters wind up before they attack – dodge through it. For the first 20 seconds no candidate may strike another.'],
  ['Skills and Marks', 'Every blow that lands trains the skill that dealt it; strong enemies teach more. Skills grow slowly: your Mark caps them at 10 + 5 × Mark, and a weapon only trains its skill up to its skill cap. Slain enemies give Echo, and enough Echo burns a new Mark into your Brand – one Tithe for the first, several for the later ones, up to Mark 20 – with 3 attribute points and 2 skill points.'],
  ['Gear and loot', 'Walk over loot to pick it up. Items need room in your pack. Equip, unequip, drop and set your hotbar on the character sheet. Items found in a Tithe are lost if you fall.'],
  ['Hunger and supplies', 'Hunger falls as you fight. At 0 you starve: stamina recovers slowly and life not at all. A ration restores 45 hunger, a potion 40 % of your life. You carry at most 9 of each.'],
  ['The Mirrormaster', 'Lucan Ilveth runs the show. Kill streaks bring sponsor gifts; a bored crowd brings beasts. Depth 1 is sealed after 4 minutes and depth 2 after 8 – a sealed depth wounds everyone still in it.'],
  ['The Rim', 'Between Tithes you walk the Mustering Square: Hesta Varn\u2019s Forge to the west, Mother Quill\u2019s Apothecary to the east, the Patrons\u2019 Hall to the north – it glows when gifts wait – and the Tithe Board in the middle. Stand at one and press F. The Crown pays a purse after every Tithe.'],
  ['Playing with others', 'Open a Tithe with a name of your own, or join one a friend has opened. The player who opened it launches it, and NPC rivals fill the places that are left. In the first 20 seconds you can invite the other players into your party (O). Party members never hurt each other; anyone else may strike you once the grace is over, and a player who is struck down spills some of their gold.'],
];

/** Feature-030 VIEW-01: Bestiary – monstrene i hver Reach med deres levels og kampmåde (Feature-011). */
function bestiaryHtml(): string {
  return B.reaches.map((reach) => {
    const rows = Object.values(B.monsters.types)
      .filter((m) => m.home === reach.id)
      .map((m) => {
        const where = m.warden ? 'Warden' : m.areas ? `${reach.id === 'city' ? 'Wards' : 'Depths'} ${m.areas[0]}${m.areas[1] !== m.areas[0] ? `–${m.areas[1]}` : ''}` : '';
        return `<tr><td><span class="dot" style="background:${m.color ?? '#888'}"></span>${esc(m.name)}</td><td class="muted">${where}</td><td>${esc(m.role ?? '')}</td></tr>`;
      }).join('');
    return `<h3>${esc(reach.name)}</h3><table class="stats bestiary">${rows}</table>`;
  }).join('') + `<p class="hint">A monster's level is the area's level – the Tithe's level, set by the Mark of the player who launched it,
    + 1 for every depth or ward after the first – minus 1 to plus 2. Veterans are named in gold and are 3 levels above the area.</p>`;
}

export function helpHtml(hotbar: Hotbar, weaponName: (id: string) => string): string {
  const hotkeys = HOTBAR_KEYS.map((k) => {
    const slot = hotbar[k];
    const what = !slot ? 'nothing' : 'echoArt' in slot ? slot.echoArt : weaponName(slot.weapon);
    return `<tr><td><kbd>${k}</kbd></td><td>${esc(what)}</td></tr>`;
  }).join('');
  const keys: [string, string][] = [
    ['W A S D / arrows', 'Move'], ['Space', 'Attack with what is chosen on the hotbar'], ['1–8, or click a slot', 'Choose on the hotbar'], ['Shift', 'Dodge'], ['Q', 'Potion'], ['R', 'Ration'],
    ['F', 'Descend, climb the stairs, the gate and the places on the square'], ['C', 'Character'], ['O', 'Other players'], ['H', 'Help'], ['Esc', 'Close'],
  ];
  return `<div class="overlay see-through"><div class="sheet">
    <header class="top"><h2>Help</h2><button class="ghost" data-act="close">Close</button></header>
    <div class="cols">
      <div class="box"><h3>Keys</h3><table class="stats">${keys.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table>
        <h3>Your hotbar</h3><table class="stats">${hotkeys}</table></div>
      <div class="box">${TOPICS.map(([title, text]) => `<h3>${title}</h3><p>${esc(text)}</p>`).join('')}</div>
    </div>
    <div class="box"><h2>Bestiary</h2>${bestiaryHtml()}</div>
  </div></div>`;
}
