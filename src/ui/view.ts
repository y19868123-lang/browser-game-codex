import { dungeons } from "../data/dungeons";
import { enemies } from "../data/enemies";
import { items } from "../data/items";
import { jobs } from "../data/jobs";
import { npcs } from "../data/npcs";
import { skills } from "../data/skills";
import { stores } from "../data/stores";
import { towns } from "../data/towns";
import { expToNext, weaponPower } from "../game/engine";
import type { DungeonRoom, GameState, NpcSimulationState } from "../game/types";

export type ActiveTab = "journey" | "town" | "npc";
export type Direction = "up" | "down" | "left" | "right";
export interface DirectionalExit { direction: Direction; roomId: string; visited: boolean; roomName?: string }

const directionOrder: Direction[] = ["up", "left", "right", "down"];
const directionLabel: Record<Direction, string> = { up: "北", down: "南", left: "西", right: "東" };
const arrow: Record<Direction, string> = { up: "↑", down: "↓", left: "←", right: "→" };
const bar = (value: number, max: number, kind: string) => `<div class="bar ${kind}"><i style="width:${Math.min(100, value / max * 100)}%"></i></div>`;
const currentRoom = (state: GameState): DungeonRoom | undefined => state.dungeon ? dungeons[state.dungeon.dungeonId]?.rooms.find((room) => room.id === state.dungeon?.currentRoomId) : undefined;
const getDirection = (from: DungeonRoom, to: DungeonRoom): Direction | undefined => {
  if (to.x === from.x && to.y === from.y - 1) return "up";
  if (to.x === from.x && to.y === from.y + 1) return "down";
  if (to.x === from.x - 1 && to.y === from.y) return "left";
  if (to.x === from.x + 1 && to.y === from.y) return "right";
  return undefined;
};

export const getDirectionalExits = (state: GameState): DirectionalExit[] => {
  const room = currentRoom(state);
  if (!state.dungeon || !room) return [];
  const dungeon = dungeons[state.dungeon.dungeonId];
  return room.links.flatMap((roomId) => {
    const target = dungeon.rooms.find((candidate) => candidate.id === roomId);
    const direction = target ? getDirection(room, target) : undefined;
    if (!target || !direction) return [];
    const visited = state.dungeon!.visitedRoomIds.includes(roomId);
    return [{ direction, roomId, visited, roomName: visited ? target.name : undefined }];
  }).sort((a, b) => directionOrder.indexOf(a.direction) - directionOrder.indexOf(b.direction));
};

const recentEvent = (state: GameState, compact = false) => {
  const latest = state.log[0];
  return `<section class="recent-event ${compact ? "compact" : ""}" aria-live="polite"><p class="eyebrow">直近の出来事</p><p class="${latest.tone}">◆ ${latest.text}</p></section>`;
};

const equipmentPanel = (state: GameState) => {
  const equipment = Object.entries(state.equipment).map(([slot, item]) => `<div class="equipment"><span>${slot === "weapon" ? "武器" : slot === "armor" ? "防具" : "装飾"}</span><b>${item ? `${items[item.id].name}${item.enhancement ? ` +${item.enhancement}` : ""}` : "なし"}</b></div>`).join("");
  return `<section class="panel compact-panel"><p class="eyebrow">身支度</p><h2>装備</h2>${equipment}<p class="statline">STR ${state.stats.str}　VIT ${state.stats.vit}　DEX ${state.stats.dex}<br>INT ${state.stats.int}　LUK ${state.stats.luk}　業 ${state.stats.karma}</p><p class="power">攻撃力 <b>${weaponPower(state) + state.stats.str + Math.floor(state.stats.dex / 3)}</b></p></section>`;
};

const inventoryPanel = (state: GameState) => {
  const inventory = state.inventory.map((entry) => {
    const item = items[entry.id];
    const equipAttribute = item.kind !== "material" ? `data-equip="${item.id}"` : "";
    return `<button class="item rarity-${item.rarity}" ${equipAttribute} ${state.battle ? "disabled" : ""}><span>${item.name}${entry.enhancement ? ` +${entry.enhancement}` : ""}</span><small>×${entry.quantity}　${item.description}</small></button>`;
  }).join("");
  return `<section class="panel compact-panel"><p class="eyebrow">荷袋</p><h2>持ち物</h2><div class="inventory">${inventory || "何も持っていない。"}</div></section>`;
};

const battlePanel = (state: GameState) => {
  if (!state.battle) return "";
  const place = currentRoom(state)?.name;
  const skillButtons = state.learnedSkillIds.map((id) => `<button data-skill="${id}">${skills[id].name}<small>MP ${skills[id].mpCost}</small></button>`).join("");
  return `<section class="battle panel"><div class="battle-status"><p class="eyebrow">${place ? `${place}での戦い` : "妖との戦い"}</p><h2>${state.battle.enemy.name}</h2><p class="battle-message">${state.battle.message}</p>${bar(state.battle.enemyHp, state.battle.enemy.hp, "enemy")}<small>${state.battle.enemyHp} / ${state.battle.enemy.hp}</small>${recentEvent(state, true)}</div><div class="battle-controls"><div class="battle-actions"><button data-action="attack">斬る</button><button data-action="guard">構える</button><button class="quiet" data-action="flee">退く</button></div><div class="skill-actions">${skillButtons}</div></div></section>`;
};

const mapPanel = (state: GameState) => {
  if (!state.dungeon) return "";
  const dungeon = dungeons[state.dungeon.dungeonId];
  const room = currentRoom(state)!;
  const exits = getDirectionalExits(state);
  const visibleIds = new Set([...state.dungeon.visitedRoomIds, ...exits.filter((exit) => !exit.visited).map((exit) => exit.roomId)]);
  const mapCells = dungeon.rooms.filter((candidate) => visibleIds.has(candidate.id)).map((candidate) => {
    const visited = state.dungeon!.visitedRoomIds.includes(candidate.id);
    const isCurrent = candidate.id === room.id;
    const label = isCurrent ? `現在地：${candidate.name}` : visited ? `訪問済み：${candidate.name}` : "未探索の場所";
    return `<div class="map-room ${isCurrent ? "current" : visited ? "visited" : "unknown"}" style="grid-column:${candidate.x + 1};grid-row:${candidate.y + 1}" aria-label="${label}" title="${label}">${isCurrent ? "●" : visited ? "○" : "？"}</div>`;
  }).join("");
  const unresolvedBattle = (room.type === "battle" || room.type === "boss") && !state.dungeon.clearedRoomIds.includes(room.id);
  const directionButtons = directionOrder.map((direction) => {
    const exit = exits.find((candidate) => candidate.direction === direction);
    const disabled = !exit || unresolvedBattle;
    const known = exit?.visited ? "既知" : exit ? "未知" : "道なし";
    const label = exit ? `${directionLabel[direction]}へ：${exit.roomName ?? "未知の場所"}` : `${directionLabel[direction]}：道なし`;
    return `<button class="direction direction-${direction}" data-direction="${direction}" aria-label="${label}" ${disabled ? "disabled" : ""}><b>${arrow[direction]}</b><small>${known}</small></button>`;
  }).join("");
  return `<section class="panel dungeon-panel"><div class="section-title"><div><p class="eyebrow">探索地図</p><h2>${dungeon.name}</h2></div><button class="quiet" data-action="leave-dungeon">町へ戻る</button></div><p class="current-location">現在地　<strong>${room.name}</strong></p><div class="map-and-move"><div><div class="dungeon-map">${mapCells}</div><div class="map-legend"><span>● 現在地</span><span>○ 訪問済み</span><span>？ 未探索</span></div></div><div class="direction-pad" aria-label="方向移動">${directionButtons}<div class="direction-center" aria-hidden="true">●</div></div></div>${unresolvedBattle ? `<p class="route-lock">立ちはだかる敵を退けるまで、ほかの場所へは進めない。</p>` : ""}</section>`;
};

const completionPanel = (state: GameState, showCompletion: boolean) => {
  if (!state.dungeon?.completed || !showCompletion) return "";
  const dungeon = dungeons[state.dungeon.dungeonId];
  const bossRoom = dungeon.rooms.find((room) => room.type === "boss");
  const boss = enemies.find((enemy) => enemy.id === bossRoom?.enemyId);
  return `<section class="completion panel" role="status" aria-live="polite"><p class="completion-kicker">踏破</p><h2>${dungeon.name}　踏破</h2><div class="completion-rule"></div><p>${boss?.name ?? "深層の主"}を討ち倒した。</p><div class="reward-grid"><div><h3>初回踏破報酬</h3><p>結びの根付</p><p>40文</p></div><div><h3>戦闘報酬</h3><p>${boss?.gold ?? 0}文</p><p>${boss?.exp ?? 0}経験</p></div></div><div class="completion-result"><span>今回の戦果</span><p>${state.log[0].text}</p></div><div class="button-row"><button class="primary" data-action="leave-dungeon">町へ帰る</button><button class="quiet" data-action="dismiss-clear">ダンジョンを確認する</button></div></section>`;
};

const dungeonEntryPanel = (state: GameState) => {
  const town = towns[state.locationTownId];
  return `<section class="scene panel"><p class="eyebrow">${town.name}の外れ</p><h2>次の一歩</h2><p>野辺を探索して素材を集めるか、ダンジョンへ向かおう。</p><div class="button-row"><button class="primary" data-action="explore">周辺を探索する <small>行動力 1</small></button>${town.dungeonIds.map((id) => `<button data-dungeon="${id}">${dungeons[id].name}<small> 行動力 ${dungeons[id].actionCost}</small></button>`).join("")}</div></section>`;
};

const journeyView = (state: GameState, showCompletion: boolean) => {
  const primary = state.battle ? battlePanel(state) : state.dungeon ? mapPanel(state) : dungeonEntryPanel(state);
  return `<div class="journey-layout"><div class="main-column">${!state.battle ? completionPanel(state, showCompletion) : ""}${primary}${state.battle ? "" : recentEvent(state)}</div><details class="gear-access"><summary>装備・持ち物を開く</summary><aside class="gear-column">${equipmentPanel(state)}${inventoryPanel(state)}</aside></details></div>`;
};

const forgePanel = (state: GameState) => {
  const weapon = state.equipment.weapon;
  const ore = state.inventory.find((item) => item.id === "iron_ore")?.quantity ?? 0;
  return `<section class="panel"><div class="section-title"><div><p class="eyebrow">鍛冶場</p><h2>武器を鍛える</h2></div><span>鉄鉱石 ${ore}</span></div><p>装備中の${weapon ? items[weapon.id].name : "武器"}を強化。攻撃力 +2、費用 ${12 + (weapon?.enhancement ?? 0) * 10}文。</p><button data-action="enhance" ${weapon ? "" : "disabled"}>${weapon ? `+${weapon.enhancement ?? 0} を強化` : "武器なし"}</button></section>`;
};

const townView = (state: GameState) => {
  if (state.dungeon || state.battle) return `<div class="single-column"><section class="panel town-away"><p class="eyebrow">町・市場</p><h2>いまは町を離れている</h2><p>探索を終えて町へ戻ると、宿や店、鍛冶場を利用できる。</p>${state.battle ? `<button data-tab="journey">戦いへ戻る</button>` : `<button data-action="leave-dungeon">町へ戻る</button>`}</section>${recentEvent(state)}</div>`;
  const town = towns[state.locationTownId];
  const townStores = Object.values(stores).filter((store) => store.townId === state.locationTownId);
  const storesHtml = `<section class="panel"><p class="eyebrow">町の店</p><h2>売買</h2>${townStores.map((store) => `<div class="store"><b>${store.name}</b>${store.stock.map((stock) => `<div><span>${items[stock.itemId].name}　${stock.price}文</span><span class="store-actions"><button data-buy="${store.id}:${stock.itemId}">買う</button><button class="quiet" data-sell="${store.id}:${stock.itemId}">売る</button></span></div>`).join("")}</div>`).join("") || "<p>この町の店舗は準備中です。</p>"}${recentEvent(state, true)}</section>`;
  const travel = `<section class="panel"><p class="eyebrow">町への移動</p><h2>街道</h2><div class="inventory">${Object.values(towns).map((candidate) => `<button class="item ${candidate.id === state.locationTownId ? "selected" : ""}" data-town="${candidate.id}" ${candidate.id === state.locationTownId ? "disabled" : ""}><span>${candidate.name}</span><small>${candidate.travelCost}文　${candidate.services.join("・")}</small></button>`).join("")}</div></section>`;
  const job = jobs[state.jobId];
  const career = `<section class="panel"><p class="eyebrow">職業</p><h2>${job.name}</h2><p>${job.description}</p><div class="inventory">${Object.values(jobs).filter((candidate) => candidate.id !== state.jobId).map((candidate) => `<button class="item" data-job="${candidate.id}"><span>${candidate.name}</span><small>Lv.${candidate.changeRequirement.level} / ${candidate.changeRequirement.gold}文　${candidate.description}</small></button>`).join("")}</div></section>`;
  return `<div class="town-heading"><div><p class="eyebrow">現在地</p><h2>${town.name}</h2><p>${town.description}</p></div><button data-action="rest">宿で休む</button></div>${recentEvent(state)}<div class="town-grid"><div class="main-column">${storesHtml}${forgePanel(state)}</div><aside>${travel}${career}<section class="panel future-services"><p class="eyebrow">町の噂</p><h2>これからの賑わい</h2><p>競売と賭場は準備中。町ごとの施設として、旅の進行を壊さず開かれる予定です。</p></section></aside></div>`;
};

const npcView = (simulation: NpcSimulationState) => {
  const cards = simulation.npcs.map((npcState) => {
    const definition = npcs[npcState.npcId];
    const dungeon = npcState.dungeonId ? dungeons[npcState.dungeonId] : undefined;
    const room = dungeon?.rooms.find((candidate) => candidate.id === npcState.dungeonRoomId);
    const place = dungeon ? `${dungeon.name}${room ? `・${room.name}` : ""}` : towns[npcState.townId]?.name;
    return `<article class="npc-card"><div><p class="eyebrow">${jobs[npcState.jobId].name}</p><h3>${definition.name}</h3></div><dl><div><dt>現在地</dt><dd>${place}</dd></div><div><dt>活動</dt><dd>${npcState.lastIntent?.reason ?? definition.personality}</dd></div><div><dt>成長</dt><dd>Lv.${npcState.level} / ${npcState.gold}文</dd></div></dl></article>`;
  }).join("");
  const history = simulation.events.length ? simulation.events.slice(-6).reverse().map((event) => `<li>${event}</li>`).join("") : "<li>旅人たちは、それぞれの目的に向けて支度をしている。</li>";
  return `<div class="npc-layout"><section class="panel"><p class="eyebrow">NPCの活動</p><h2>旅人たちの現在</h2><p>NPCは自ら探索・売買・成長する。プレイヤーを襲う行動は持たない。</p><div class="npc-grid">${cards}</div></section><section class="panel"><p class="eyebrow">行動履歴</p><h2>世の動き</h2><ol class="npc-history">${history}</ol><p class="tick">進行刻 ${simulation.tick}</p></section></div>`;
};

const logPanel = (state: GameState) => `<details class="panel log"><summary>旅の記録</summary><div>${state.log.map((entry) => `<p class="${entry.tone}">◆ ${entry.text}</p>`).join("")}</div></details>`;

export const renderApp = (state: GameState, activeTab: ActiveTab, showCompletion: boolean, simulation: NpcSimulationState): string => {
  const town = towns[state.locationTownId];
  const job = jobs[state.jobId];
  const tabs: Array<{ id: ActiveTab; label: string }> = [{ id: "journey", label: "旅支度" }, { id: "town", label: "町・市場" }, { id: "npc", label: "NPCの世界" }];
  const content = activeTab === "journey" ? journeyView(state, showCompletion) : activeTab === "town" ? townView(state) : npcView(simulation);
  return `<div class="shell"><header><div><p class="logo-mark">妖ノ国 ONLINE</p><h1>はじまりの旅</h1></div><div class="currency">◈ ${state.gold} 文</div></header><p class="play-mode">端末ごとのひとり旅版。セーブはこのブラウザーに保存されます。オンライン共有ワールドではありません。</p><section class="hero"><div class="portrait">旅</div><div class="identity"><p class="eyebrow">${state.dungeon ? dungeons[state.dungeon.dungeonId].name : town.name}の${job.name}</p><h2>${state.name} <span>Lv.${state.level}</span></h2><div class="meters"><label>HP <strong>${state.hp}/${state.maxHp}</strong>${bar(state.hp, state.maxHp, "hp")}</label><label>MP <strong>${state.mp}/${state.maxMp}</strong>${bar(state.mp, state.maxMp, "exp")}</label><label>行動力 <strong>${state.actionPoints}/${state.maxActionPoints}</strong>${bar(state.actionPoints, state.maxActionPoints, "ap")}</label><label>経験 <strong>${state.exp}/${expToNext(state.level)}</strong>${bar(state.exp, expToNext(state.level), "exp")}</label></div></div></section><nav class="tabs" role="tablist" aria-label="主な画面">${tabs.map((tab) => `<button role="tab" aria-selected="${activeTab === tab.id}" class="tab ${activeTab === tab.id ? "active" : ""}" data-tab="${tab.id}">${tab.label}</button>`).join("")}</nav><main class="tab-content" id="${activeTab}-panel" role="tabpanel">${content}</main>${activeTab !== "npc" ? logPanel(state) : ""}<footer>探索 ${state.explored} 回　・　討伐 ${state.defeated} 体　・　自動保存 <span>NPCはプレイヤーを襲撃しない設計です</span></footer></div>`;
};
