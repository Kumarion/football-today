import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";

import fetch from "node-fetch";
import { load } from "cheerio";
import { z } from "zod";

async function scrapeBbcSports(link: string) {
  return fetch(link)
    .then((res) => res.text())
    .then((body) => {
      const $ = load(body);
      const categories = [] as {
        heading: string;
        groupStages?: string[];
        matches: {
          homeTeam: string;
          awayTeam: string;
          homeTeamScore: string;
          awayTeamScore: string;
          time: string;
          inProgress: boolean;
          aggScore?: string | null;
          cancelled?: boolean;
        }[];
      }[];

      $(".qa-match-block").each((i, elem) => {
        const thisMatch = [] as {
          homeTeam: string;
          awayTeam: string;
          homeTeamScore: string;
          awayTeamScore: string;
          time: string;
          inProgress: boolean;
          aggScore?: string | null;
          cancelled?: boolean;
        }[];

        // for heading (international friendlies, premier league, more)
        const heading = $(elem).find(".sp-c-match-list-heading").text();
        
        // for group stages
        // do later
        if ($(elem).find(".gs-u-mt")) {
          $(elem).find(".gs-u-mt").each((i, elem2) => {
            const text = $(elem2).text();
            console.log(text);
          });
        }

        // list for matches
        const matchList = $(elem).find(".gs-o-list-ui");
        if (matchList) {
          matchList.each((i, listItem) => {
            const fixture = $(listItem).find(".sp-c-fixture");

            fixture.each((i, fixtureData) => {
              const home = $(fixtureData).find(".sp-c-fixture__wrapper").find("abbr").first().text();
              const away = $(fixtureData).find(".sp-c-fixture__wrapper").find("abbr").last().text();
              const fixtureStatus = $(fixtureData).find(".sp-c-fixture__status").text();
              let time = $(fixtureData).find(".sp-c-fixture__number--time").text();
              let aggScore = "";

              if (time == "") {
                // either FT, HT, Postponed or in progress
                if (fixtureStatus == "FT") {
                  // full time
                  time = "FT";
                }
                if (fixtureStatus == "HT") {
                  // half time
                  time = "HT";
                }
                if (fixtureStatus == "Postponed") {
                  // postponed
                  time = "Postponed";
                }
                // if fixtureStatus includes a number, it's in progress
                if (/\d/.test(fixtureStatus)) {
                  // in progress
                  time = fixtureStatus.replace(" mins", "'");
                }

                if (fixtureStatus.includes("cancelled")) {
                  // if it's not full time, half time, postponed or in progress, it's probably a cancelled match
                  time = fixtureStatus;
                }

                if (fixtureStatus.includes("postponed")) {
                  // if it's not full time, half time, postponed or in progress, it's probably a cancelled match
                  time = fixtureStatus;
                }
              }

              if (fixtureStatus.includes("cancelled")) {
                // if it's not full time, half time, postponed or in progress, it's probably a cancelled match
                time = fixtureStatus;
              }

              if (fixtureStatus.includes("Agg")) {
                // if it's not full time, half time, postponed or in progress, it's probably a cancelled match
                aggScore = fixtureStatus;
              }

              if (time == "TBCTo be Confirmed") {
                time = "TBC (To be Confirmed)";
              }

              let isInProgress = /\d/.test(fixtureStatus) || fixtureStatus == "HT";
              if (fixtureStatus.includes("Agg")) {
                isInProgress = false;
              }

              const match = {
                homeTeam: home,
                awayTeam: away,
                homeTeamScore: $(fixtureData).find(".sp-c-fixture__number--home").text(),
                awayTeamScore: $(fixtureData).find(".sp-c-fixture__number--away").text(),
                time,
                inProgress: isInProgress ? true : false,
                aggScore,
              };

              thisMatch.push(match);
            });
          });
        }

        categories.push({
          heading,
          matches: thisMatch,
        });
      });

      console.log(categories);
      return categories;
    });
}

export const footballRouter = createTRPCRouter({
  getCurrentFootballMatches: publicProcedure
    .input(z.object({ currentTab: z.string() }))
    .query(async ({ input }) => {
      const { currentTab } = input;
      // get all football matches going on in the world
      
      const formattedTab = currentTab == "Today" ? new Date() : currentTab;

      // convert date to simple XXXX-XX-XX format
      const date = new Date(formattedTab);

      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const day = date.getDate();

      let newMonth = month.toString();
      let newDay = day.toString();

      if (month < 10) {
        newMonth = `0${month}`;
      }

      if (day < 10) {
        newDay = `0${day}`;
      }

      const newDate = `${year}-${newMonth}-${newDay}`;
      const siteToScrape = `https://www.bbc.com/sport/football/scores-fixtures/${newDate}`;
      // const siteToScrape = `https://www.bbc.com/sport/football/scores-fixtures/2023-03-23`;

      return await scrapeBbcSports(siteToScrape);
    }),
});