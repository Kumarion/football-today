import fetch from "node-fetch";
import { load } from "cheerio";

export default async function scrapeBbcSports(link: string) {
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
                if (/\d/.test(fixtureStatus)) time = fixtureStatus.replace(" mins", "'") || fixtureStatus.replace(" min", "'");
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