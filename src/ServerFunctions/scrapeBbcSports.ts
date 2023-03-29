import fetch from "node-fetch";
import { load } from "cheerio";
import { prisma } from "~/server/db";
import { categoriesToComeFirst } from "~/helpers/footballCategoriesAlgorithm";
import type { RouterOutputs } from "~/utils/api";

type poolType = {
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
  }[];
};
type FootballMatch = RouterOutputs["football"]["getCurrentFootballMatches"][0]["matches"][0] & {
  homeTeamLogo?: string;
  awayTeamLogo?: string;
};
type FootballCategory = RouterOutputs["football"]["getCurrentFootballMatches"][0];

// let serverStart = false;

function sortCategories(a: FootballCategory, b: FootballCategory) {
  const aIndex = categoriesToComeFirst.indexOf(a.heading);
  const bIndex = categoriesToComeFirst.indexOf(b.heading);

  if (aIndex == -1 && bIndex == -1) {
    return a.heading.localeCompare(b.heading);
  }

  if (aIndex == -1) {
    return 1;
  }

  if (bIndex == -1) {
    return -1;
  }

  return aIndex - bIndex;
}

function sortByInProgress(a: FootballMatch, b: FootballMatch) {
  // Needs to be sorted like so
  // 1. In progress
  // 2. Finished
  // 3. Not started

  const aInProgress = a.inProgress;
  const bInProgress = b.inProgress;
  const aFinished = a.homeTeamScore != "" && a.awayTeamScore != "";
  const bFinished = b.homeTeamScore != "" && b.awayTeamScore != "";
  const aNotStarted = a.homeTeamScore == "" && a.awayTeamScore == "";
  const bNotStarted = b.homeTeamScore == "" && b.awayTeamScore == "";

  return (
    (aInProgress ? 0 : 1) - (bInProgress ? 0 : 1) ||
    (aFinished ? 0 : 1) - (bFinished ? 0 : 1) ||
    (aNotStarted ? 0 : 1) - (bNotStarted ? 0 : 1)
  );

  return 0;
}

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

function scrapeBbcWithCompleteLink(link: string) {
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
                if (/\d/.test(fixtureStatus)) time = fixtureStatus.replace(" mins", "'"); fixtureStatus.replace(" min", "'");
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

// every 3 minutes to update the pool for today
function startPoolInterval() {
  const todaysDate = new Date().toISOString().split("T")[0] as string;

  setInterval(() => {
    console.log("Updating the pool for today...");

    scrapeBbcWithCompleteLink(
      `https://www.bbc.co.uk/sport/football/scores-fixtures/${todaysDate}`
    ).then((categories) => {
      // const matchesForToday = categories[0]?.matches || [];

      // clear the pool
      // upsert the database with the new fixture data (or update it if it already exists)
      const toJson = JSON.stringify(categories);
      prisma.todaysMatches.upsert({
        where: {
          date: todaysDate,
        },
        update: {
          date: todaysDate,
          fixtureData: toJson,
        },
        create: {
          date: todaysDate,
          fixtureData: toJson,
        },
      }).then(() => {
        console.log("Updated the pool for today");
      }).catch(console.error);

      // update the pool
      // categories.map((category) => {
      //   pool.push({
      //     heading: category.heading,
      //     matches: category.matches,
      //   });
      // });



      // logging
      // console.log(pool);
      // pool.map((category) => {
      //   console.log(category.heading);
      //   category.matches.map((match) => {
      //     console.log(match);
      //   });
      // });
    }).catch(console.error);
  }, 180000);
}

startPoolInterval();

// every 8 minutes
function startInterval() {
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

startInterval();

const getPoolForToday = async () => {
  // get the pool for today in the database
  const dataForToday = await prisma.todaysMatches.findUnique({
    where: {
      date: new Date().toISOString().split("T")[0] as string,
    },
  });

  // no data for today
  if (!dataForToday) {
    console.log("No data for today");
    return [];
  }

  const parsedData = JSON.parse(dataForToday.fixtureData as string) as FootballCategory[];
  const sortedCategories = parsedData.sort(sortCategories);

  // // work with each category
  const newSortedData = sortedCategories.map((category) => {
    // sort the matches
    const sortedMatches = category.matches.sort(sortByInProgress);
    
    return {
      ...category,
      matches: sortedMatches,
    };
  });
  
  return newSortedData;
};

const scrapeBbcSports = async (link: string) => {
  const categories = await scrapeBbcWithCompleteLink(link);
  console.log("Scraped BBC Sports for fixtures");

  // if (!serverStart) {
  //   // start our intervals if it's the first time we're scraping
  //   startPoolInterval();
  //   startInterval();
  //   serverStart = true;
  // }

  // update todays data in prisma if it's not already there
  const todaysDate = new Date().toISOString().split("T")[0] as string;
  const todaysData = await prisma.todaysMatches.findUnique({
    where: {
      date: todaysDate,
    },
  });

  if (!todaysData) {
    const toJson = JSON.stringify(categories);
    prisma.todaysMatches.upsert({
      where: {
        date: todaysDate,
      },
      update: {
        date: todaysDate,
        fixtureData: toJson,
      },
      create: {
        date: todaysDate,
        fixtureData: toJson,
      },
    }).then(() => {
      console.log("Updated the pool for today");
    }).catch(console.error);
  }

  // get test data for date 2023-03-22
  // const test = await prisma.footballMatchDay.findUnique({
  //   where: {
  //     date: "2023-03-22",
  //   },
  // });

  // if (test && test.fixtureData) {
  //   const testCategories = JSON.parse(test.fixtureData as string) as {
  //     heading: string;
  //     matches: {
  //       homeTeam: string;
  //       awayTeam: string;
  //       homeTeamScore: string;
  //       awayTeamScore: string;
  //       time: string;
  //       inProgress: boolean;
  //       aggScore?: string | null;
  //       cancelled?: boolean;
  //       group?: string;
  //     }[];
  //   }[];
  //   console.log(testCategories);
  // }

  return categories;
};

export { scrapeBbcSports, getPoolForToday };