import { expect, test, type Page } from "@playwright/test";

type Hook = {
  state(): { squad: { x: number; count: number }; status: string };
  fastForward(ticks: number, targetX: number): void;
};
// page.evaluate callbacks run in the browser, so they cannot close over Node-side helpers.
const squadX = (page: Page) =>
  page.evaluate(() => (window as unknown as { __game: Hook }).__game.state().squad.x);
const status = (page: Page) =>
  page.evaluate(() => (window as unknown as { __game: Hook }).__game.state().status);

test("loads and renders with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/?seed=1");
  const box = await page.locator("canvas#game").boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test("pointer movement shifts the squad", async ({ page }) => {
  await page.goto("/?seed=1");
  const box = (await page.locator("canvas#game").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.5);
  await expect.poll(() => squadX(page)).toBeLessThan(100);
});

test("a run reaches an end state and restarts on a key press", async ({ page }) => {
  await page.goto("/?seed=1");
  await page.evaluate(() =>
    (window as unknown as { __game: Hook }).__game.fastForward(4000, 200),
  );
  await expect.poll(() => status(page)).not.toBe("playing");
  await page.waitForTimeout(600); // restart is ignored briefly so the final key press cannot skip the result
  await page.keyboard.press("Space");
  await expect.poll(() => status(page)).toBe("playing");
});

test("holding a key at game end does not restart the run", async ({ page }) => {
  await page.goto("/?seed=1");
  await page.evaluate(() =>
    (window as unknown as { __game: Hook }).__game.fastForward(4000, 200),
  );
  await expect.poll(() => status(page)).not.toBe("playing");
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(600);
  await page.keyboard.down("ArrowLeft"); // auto-repeat keydown while the key is still held
  expect(await status(page)).not.toBe("playing");
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.press("Space");
  await expect.poll(() => status(page)).toBe("playing");
});
