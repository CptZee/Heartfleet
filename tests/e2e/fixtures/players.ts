import {
    test as base,
    expect,
    type BrowserContext,
    type Page,
} from "@playwright/test";

type PlayerFixtures = {
    playerA: Page;
    playerB: Page;
};

export const test = base.extend<PlayerFixtures>({
    playerA: async ({ browser }, use) => {
        const context = await browser.newContext({
            storageState: "playwright/.auth/playerA.json",
        });

        const page = await context.newPage();

        try {
            await use(page);
        } finally {
            await context.close();
        }
    },

    playerB: async ({ browser }, use) => {
        const context = await browser.newContext({
            storageState: "playwright/.auth/playerB.json",
        });

        const page = await context.newPage();

        try {
            await use(page);
        } finally {
            await context.close();
        }
    },
});

export { expect };