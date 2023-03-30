import fetch from "node-fetch";
import { load } from "cheerio";
import { prisma } from "~/server/db";
import { appendScorers } from "~/server/api/routers/football";

let serverStart = false;

// We can make a request to update the database, we don't want to do this too often though, probably every hour or so
async function databaseUpdate(categories: {heading: string; matches: {homeTeam: string; awayTeam: string; homeTeamScore: string; awayTeamScore: string; time: string; inProgress: boolean; aggScore?: string | null; cancelled?: boolean; group?: string; finalWinMessage?: string | null}[]}[], date: string) {
  // create a new category in the db with the heading and the matches
  // create a json that we can set 
  await prisma.footballMatchDay.upsert({
    where: {
      date: date,
    },
    // update it with the new fixture data
    update: {
      fixtureData: JSON.stringify(categories),
    },
    // create it if it doesn't exist with the stringified fixture data
    create: {
      date: date,
      fixtureData: JSON.stringify(categories),
    },
  });
}

async function scrapeBbcWithCompleteLink(link: string) {
  return fetch(link)
    .then((res) => res.text())
    .then((body) => {
      const $ = load(body);
      const categories = [] as {
        heading: string;
        matches: {
          homeTeam: string;
          awayTeam: string;
          homeTeamScore: string;
          awayTeamScore: string;
          time: string;
          inProgress: boolean;
          aggScore?: string | null;
          cancelled?: boolean;
          group?: string;
          finalWinMessage?: string | null;
          homeScorers?: string[];
          awayScorers?: string[];
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
          group?: string;
          finalWinMessage?: string | null;
        }[];

        // for heading (international friendlies, premier league, more)
        const heading = $(elem).find(".sp-c-match-list-heading").text();
        
        // list for matches
        const matchList = $(elem).find(".gs-o-list-ui");

        if (matchList) {
          matchList.each((i, listItem) => {
            const fixture = $(listItem).find(".sp-c-fixture");

            fixture.each((i, fixtureData) => {
              const home = $(fixtureData).find(".sp-c-fixture__wrapper").find("abbr").first().text();
              const away = $(fixtureData).find(".sp-c-fixture__wrapper").find("abbr").last().text();
              const winMessage = $(fixtureData).find(".sp-c-fixture__win-message").text();

              const fixtureStatus = $(fixtureData).find(".sp-c-fixture__status").text();
              let time = $(fixtureData).find(".sp-c-fixture__number--time").text();
              let aggScore = "";

              if (time == "") {
                // either FT, HT, Postponed or in progress
                if (fixtureStatus == "FT") time = "FT";
                if (fixtureStatus == "HT") time = "HT";
                if (fixtureStatus == "Postponed") time = "Postponed";
                if (/\d/.test(fixtureStatus)) time = fixtureStatus.replace(" mins", "'"); fixtureStatus.replace(" min", "'"); fixtureStatus.replace("min", "'"); fixtureStatus.replace("mins", "'");
                if (fixtureStatus.includes("cancelled")) time = fixtureStatus;
                if (fixtureStatus.includes("postponed")) time = fixtureStatus;
              }

              if (fixtureStatus.includes("cancelled")) time = fixtureStatus;
              if (fixtureStatus.includes("Agg")) aggScore = fixtureStatus;
              if (time == "TBCTo be Confirmed") time = "TBC (To be Confirmed)";
              let isInProgress = /\d/.test(fixtureStatus) || fixtureStatus == "HT";
              if (fixtureStatus.includes("Agg")) isInProgress = false;

              let group = "";
              if (matchList.parent().find(".gs-u-mt")) {
                matchList.parent().find(".gs-u-mt").each((i, eee) => {
                  const groupHeader = $(eee).text();
                  
                  // need to get the group that the match is in (if it's a group stage) 
                  // iterate through each group
                  $(eee).next().find(".sp-c-fixture").each((i, elem3) => {
                    const homeTeam = $(elem3).find(".sp-c-fixture__wrapper").find("abbr").first().text();
                    const awayTeam = $(elem3).find(".sp-c-fixture__wrapper").find("abbr").last().text();
                    if (homeTeam == home && awayTeam == away) {
                      group = groupHeader;
                    }
                  });
                });
              }

              thisMatch.push({
                homeTeam: home,
                awayTeam: away,
                homeTeamScore: $(fixtureData).find(".sp-c-fixture__number--home").text(),
                awayTeamScore: $(fixtureData).find(".sp-c-fixture__number--away").text(),
                time,
                inProgress: isInProgress ? true : false,
                aggScore,
                group,
                finalWinMessage: winMessage == "" ? null : winMessage,
              });
            });
          });
        }

        categories.push({
          heading,
          matches: thisMatch,
        });
      });

      return categories;
    });
}

// every 8 minutes
async function startPreviousDaysInterval() {
  // do the data for today
  const todaysDate = new Date().toISOString().split("T")[0] as string;
  const categories = await scrapeBbcWithCompleteLink(`https://www.bbc.co.uk/sport/football/scores-fixtures/${todaysDate}`);
  const newDataWithScorers = await appendScorers(categories, todaysDate);
  const toJson = JSON.stringify(newDataWithScorers);
  console.log(todaysDate, "todays date");
  console.log(toJson);

  await prisma.todaysMatches.upsert({
    where: {
      date: todaysDate,
    },
    update: {
      fixtureData: toJson,
    },
    create: {
      date: todaysDate,
      fixtureData: toJson,
    },
  });

  setInterval(() => {
    console.log("Upserting database with previous data...");
  
    // date in format YYYY-MM-DD
    const maxDays = 14;
    
    // get previous like 2 days to keep in our big database (make sure to include today)
    const previousDates = Array.from({ length: maxDays }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split("T")[0] as string;
    });
  
    const dates = [...previousDates];
  
    dates.forEach((date) => {
      scrapeBbcWithCompleteLink(
        `https://www.bbc.co.uk/sport/football/scores-fixtures/${date}`
      ).then((categories) => {
        // update the pool
        const update = databaseUpdate(categories, date);
        update.then(() => console.log("Database updated for date " + date)).catch(console.error);
      }).catch(console.error);
    });
  }, 1000 * 60 * 8);
}

const scrapeBbcSports = async (link: string) => {
  const categories = await scrapeBbcWithCompleteLink(link);
  console.log("Scraped BBC Sports for match fixtures");

  // update todays data in prisma if it's not already there, and if its the first time we're scraping
  if (!serverStart) {
    // we want to start the interval after we've updated the database for today
    // this is an interval for upserting data for previous days
    serverStart = true;
    startPreviousDaysInterval().then(() => console.log("Started interval for previous days")).catch(console.error);
  }

  return categories;
};

export { scrapeBbcSports };