import { describe, expect, it } from "vitest";
import { battleAction, equip, initialState } from "../src/game/engine";
import { createNpcStates } from "../src/game/npc";
import { enterDungeon, moveDungeonRoom } from "../src/game/world";
import type { GameState, NpcSimulationState } from "../src/game/types";
import { getDirectionalExits, renderApp } from "../src/ui/view";

const simulation: NpcSimulationState = { tick: 0, npcs: createNpcStates(), events: [] };
const render = (state: GameState, tab: "journey" | "town" | "npc" = "journey", showCompletion = true) => renderApp(state, tab, showCompletion, simulation);

describe("player-facing UI", () => {
  it("renders real selected tabs and only the selected tab content", () => {
    const journey = render(initialState());
    expect(journey).toContain('data-tab="journey"');
    expect(journey).toContain('aria-selected="true" class="tab active" data-tab="journey"');
    expect(journey).toContain("次の一歩");
    expect(journey).not.toContain("武器を鍛える");

    const town = render(initialState(), "town");
    expect(town).toContain('aria-selected="true" class="tab active" data-tab="town"');
    expect(town).toContain("武器を鍛える");
    expect(town).not.toContain("次の一歩");
    expect(town).toContain("NPCの世界");
    expect(town).not.toContain("NPCの世界（基盤）");
  });

  it("maps cardinal exits without revealing an unvisited room name", () => {
    const state = enterDungeon(initialState(), "twilight_field");
    expect(getDirectionalExits(state)).toEqual([{ direction: "right", roomId: "meadow", visited: false, roomName: undefined }]);
    const html = render(state);
    expect(html).toContain('data-direction="right"');
    expect(html).toContain("未探索の場所");
    expect(html).not.toContain("夕霞の原");
    expect(html).not.toContain("雫の隠し箱");
    expect(html).not.toContain("癒やしの湧き水");
    expect(html).not.toContain("暮野の深層");
  });

  it("reveals a room only after moving into it", () => {
    const entered = enterDungeon(initialState(), "twilight_field");
    const moved = moveDungeonRoom(entered, getDirectionalExits(entered)[0].roomId);
    expect(render(moved)).toContain("夕霞の原");
  });

  it("removes dungeon movement controls while battle is active", () => {
    const battle = moveDungeonRoom(enterDungeon(initialState(), "twilight_field"), "meadow");
    const html = render(battle);
    expect(html).toContain("夕霞の原での戦い");
    expect(html).not.toContain("data-direction=");
    expect(html).not.toContain("探索地図");
    const townHtml = render(battle, "town");
    expect(townHtml).toContain("戦いへ戻る");
    expect(townHtml).not.toContain('data-action="leave-dungeon"');
  });

  it("shows the latest action beside the active operation", () => {
    const battle = moveDungeonRoom(enterDungeon(initialState(), "twilight_field"), "meadow");
    const attacked = battleAction(battle, "attack", () => 0.5);
    const html = render(attacked);
    expect(html).toContain("直近の出来事");
    expect(html).toContain(attacked.log[0].text);
  });

  it("labels skill categories and displays the actual equipped MP cost", () => {
    const beads = { id: "ash_prayer_beads", quantity: 1, enhancement: 0, instanceId: "ui-beads" };
    const battle = moveDungeonRoom(enterDungeon({ ...initialState(), learnedSkillIds: ["steady_strike", "warding_talisman"], inventory: [...initialState().inventory, beads] }, "twilight_field"), "meadow");
    const equipped = equip({ ...battle, battle: undefined }, "ui-beads");
    const html = render({ ...equipped, battle: battle.battle });
    expect(html).toContain("物理技");
    expect(html).toContain("術");
    expect(html).toContain("正眼斬り");
    expect(html).toContain("MP 2");
    expect(html).toContain("破邪の札");
    expect(html).toContain("MP 4");
  });

  it("shows special effects from the equipped individual", () => {
    const charm = { id: "lucky_charm", quantity: 1, enhancement: 0, instanceId: "ui-charm" };
    const state = equip({ ...initialState(), inventory: [...initialState().inventory, charm] }, "ui-charm");
    const html = render(state);
    expect(html).toContain("発動中の特殊効果");
    expect(html).toContain("戦利品・希少発見率 +4%");
    expect(html).toContain("LUK 5");
  });

  it("presents completed boss state and both reward groups", () => {
    const state: GameState = {
      ...initialState(),
      dungeon: {
        dungeonId: "twilight_field",
        currentRoomId: "boss",
        visitedRoomIds: ["gate", "meadow", "spring", "thicket", "watch", "boss"],
        clearedRoomIds: ["gate", "meadow", "spring", "thicket", "watch", "boss"],
        completed: true
      },
      log: [{ text: "暮野の守り手を倒し、鬼の牙を手に入れた。", tone: "good" }]
    };
    const html = render(state);
    expect(state.dungeon?.completed).toBe(true);
    expect(html).toContain("薄明の野辺　踏破");
    expect(html).toContain("暮野の守り手を討ち倒した");
    expect(html).toContain("初回踏破報酬");
    expect(html).toContain("結びの根付");
    expect(html).toContain("戦闘報酬");
    expect(html).toContain("55文");
    expect(html).toContain("64経験");
    expect(html).toContain('data-action="leave-dungeon"');
  });
});
