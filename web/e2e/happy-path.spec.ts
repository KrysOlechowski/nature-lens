import { expect, test } from "@playwright/test";

const mockApiBaseUrl = "http://127.0.0.1:3101";

test.beforeEach(async ({ request }) => {
  const response = await request.post(`${mockApiBaseUrl}/__mock/reset`);

  expect(response.ok()).toBe(true);
});

test.afterEach(async ({ request }) => {
  const response = await request.get(
    `${mockApiBaseUrl}/__mock/unexpected-requests`,
  );
  const unexpectedRequests = (await response.json()) as string[];

  expect(
    unexpectedRequests,
    `The mock API received unsupported requests:\n${unexpectedRequests.join("\n")}`,
  ).toEqual([]);
});

test("searches for a species and shows its map and seasonality", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("searchbox", { name: "Species or place" })
    .fill("European bison");
  await page.getByRole("button", { name: "Search" }).click();

  const speciesResults = page.getByRole("region", { name: "Species" });
  await expect(speciesResults).toBeVisible();
  await expect(
    speciesResults.getByRole("link", { name: /European bison/i }),
  ).toBeVisible();

  await speciesResults.getByRole("link", { name: /European bison/i }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "European bison" }),
  ).toBeVisible();
  await expect(page.getByText("Bison bonasus", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Interactive map of Poland" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Observation seasonality" }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Observation counts by month" }),
  ).toBeVisible();
  await expect(page.getByLabel("May: 1 observation")).toBeVisible();
});

test("searches for a place and shows its weather and observations", async ({
  page,
}) => {
  await page.goto("/");

  await page
    .getByRole("searchbox", { name: "Species or place" })
    .fill("Białowieża");
  await page.getByRole("button", { name: "Search" }).click();

  const placeResults = page.getByRole("region", { name: "Places" });
  await expect(placeResults).toBeVisible();
  await expect(
    placeResults.getByRole("link", {
      name: /Białowieża National Park, Poland/i,
    }),
  ).toBeVisible();

  await placeResults
    .getByRole("link", { name: /Białowieża National Park, Poland/i })
    .click();

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Białowieża National Park, Poland",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Current weather" }),
  ).toBeVisible();
  await expect(page.getByText("12.5 °C", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", {
      name: "Interactive biodiversity map of Białowieża National Park, Poland",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Protected areas off" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "1 locally synchronized observation across 1 species in the current map view.",
      { exact: true },
    ),
  ).toBeVisible();
});
