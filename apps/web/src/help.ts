// Feature-030 VIEW-01 Help: genvejstasterne, korte tekster om spillet og Bestiary som faner i venstre side, et gennemsigtigt
// overlay i Rim og under en Tithe. Tastelisten viser det, der faktisk ligger på hotbaren hos den karakter, der spilles.

import { BALANCE as B, HOTBAR_KEYS, hotbarSlotName, type Hotbar } from '@maw/rules';
import { esc } from './dom.ts';

const A = B.arena;

/** Feature-030: emnerne i den rækkefølge, fanerne står i, mellem Keys og Bestiary. */
const TOPICS: [string, string][] = [
  ['The Tithe', 'Up to eight candidates – players and NPC rivals – race to the Warden. Slay him and walk through the gate to be the Champion. A fall, or leaving, loses what you found in the Tithe, but never what you brought down.'],
  ['The Reaches', 'A Tithe is in one of three Reaches. The Old Mines: three depths of tunnels with The Foreman at the bottom. The Broken City: one great ruin with The Smelter in the foundry in the middle; its districts are sealed from the outside in, and large houses and factories have upper floors up the stairs. The Woods: an old forest of huts, clearings and brigand camps with The Antlered King in the heart; it is sealed from the forest edge in.'],
  ['Fighting', 'Aim is automatic: you strike the nearest enemy in reach. A number key with a weapon draws it for Space; a key with an Echo Art or your talent uses it at once, and Space keeps your weapon. Blades swing narrow arcs, heavy weapons wide ones, bows shoot arrows. Monsters that strike up close show their reach in red before they hit – dodge through it. Monsters that shoot give no warning. The higher a monster\u2019s level, the more life, damage and armour it has, and the faster it strikes and moves. For the first 20 seconds no candidate may strike another.'],
  ['Hiding', `In The Woods and in the Arena, a bush hides you. Others see you fade in as they come closer – invisible beyond ${B.talent.bushFadeFrom} tiles, ${Math.round(B.talent.bushNear * 100)} % see-through at 1 tile – and can strike you only within ${A.bushSight} tiles, or for ${A.revealSeconds} seconds after you strike or cast. Your own party always sees you. Hidden, you can sneak past sleeping monsters, and a monster that loses sight of you stops the hunt. A Street Runner can hide anywhere with Hide.`],
  ['Skills and Marks', 'Every blow that lands trains the skill that dealt it; strong enemies teach more. Skills grow slowly: your Mark caps them at 10 + 5 × Mark. Besides the weapon skills and Echo Arts, every character has its background\u2019s talent and Reveal, which reads unidentified items. Slain enemies give Echo, and enough Echo burns a new Mark into your Brand – one Tithe for the first, several for the later ones, up to Mark 20 – with 3 attribute points and 2 skill points.'],
  ['Talents', `Every background has a talent, a skill of its own that grows when you use it: ${Object.values(B.talents).map((d) => `${d.name} (${B.backgrounds.find((b) => b.id === d.background)?.name}, ${d.cost} ${d.resource})`).join(', ')}. Put it on a key from the Spells tab; pressing the key uses the talent at once, and Space still strikes with your weapon. Hide makes you see-through, even in plain sight, until you strike. Berserk makes your melee reach farther and swing wider, up to all around you. Haste makes you move and shoot faster. Healing Circle heals you and your party standing in it.`],
  ['Echo Arts', `Echo Arts are known in the mind, not written in a book. There are 28 on nine levels: every Branded knows Echo Bolt and the level-1 arts, and a new level opens at Echo Arts 10, 20 … 80. Put an art on a key and press the key to cast it: it costs focus and then waits for its cooldown, which the hotbar shows. Arts that strike train Echo Arts. Party arts reach you and your party within ${B.echo.partyRadius} tiles. The strongest arts cost more focus than a new character has – Intelligence gives more.`],
  ['The character sheet', 'Press C. Character shows your Mark, Echo, attributes, skills and combat values, with + buttons while you have points to spend. Equipment shows what you wear and carry: point at an item, and the values it would change turn yellow and show what they would be with it. Spells is the spellbook, three levels at a time. On Equipment and Spells the hotbar stands at the top: click a weapon or a known Echo Art and press 1–8, or use Equip and Unequip on a spell; × clears a key.'],
  ['Gear and loot', `Walk over loot to pick it up; items need room in your pack. You wear a melee weapon, a ranged weapon, armour, two rings and an amulet. Rare amulets can make you faster – haste for attacks and Echo Arts, speed on your feet – or give life or stamina every second. Weapons and armour have requirements – a skill and an attribute – shown in red when you do not meet them. Magic items are rare: a magic item has one small affix and a rare one two, and the affixes of everything you wear add up. Everything you wear and carry has a weight: carry more than your Strength and Constitution allow, and every strike, dodge and talent costs more stamina. Magic items found in the Maw are unidentified: they work, but you do not know what they do until you Reveal them in a Tithe (10 focus, a chance that grows with your Reveal skill) or pay Hesta at the Forge to identify everything. Items found in a Tithe are lost if you fall.`],
  ['Hunger and supplies', `Hunger falls as you fight. At 0 you starve: stamina recovers slowly and life not at all. A ration restores ${B.hunger.rationRestores} hunger, a potion ${Math.round(B.combat.potionHeal * 100)} % of your life and a focus potion ${Math.round(B.combat.focusPotionRestore * 100)} % of your focus. You carry at most ${B.character.maxConsumables} of each. All are rare in the Maw, so bring them from the Apothecary.`],
  ['The Mirrormaster', 'Lucan Ilveth runs the show. Kill streaks bring sponsor gifts; a bored crowd brings beasts. Depth 1 is sealed after 4 minutes and depth 2 after 8 – a sealed depth wounds everyone still in it.'],
  ['The Rim', `Between Tithes you walk the Mustering Square: Hesta Varn’s Forge to the west, Mother Quill’s Apothecary to the east, the Patrons’ Hall to the north – it glows when gifts wait – and the Tithe Board in the middle. Your Chest keeps ${B.chest.size} items safe between Tithes, and the Arena is where players fight each other. Stand at a place and press F. The Crown pays a purse after every Tithe.`],
  ['Playing with others', 'Open a Tithe with a name of your own, or join one a friend has opened. The player who opened it launches it, and NPC rivals fill the places that are left. In the first 20 seconds you can invite the other players into your party (O). Party members never hurt each other; anyone else may strike you once the grace is over, and a player who is struck down spills some of their gold.'],
  ['The Arena', 'At the Arena on the square you fight other players 1:1, 2:1 or 2:2 with your own character, for a stake of gold that the winners share. Rocks and trees block the way and the missiles, and bushes hide you (see Hiding). After two minutes the ring closes in. Nothing else is won or lost: no Echo, no training, and your potions come back.'],
];

/** Fanernes id'er: keys, et emne pr. titel og bestiary. */
export const HELP_TABS: { id: string; name: string }[] = [
  { id: 'keys', name: 'Keys' },
  ...TOPICS.map(([title]) => ({ id: title.toLowerCase().replace(/[^a-z]+/g, '-'), name: title })),
  { id: 'bestiary', name: 'Bestiary' },
];

/** Feature-030 VIEW-01: Bestiary – monstrene i hver Reach med deres levels og kampmåde (Feature-011). */
function bestiaryHtml(): string {
  return B.reaches.map((reach) => {
    const rows = Object.values(B.monsters.types)
      .filter((m) => m.home === reach.id)
      .map((m) => {
        const where = m.warden ? 'Warden' : m.areas ? `${reach.id === 'city' || reach.id === 'woods' ? 'Wards' : 'Depths'} ${m.areas[0]}${m.areas[1] !== m.areas[0] ? `–${m.areas[1]}` : ''}` : '';
        return `<tr><td><span class="dot" style="background:${m.color ?? '#888'}"></span>${esc(m.name)}</td><td class="muted">${where}</td>
          <td>${esc(m.role ?? '')}${m.special ? `<div class="hint warn">${esc(m.special)}</div>` : ''}</td></tr>`;
      }).join('');
    return `<h3>${esc(reach.name)}</h3><table class="stats bestiary">${rows}</table>`;
  }).join('') + `<p class="hint">A monster's level is the area's level – the Tithe's level, set by the Mark of the player who launched it,
    + 1 for every depth or ward after the first – minus 1 to plus 2. Veterans are named in gold and are 3 levels above the area.</p>`;
}

function keysHtml(hotbar: Hotbar, weaponName: (id: string) => string): string {
  const hotkeys = HOTBAR_KEYS.map((k) => {
    const slot = hotbar[k];
    const what = !slot ? 'nothing' : hotbarSlotName(slot, weaponName, B);
    return `<tr><td><kbd>${k}</kbd></td><td>${esc(what)}</td></tr>`;
  }).join('');
  const keys: [string, string][] = [
    ['W A S D / arrows', 'Move'], ['Space', 'Attack with the chosen weapon'], ['1–8, or click a slot', 'Draw the weapon on the key, or cast its Echo Art or use its talent at once'], ['Shift', 'Dodge'],
    ['Q', 'Potion'], ['E', 'Focus potion'], ['R', 'Ration'], ['F', 'Descend, climb the stairs, the gate and the places on the square'],
    ['C', 'Character'], ['O', 'Other players'], ['H', 'Help'], ['Esc', 'Close'],
  ];
  return `<h3>Keys</h3><table class="stats">${keys.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table>
    <h3>Your hotbar</h3><table class="stats">${hotkeys}</table>`;
}

/** Feature-030 VIEW-01: fanerne i venstre side og det valgte emne til højre. */
export function helpHtml(hotbar: Hotbar, weaponName: (id: string) => string, tab = 'keys'): string {
  const current = HELP_TABS.some((t) => t.id === tab) ? tab : 'keys';
  const nav = HELP_TABS.map((t) => `<button class="${t.id === current ? 'active' : ''}" data-act="help-tab" data-id="${t.id}" aria-pressed="${t.id === current}">${esc(t.name)}</button>`).join('');
  const topic = TOPICS.find(([title]) => HELP_TABS.find((t) => t.id === current)?.name === title);
  const body = current === 'keys' ? keysHtml(hotbar, weaponName)
    : current === 'bestiary' ? `<h3>Bestiary</h3>${bestiaryHtml()}`
      : `<h3>${esc(topic![0])}</h3><p>${esc(topic![1])}</p>`;
  return `<div class="overlay see-through"><div class="sheet help">
    <header class="top"><h2>Help</h2><button class="ghost" data-act="close">Close</button></header>
    <div class="help-layout"><nav class="help-tabs">${nav}</nav><div class="box help-body">${body}</div></div>
  </div></div>`;
}
