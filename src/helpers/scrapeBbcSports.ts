import { load } from "cheerio";
import axios from "axios";

export interface PlayerAction {
  addedTime: number;
  displayTime: string;
  ownGoal: boolean;
  penalty: boolean;
  timeElapsed: number;
  type: string;
}
interface PlayerName {
  abbreviation: string;
  first: string;
  full: string;
  last: string;
}
interface Team {
  name: {
    abbreviation: string;
    first: string;
    full: string;
    last: string;
  };
  playerActions: {
    actions: PlayerAction[];
    name: PlayerName;
  }[];
}
interface Event {
  homeTeam: Team;
  awayTeam: Team;
}
interface Tournament {
  [key: string]: {
    events: Event[];
  };
}
interface MatchData {
  tournamentDatesWithEvents: Tournament;
}
interface Body {
  matchData: MatchData[];
}
interface Payload {
  body: Body;
}
interface TypedData {
  payload: Payload[];
}
export interface Category {
  heading: string;
  matches: {
    homeTeam: string;
    awayTeam: string;
    homeTeamScore: string;
    awayTeamScore: string;
    currentTime: string;
    dateStarting: string;
    inProgress: boolean;
    aggScore?: string | null;
    cancelled?: boolean;
    group?: string;
    finalWinMessage?: string | null;
    fullTime: boolean;
    status: string;
    homeScorers?: [string, string[]][];
    awayScorers?: [string, string[]][];
  }[];
}

function axiosWithCors(url: string) {
  return axios.get(url, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
    },
  });
}

export const getScorersForMatch = (matchName: string, mainDate: string) => {
  const startDate = mainDate;
  const endDate = mainDate;
  const todayDate = mainDate;
  const tournament = "full-priority-order";
  const version = "2.4.6";
  const withPlayerActions = "true";

  const startUrl = "https://push.api.bbci.co.uk";
  let url = `${startUrl}/batch?t=/data/bbc-morph-football-scores-match-list-data/endDate/${endDate}/startDate/${startDate}/todayDate/${todayDate}/tournament/${tournament}/version/${version}/withPlayerActions/${withPlayerActions}?timeout=5`;
  url = encodeURI(url);

  return fetch(url)
    .then((res) => res.json())
    .then((data) => {
      const newTypedData = data as TypedData;

      const payload = newTypedData.payload[0];

      if (!payload) {
        return;
      }

      const body = payload.body;
      const matchData = body.matchData;

      let eventsGot: Event[] = [];

      matchData.forEach((tournament) => {
        const t = tournament.tournamentDatesWithEvents;

        if (!t) {
          return;
        }

        const flatValues = Object.values(t).flat();

        flatValues.forEach((value) => {
          const events = value.events || [];
          events.forEach((event) => {
            eventsGot.push(event);
          });
        });
      });

      eventsGot = eventsGot.flat();

      const awayScorers = new Map<string, string[]>([]);
      const homeScorers = new Map<string, string[]>([]);

      eventsGot.map((event) => {
        const str = `${event.homeTeam.name.abbreviation} v. ${event.awayTeam.name.abbreviation}`;

        if (str === matchName) {
          event.homeTeam.playerActions?.forEach((playerAction) => {
            playerAction.actions.forEach((action) => {
              if (action.type === "goal") {
                const playerName = playerAction.name.full;
                const displayTime = action.displayTime;
                homeScorers.set(playerName, [...homeScorers.get(playerName) || [], displayTime]);
              }
            });
          });

          event.awayTeam.playerActions?.forEach((playerAction) => {
            playerAction.actions.forEach((action) => {
              if (action.type === "goal") {
                const playerName = playerAction.name.full;
                const displayTime = action.displayTime;
                awayScorers.set(playerName, [...awayScorers.get(playerName) || [], displayTime]);
              }
            });
          });
        }
      });

      return {
        scorersHome: homeScorers,
        scorersAway: awayScorers,
      };
    });
};

export const appendScorers = async (categories: Category[], currentTab: string) => {
  const newCategories = categories.map(async (category) => {
    const newMatches = category.matches.map(async (match) => {
      const name = match.homeTeam + " v. " + match.awayTeam;
      const scorers = await getScorersForMatch(name, currentTab);
      const homeScorers = scorers?.scorersHome;
      const awayScorers = scorers?.scorersAway;
      const array = Array.from(homeScorers || []);
      const array2 = Array.from(awayScorers || []);
      
      return {
        ...match,
        homeScorers: array,
        awayScorers: array2,
      };
    });

    const n = await Promise.all(newMatches);

    return {
      ...category,
      matches: n,
    };
  });

  return Promise.all(newCategories);
};

async function scrapeBbcWithCompleteLink(link: string) {
  return axiosWithCors(link)
    .then((res) => res.data as string)
    .then((body) => {
      console.log(body);
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

const scrapeBbcSports = async (link: string) => {
  const categories = await scrapeBbcWithCompleteLink(link);
  console.log("Scraped BBC Sports for match fixtures");

  // update todays data in prisma if it's not already there, and if its the first time we're scraping
  // if (!serverStart) {
  //   // we want to start the interval after we've updated the database for today
  //   // this is an interval for upserting data for previous days
  //   serverStart = true;
  //   startPreviousDaysInterval().then(() => console.log("Started interval for previous days")).catch(console.error);
  // }

  return categories;
};

export { scrapeBbcSports };