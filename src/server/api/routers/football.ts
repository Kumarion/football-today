import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";

import { z } from "zod";
import { scrapeBbcSports } from "~/ServerFunctions/scrapeBbcSports";

interface PlayerAction {
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
interface Category {
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
}

// eg
// Parameters
// Argentina vs Curacao
// 2023-03-28
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

export const footballRouter = createTRPCRouter({
  getCurrentFootballMatches: publicProcedure
    .input(z.object({ currentTab: z.string() }))
    .query(async ({ input }) => {
      const { currentTab } = input;
      const start = Date.now();
      const siteToScrape = `https://www.bbc.com/sport/football/scores-fixtures/${currentTab}`;
      
      const categories = await scrapeBbcSports(siteToScrape);
      const newCategories = await appendScorers(categories, currentTab);

      console.log("Done scraping and adding scorers");
      const timeTakenInSecs = (Date.now() - start) / 1000;
      console.log(`Time taken: ${timeTakenInSecs} seconds`);
      return newCategories;
    }),
});