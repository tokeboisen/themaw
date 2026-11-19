// Feature-030 VIEW-01 Help: genvejstasterne og korte tekster om spillet, som et gennemsigtigt overlay i Rim og under en
// Tithe. Tastelisten viser det, der faktisk ligger på hotbaren hos den karakter, der spilles.

import { HOTBAR_KEYS, type Hotbar } from '@maw/rules';
import { esc } from './dom.ts';

const TOPICS: [string, string][] = [
  ['The Tithe', 'Up to eight candidates – players and NPC rivals – race down three depths of the Old Mines. Slay The Foreman at the bottom and walk through the gate to be the Champion. A fall, or leaving, loses what you found in the Tithe, but never what you brought down.'],
  ['Fighting', 'Aim is automatic: you strike the nearest enemy in reach. Blades swing narrow arcs, heavy weapons wide ones, bows shoot arrows. Monsters wind up before they attack – dodge through it. For the first 20 seconds no candidate may strike another.'],
  ['Skills and Marks', 'Every blow that lands trains the skill that dealt it; strong enemies teach more. Slain enemies give Echo, and enough Echo burns a new Mark into your Brand: 3 attribute points and 2 skill points to spend on the character sheet, also during a Tithe.'],
  ['Gear and loot', 'Walk over loot to pick it up. Items need room in your pack. Equip, unequip, drop and set your hotbar on the character sheet. Items found in a Tithe are lost if you fall.'],
  ['Hunger and supplies', 'Hunger falls as you fight. At 0 you starve: stamina recovers slowly and life not at all. A ration restores 45 hunger, a potion 40 % of your life. You carry at most 9 of each.'],
  ['The Mirrormaster', 'Lucan Ilveth runs the show. Kill streaks bring sponsor gifts; a bored crowd brings beasts. Depth 1 is sealed after 4 minutes and depth 2 after 8 – a sealed depth wounds everyone still in it.'],
  ['The Rim', 'Between Tithes you rest in the Rim: buy and sell at the Forge, buy supplies at the Apothecary, and accept the Noble Houses’ gifts in the Patrons’ Hall. The Crown pays a purse after every Tithe.'],
  ['Playing with others', 'Open a Tithe with a name of your own, or join one a friend has opened. The player who opened it launches it, and NPC rivals fill the places that are left. In the first 20 seconds you can invite the other players into your party (O). Party members never hurt each other; anyone else may strike you once the grace is over, and a player who is struck down spills some of their gold.'],
];

export function helpHtml(hotbar: Hotbar, weaponName: (id: string) => string): string {
  const hotkeys = HOTBAR_KEYS.map((k) => {
    const slot = hotbar[k];
    const what = !slot ? 'nothing' : 'echoArt' in slot ? slot.echoArt : weaponName(slot.weapon);
    return `<tr><td><kbd>${k}</kbd></td><td>${esc(what)}</td></tr>`;
  }).join('');
  const keys: [string, string][] = [
    ['W A S D / arrows', 'Move'], ['Space', 'Attack'], ['1–8, or click a slot', 'Hotbar'], ['Shift', 'Dodge'], ['Q', 'Potion'], ['R', 'Ration'],
    ['F', 'Descend and the gate'], ['C', 'Character'], ['O', 'Other players'], ['H', 'Help'], ['Esc', 'Close'],
  ];
  return `<div class="overlay see-through"><div class="sheet">
    <header class="top"><h2>Help</h2><button class="ghost" data-act="close">Close</button></header>
    <div class="cols">
      <div class="box"><h3>Keys</h3><table class="stats">${keys.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table>
        <h3>Your hotbar</h3><table class="stats">${hotkeys}</table></div>
      <div class="box">${TOPICS.map(([title, text]) => `<h3>${title}</h3><p>${esc(text)}</p>`).join('')}</div>
    </div>
  </div></div>`;
}
