import "./styles.css";
import { battleAction, changeJob, enhanceWeapon, equip, explore, initialState, rest, useSkill } from "./game/engine";
import { createNpcStates, simulateNpcTick } from "./game/npc";
import { createBrowserStorage, createNpcStorage } from "./game/persistence";
import { buyFromStore, sellToStore } from "./game/store";
import type { NpcSimulationState } from "./game/types";
import { enterDungeon, leaveDungeon, moveDungeonRoom, travelToTown } from "./game/world";
import { getDirectionalExits, renderApp, type ActiveTab, type Direction } from "./ui/view";

const storage = createBrowserStorage();
const npcStorage = createNpcStorage();
let state = storage.load() ?? initialState();
let activeTab: ActiveTab = "journey";
let showCompletion = Boolean(state.dungeon?.completed);
let npcSimulation: NpcSimulationState = npcStorage.load() ?? { tick: 0, npcs: createNpcStates(), events: [] };
let saveFailed = false;
const app = document.querySelector<HTMLDivElement>("#app")!;

const render = (): void => {
  const gearOpen = app.querySelector<HTMLDetailsElement>(".gear-access")?.open ?? false;
  app.innerHTML = renderApp(state, activeTab, showCompletion, npcSimulation);
  const gear = app.querySelector<HTMLDetailsElement>(".gear-access");
  if (gear) gear.open = gearOpen;
  if (saveFailed) app.querySelector(".play-mode")!.insertAdjacentHTML("afterend", '<p class="save-warning" role="alert">保存できませんでした。ブラウザーの保存設定と空き容量を確認してください。再読み込みすると今回の進行を失う可能性があります。</p>');
};
const finishAction = (previouslyCompleted = Boolean(state.dungeon?.completed)): void => {
  if (!previouslyCompleted && state.dungeon?.completed) showCompletion = true;
  npcSimulation = simulateNpcTick(npcSimulation, state.economy);
  try { storage.save(state); npcStorage.save(npcSimulation); saveFailed = false; }
  catch { saveFailed = true; }
  render();
};

const moveInDirection = (direction: Direction): boolean => {
  if (!state.dungeon || state.battle) return false;
  const exit = getDirectionalExits(state).find((candidate) => candidate.direction === direction);
  if (!exit) return false;
  const previouslyCompleted = state.dungeon.completed;
  state = moveDungeonRoom(state, exit.roomId);
  finishAction(previouslyCompleted);
  return true;
};

app.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action], [data-tab], [data-direction], [data-equip], [data-town], [data-job], [data-skill], [data-dungeon], [data-buy], [data-sell]");
  if (!target || target.matches(":disabled")) return;
  if (target.dataset.tab) {
    activeTab = target.dataset.tab as ActiveTab;
    render();
    return;
  }
  if (target.dataset.direction) {
    moveInDirection(target.dataset.direction as Direction);
    return;
  }
  const previouslyCompleted = Boolean(state.dungeon?.completed);
  const action = target.dataset.action;
  if (action === "dismiss-clear") {
    showCompletion = false;
    render();
    return;
  }
  if (action === "explore") state = explore(state);
  if (action === "rest") state = rest(state);
  if (action === "enhance") state = enhanceWeapon(state);
  if (action === "leave-dungeon") { state = leaveDungeon(state); activeTab = "town"; showCompletion = false; }
  if (action === "attack" || action === "guard" || action === "flee") state = battleAction(state, action);
  if (target.dataset.equip) state = equip(state, target.dataset.equip);
  if (target.dataset.town) state = travelToTown(state, target.dataset.town);
  if (target.dataset.job) state = changeJob(state, target.dataset.job);
  if (target.dataset.skill) state = useSkill(state, target.dataset.skill);
  if (target.dataset.dungeon) { state = enterDungeon(state, target.dataset.dungeon); activeTab = "journey"; showCompletion = false; }
  if (target.dataset.buy) { const [storeId, itemId] = target.dataset.buy.split(":"); state = buyFromStore(state, storeId, itemId); }
  if (target.dataset.sell) { const [storeId, itemId] = target.dataset.sell.split(":"); state = sellToStore(state, storeId, itemId); }
  finishAction(previouslyCompleted);
});

document.addEventListener("keydown", (event) => {
  const element = event.target as HTMLElement | null;
  if (element?.matches("input, textarea, select, [contenteditable='true']")) return;
  const directions: Partial<Record<string, Direction>> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  const direction = directions[event.key];
  if (!direction || activeTab !== "journey") return;
  if (moveInDirection(direction)) event.preventDefault();
});

render();
