import { test, expect, detaljUrl, authSti } from "../lib/fixtures";
import { opprettSjekkliste } from "../lib/flyt";

// (3) Send → status kollapser til Mottatt (draft → received), ballen hos neste ledd.
test.use({ storageState: authSti.firma });

test("Send → Mottatt", async ({ page, rt, apiFirma }) => {
  const id = await opprettSjekkliste(apiFirma, rt, "send");
  await page.goto(detaljUrl(rt, id));

  const badge = page.getByTestId("status-badge").first();
  await expect(badge).toHaveAttribute("data-status", "draft");

  await page.getByTestId("handling-sent").click();
  await expect(badge).toHaveAttribute("data-status", "received");
});
