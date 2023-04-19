import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";

import { z } from "zod";
import { scrapeBbcSports } from "~/helpers/scrapeBbcSports";

// eg
// Parameters
// Argentina vs Curacao
// 2023-03-28


export const footballRouter = createTRPCRouter({
  getCurrentFootballMatches: publicProcedure
    .input(z.object({ currentTab: z.string() }))
    .query(async ({ input }) => {
      // const { currentTab } = input;
      // const start = Date.now();
      // const siteToScrape = `https://www.bbc.com/sport/football/scores-fixtures/${currentTab}`;
      
      // const categories = await scrapeBbcSports(siteToScrape);
      // const newCategories = await appendScorers(categories, currentTab);

      // console.log("Done scraping and adding scorers");
      // const timeTakenInSecs = (Date.now() - start) / 1000;
      // console.log(`Time taken: ${timeTakenInSecs} seconds`);
      // return newCategories;
    }),
});