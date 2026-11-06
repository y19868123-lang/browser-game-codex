import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.GAME_URL ?? "http://127.0.0.1:5173/";
const output = process.env.SCREENSHOT_DIR ?? "artifacts/mobile";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const issues = [];

async function inspect(page, name, { targets = [] } = {}) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth
  }));
  if (dimensions.documentWidth > dimensions.innerWidth + 1 || dimensions.bodyWidth > dimensions.innerWidth + 1) {
    issues.push(name + ": horizontal overflow " + JSON.stringify(dimensions));
  }
  for (const selector of targets) {
    const elements = page.locator(selector);
    const count = await elements.count();
    assert(count > 0, name + ": missing touch targets " + selector);
    for (let i = 0; i < count; i++) {
      const el = elements.nth(i);
      if (!(await el.isVisible())) continue;
      const rect = await el.boundingBox();
      if (rect && (rect.height < 44 || rect.width < 44)) {
        issues.push(name + ": touch target " + selector + "[" + i + "] is " + Math.round(rect.width) + "x" + Math.round(rect.height));
      }
    }
  }
  await page.screenshot({ path: output + "/" + name + ".png", fullPage: true });
  console.log(name + ": viewport=" + dimensions.innerWidth + ", document=" + dimensions.documentWidth);
}

async function run(width) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".tabs [role=tab]").first().waitFor();
  const prefix = width + "px";

  assert.equal(await page.locator('.tabs [role="tab"]').count(), 3);
  await inspect(page, prefix + "-journey", { targets: [".tabs button", ".scene button"] });

  await page.locator('[data-tab="town"]').click();
  assert.equal(await page.locator('[data-tab="town"]').getAttribute("aria-selected"), "true");
  assert.equal(await page.locator(".forge-step").count(), 3, "forge should separate enhancement, crafting, and synthesis");
  assert.equal(await page.locator('[data-craft="forge_field_iron_blade"]').isDisabled(), true, "unaffordable recipe should be disabled");
  await inspect(page, prefix + "-town", { targets: [".tabs button", ".store-actions button", '[data-action="rest"]', ".forge-panel button"] });

  await page.locator('[data-action="rest"]').click();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("ayakashi-no-kuni.save"));
    state.gold = 200;
    const ore = state.inventory.find((entry) => entry.id === "iron_ore");
    if (ore) ore.quantity = 12;
    else state.inventory.push({ id: "iron_ore", quantity: 12 });
    state.inventory.push({ id: "spirit_dew", quantity: 8 }, { id: "oni_fang", quantity: 4 });
    localStorage.setItem("ayakashi-no-kuni.save", JSON.stringify(state));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-tab="town"]').click();
  await page.locator('[data-craft="forge_field_iron_blade"]').click();
  assert((await page.locator(".forge-panel .recent-event").innerText()).includes("製作"), "craft result should appear in the forge");
  const synthesis = page.locator('[data-synthesize^="temper_twilight_blade:"]');
  assert.equal(await synthesis.count(), 1, "crafted instance should be a synthesis target");
  await synthesis.click();
  assert((await page.locator(".forge-panel .recent-event").innerText()).includes("合成"), "synthesis result should appear in the forge");
  const craftedSave = await page.evaluate(() => JSON.parse(localStorage.getItem("ayakashi-no-kuni.save")));
  assert(craftedSave.inventory.some((entry) => entry.id === "twilight_iron_blade" && entry.instanceId), "synthesized equipment should be saved with an instance ID");

  await page.locator(".store-actions [data-buy]").first().click();
  assert(await page.locator(".town-grid .main-column > .panel:first-child .recent-event").isVisible(), "store result should appear near shop");
  const swordSales = page.locator(".store").first().locator(".sell-list button");
  assert.equal(await swordSales.count(), 2, "same-name equipment should have separate sale choices");
  assert.equal(await swordSales.first().isDisabled(), true, "equipped instance must not be sellable");
  assert((await swordSales.nth(1).innerText()).includes("竹刀 +0"), "enhancement should identify the purchased copy");

  await page.locator('[data-tab="npc"]').click();
  assert.equal(await page.locator('[data-tab="npc"]').getAttribute("aria-selected"), "true");
  await inspect(page, prefix + "-npc", { targets: [".tabs button"] });

  await page.locator('[data-tab="journey"]').click();
  await page.locator(".gear-access summary").click();
  assert(await page.locator(".gear-access").evaluate((el) => el.open), "gear should open");
  await inspect(page, prefix + "-gear", { targets: [".tabs button", ".gear-access summary", ".inventory button"] });

  await page.locator('[data-dungeon="twilight_field"]').click();
  await page.locator(".direction-pad").waitFor();
  assert(await page.locator('.map-room.unknown').count() > 0, "unknown rooms should be visible without names");
  assert(!(await page.locator(".dungeon-map").innerText()).includes("夕霞の原"), "unvisited room name leaked");
  await inspect(page, prefix + "-dungeon", { targets: [".tabs button", ".direction-pad button"] });

  await page.locator('[data-direction="right"]').click();
  await page.locator(".battle").waitFor();
  assert.equal(await page.locator(".direction-pad").count(), 0, "movement UI must be hidden in battle");
  assert((await page.locator(".skill-actions").innerText()).includes("物理技"), "skill category should be visible");
  assert((await page.locator(".skill-actions").innerText()).includes("MP 3"), "actual skill MP cost should be visible");
  await inspect(page, prefix + "-battle", { targets: [".tabs button", ".battle-actions button", ".skill-actions button"] });

  const before = await page.evaluate(() => ({
    player: JSON.parse(localStorage.getItem("ayakashi-no-kuni.save")),
    npc: JSON.parse(localStorage.getItem("ayakashi-no-kuni.npcs.v1"))
  }));
  assert(before.player?.battle, "battle should be saved");
  assert(before.npc?.version === 1 && before.npc?.state?.tick > 0, "versioned NPC ticks should be saved");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".battle").waitFor();
  const after = await page.evaluate(() => ({
    player: JSON.parse(localStorage.getItem("ayakashi-no-kuni.save")),
    npc: JSON.parse(localStorage.getItem("ayakashi-no-kuni.npcs.v1"))
  }));
  assert.deepEqual(after, before, "player and NPC saves must survive reload");
  await inspect(page, prefix + "-reloaded", { targets: [".tabs button", ".battle-actions button"] });
  if (errors.length) issues.push(prefix + ": JavaScript errors: " + errors.join("; "));
  await context.close();
}

try {
  await run(390);
  await run(320);
  assert.deepEqual(issues, [], issues.join("\n"));
  console.log("PASS: mobile viewport, touch targets, tabs, dungeon, battle, localStorage");
} finally {
  await browser.close();
}
