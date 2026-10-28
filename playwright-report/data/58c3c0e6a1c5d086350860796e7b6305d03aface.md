# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fleet-placement.spec.ts >> Heartfleet multiplayer fleet placement >> two captains can create, join, place, and confirm fleets
- Location: tests\e2e\fleet-placement.spec.ts:245:9

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  locator('main')
Expected: "true"
Received: "false"
Timeout:  15000ms

Call log:
  - Expect "toHaveAttribute" locator('main') with timeout 15000ms
  - waiting for locator('main')
    33 × locator resolved to <main data-hydrated="false" class="relative mx-auto flex w-full max-w-[1440px] flex-1 items-center justify-center px-5 py-12 text-[#51475d] sm:px-8 lg:px-12">…</main>
       - unexpected value "false"

```

```yaml
- main:
  - complementary
  - text: ♡
  - paragraph: Your voyage begins here
  - heading "Ready to set sail?" [level=1]
  - paragraph: Just two captains, two fleets, and a little chemistry.
  - group "Choose room action"
  - paragraph: Your captain identity
  - text: H
  - paragraph: hf_test_a
  - paragraph: Ready to command your fleet ♡
  - text: Create a private room and invite someone special. You'll be able to share a link or room code once multiplayer is connected.
  - button "Create our room →"
```

# Test source

```ts
  1   | 
  2   | import {
  3   |     test,
  4   |     expect,
  5   |     type Browser,
  6   |     type BrowserContext,
  7   |     type Page,
  8   | } from "@playwright/test";
  9   | 
  10  | type Captain = {
  11  |     context: BrowserContext;
  12  |     page: Page;
  13  |     username: string;
  14  | };
  15  | 
  16  | type RoomResponse = {
  17  |     room: {
  18  |         id: string;
  19  |         code: string;
  20  |         status: string;
  21  |         host: string;
  22  |         guest: string | null;
  23  |     };
  24  | };
  25  | 
  26  | type FleetResponse = {
  27  |     status: string;
  28  |     ownReady: boolean;
  29  |     opponentReady: boolean;
  30  |     ownShips: unknown[] | null;
  31  | };
  32  | 
  33  | const password = "HeartfleetTest2026!";
  34  | 
  35  | async function createCaptain(
  36  |     browser: Browser,
  37  |     username: string
  38  | ): Promise<Captain> {
  39  |     const context = await browser.newContext();
  40  |     const page = await context.newPage();
  41  | 
  42  |     const response = await context.request.post(
  43  |         "/api/auth/login",
  44  |         {
  45  |             data: {
  46  |                 username,
  47  |                 password,
  48  |             },
  49  |         }
  50  |     );
  51  | 
  52  |     expect(
  53  |         response.ok(),
  54  |         `Login failed: ${await response.text()}`
  55  |     ).toBeTruthy();
  56  | 
  57  |     await page.goto("/lobby");
  58  | 
  59  |     // Wait for React to hydrate before interacting.
> 60  |     await expect(page.locator("main")).toHaveAttribute(
      |                                        ^ Error: expect(locator).toHaveAttribute(expected) failed
  61  |         "data-hydrated",
  62  |         "true"
  63  |     );
  64  | 
  65  |     await expect(
  66  |         page.getByRole("main").getByText(username, {
  67  |             exact: true,
  68  |         })
  69  |     ).toBeVisible();
  70  | 
  71  |     const joinButton = page.getByRole("button", {
  72  |         name: /Join room/,
  73  |     });
  74  | 
  75  |     await joinButton.click();
  76  |     await expect(joinButton).toHaveAttribute("aria-pressed", "true");
  77  | 
  78  |     const createButton = page.getByRole("button", {
  79  |         name: /Create room/,
  80  |     });
  81  | 
  82  |     await createButton.click();
  83  |     await expect(createButton).toHaveAttribute("aria-pressed", "true");
  84  | 
  85  |     return { context, page, username };
  86  | }
  87  | 
  88  | async function createRoom(captain: Captain) {
  89  |     const page = captain.page;
  90  | 
  91  |     const responses: string[] = [];
  92  | 
  93  |     const onResponse = (response: import("@playwright/test").Response) => {
  94  |         if (response.url().includes("/api/rooms")) {
  95  |             responses.push(
  96  |                 `${response.request().method()} ${response.status()} ${response.url()}`
  97  |             );
  98  |         }
  99  |     };
  100 | 
  101 |     page.on("response", onResponse);
  102 | 
  103 |     try {
  104 |         await page
  105 |             .getByRole("button", { name: /Create our room/ })
  106 |             .click();
  107 | 
  108 |         await expect(async () => {
  109 |             const currentUrl = page.url();
  110 | 
  111 |             const errorMessage = await page
  112 |                 .getByRole("status")
  113 |                 .allTextContents();
  114 | 
  115 |             expect(
  116 |                 currentUrl,
  117 |                 `Still on ${currentUrl}\n` +
  118 |                 `API responses:\n${responses.join("\n") || "None"}\n` +
  119 |                 `Status messages:\n${errorMessage.join("\n") || "None"}`
  120 |             ).toMatch(/\/room\/[0-9a-f-]{36}$/);
  121 |         }).toPass({ timeout: 15000 });
  122 | 
  123 |         const roomId = page.url().split("/").pop()!;
  124 | 
  125 |         const response = await captain.context.request.get(
  126 |             `/api/rooms/${roomId}`
  127 |         );
  128 | 
  129 |         expect(
  130 |             response.ok(),
  131 |             `Room retrieval failed: ${await response.text()}`
  132 |         ).toBeTruthy();
  133 | 
  134 |         const data = (await response.json()) as RoomResponse;
  135 | 
  136 |         return {
  137 |             id: roomId,
  138 |             code: data.room.code,
  139 |         };
  140 |     } finally {
  141 |         page.off("response", onResponse);
  142 |     }
  143 | }
  144 | 
  145 | async function joinRoom(
  146 |     captain: Captain,
  147 |     code: string
  148 | ) {
  149 |     await captain.page.goto(
  150 |         `/lobby?code=${encodeURIComponent(code)}`
  151 |     );
  152 | 
  153 |     await expect(
  154 |         captain.page.getByRole("button", {
  155 |             name: /Join the voyage/,
  156 |         })
  157 |     ).toBeVisible();
  158 | 
  159 |     await expect(
  160 |         captain.page.getByRole("textbox", {
```