import fetch from "node-fetch";
import { load } from "cheerio";
import { prisma } from "~/server/db";

// We can make a request to update the database, we don't want to do this too often though, probably every hour or so
async function databaseUpdate(categories: {heading: string; matches: {homeTeam: string; awayTeam: string; homeTeamScore: string; awayTeamScore: string; time: string; inProgress: boolean; aggScore?: string | null; cancelled?: boolean; group?: string;}[]}[], date: string) {
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

function migratePreviousDataToDatabase() {
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
}


// every 8 minutes
setInterval(migratePreviousDataToDatabase, 1000 * 60 * 8);

export default async function scrapeBbcSports(link: string) {
  const categories = await scrapeBbcWithCompleteLink(link);
  console.log("Scraped BBC Sports for fixtures");

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
}