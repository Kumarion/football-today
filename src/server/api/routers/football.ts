import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";

import { z } from "zod";
import { scrapeBbcSports } from "~/ServerFunctions/scrapeBbcSports";

export const footballRouter = createTRPCRouter({
  getCurrentFootballMatches: publicProcedure
    .input(z.object({ currentTab: z.string() }))
    .query(async ({ input }) => {
      const { currentTab } = input;
      const siteToScrape = `https://www.bbc.com/sport/football/scores-fixtures/${currentTab}`;
      return await scrapeBbcSports(siteToScrape);
    }),
});