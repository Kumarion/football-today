import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";

import { z } from "zod";
import scrapeBbcSports from "~/ServerFunctions/scrapeBbcSports";
import formatBbcDate from "~/ServerFunctions/formatBbcDate";

export const footballRouter = createTRPCRouter({
  getCurrentFootballMatches: publicProcedure
    .input(z.object({ currentTab: z.string() }))
    .query(async ({ input }) => {
      const { currentTab } = input;
      // get all football matches going on in the world
      const siteToScrape = formatBbcDate(currentTab);
      return await scrapeBbcSports(siteToScrape);
    }),
});