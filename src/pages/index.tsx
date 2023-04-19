import Head from "next/head";
import { useEffect, useState } from "react";
import { format } from "date-fns";

import FootballMatchComp from "~/components/footballMatch";
import { motion } from "framer-motion";

import DateTab from "~/components/dateTab";
import { categoriesToComeFirst } from "~/helpers/footballCategoriesAlgorithm";
import axios from "axios";

import type { Category } from "~/helpers/scrapeBbcSports";
type FootballMatch = Category["matches"][0] & {
  homeTeamLogo?: string;
  awayTeamLogo?: string;
};
type FootballLogoSearchResponse = {
  teams: {
    images: {
      url: string;
    }[];
  }[];
};
interface FootballRoundData {
  key: string,
  name: {
    first: string,
    full: string,
    abbreviation: string,
  }
}
interface FootballProps {
  todaysData: Category[];
}
interface FootballEventData {
  eventKey: string;
  startTime: string;
  isTBC: boolean;
  minutesElapsed: number;
  minutesIntoAddedTime: number | null;
  eventStatus: string;
  eventStatusNote: string;
  eventStatusReason: string | null;
  eventOutcomeType: string | null;
  eventType: string;
  seriesWinner: string | null;
  cpsId: string;
  cpsLive: string;
  homeTeam: {
    key: string;
    scores: {
      score: number;
      halfTime: number;
      fullTime: number;
      extraTime: number | null;
      shootout: number | null;
      aggregate: number;
      aggregateGoalsAway: number;
    };
    formation: null;
    eventOutcome: string;
    name: {
      first: string;
      full: string;
      abbreviation: string;
      last: string | null;
    };
    playerActions: {
      actions: {
        type: string;
        timeElapsed: number;
        addedTime: number;
        penalty: boolean;
        ownGoal: boolean;
        displayTime: string;
      }[];
      name: {
        first: string;
        full: string;
        abbreviation: string;
        last: string;
      };
    }[];
  };
  awayTeam: {
    key: string;
    scores: {
      score: number;
      halfTime: number;
      fullTime: number;
      extraTime: number | null;
      shootout: number | null;
      aggregate: number;
      aggregateGoalsAway: number;
    };
    formation: null;
    eventOutcome: string;
    name: {
      first: string;
      full: string;
      abbreviation: string;
      last: string | null;
    };
    playerActions: {
      actions: {
        type: string;
        timeElapsed: number;
        addedTime: number;
        penalty: boolean;
        ownGoal: boolean;
        displayTime: string;
      }[];
      name: {
        first: string;
        full: string;
        abbreviation: string;
        last: string;
      };
    }[];
  };
  eventProgress: {
    period: string;
    status: string;
  };
  venue: {
    name: {
      abbreviation: string;
      videCode: string;
      first: string;
      full: string;
    };
    homeCountry: string;
  };
  officials: string[];
  tournamentInfo: null;
  eventActions: null;
  startTimeInUKHHMM: string;
  comment: string | null;
  href: string;
  tournamentName: {
    first: string;
    full: string;
    abbreviation: string;
  };
  tournamentSlug: string;
}
interface FootballResult {
  meta: {
    pollFrequencyInMilliseconds: number
  }
  payload: {
    meta: string[],
    body: {
      fixtureListMeta: {
        scorersButtonShouldBeEnabled: boolean
      },
      matchData: {
        tournamentMeta: {
          tournamentSlug: string,
          tournamentName: {
            first: string,
            full: string,
            abbreviation: string,
          }
        }
        tournamentDatesWithEvents: {
          [key: string]: {
            round: FootballRoundData[],
            events: FootballEventData[],
          }[]
        }
      }[],
    }
  }[]
}

export const GET_LINK = (date: string) => {
  return `https://push.api.bbci.co.uk/batch?t=/data/bbc-morph-football-scores-match-list-data/endDate/${date}/startDate/${date}/todayDate/${date}/tournament/full-priority-order/version/2.4.6/withPlayerActions/true?timeout=5`;
};

// categories that come first
// if not in this list, they will be sorted alphabetically
// an algorithm will sort the categories by what is most popular, as listed here

function sortCategories(a: Category, b: Category) {
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
function formulateTabs() {
  // create tabs including TODAYs date and up to 7 days
  const tabs = [];
  const maxDays = 5;

  for (let i = 0; i < maxDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);

    if (i == 0) {
      tabs.push("Today");
      continue;
    }

    tabs.push(date.toDateString());
  }

  // add tabs before today
  for (let i = 1; i < maxDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
      
    tabs.unshift(date.toDateString());
  }

  return tabs;
}
async function searchLogo(teamName: string): Promise<string> {
  // check cache
  const cached = localStorage.getItem(teamName);
  if (cached) {
    return cached;
  }

  const footballLogoSearch = await fetch("https://search-api.onefootball.com/v2/en/search?q=" + encodeURIComponent(teamName));
  const data = await footballLogoSearch.json() as FootballLogoSearchResponse;
  const teams = data?.teams || [] as FootballLogoSearchResponse['teams'];
  const first = teams[0] || {} as typeof teams[number];
  const images = first?.images || [] as typeof first['images'];
  const firstImage = images[0] || {} as typeof images[number];

  if (!firstImage || firstImage.url == "" || firstImage.url === undefined) {
    return "/emptyfc.png";
  }

  // set in cache
  localStorage.setItem(teamName, firstImage.url);

  return firstImage.url;
}
function processAndApplyData(data: Category[]) {
  const sortedCategories = data.sort(sortCategories);

  // work with each category
  const newSortedData = sortedCategories.map((category) => {
    // sort the matches
    const sortedMatches = category.matches.sort(sortByInProgress);
    
    return {
      ...category,
      matches: sortedMatches,
    };
  });
  const appendImagesToFinalSortedData = newSortedData.map(async (category) => {
    const newMatches = await Promise.all(category.matches.map(async (match: FootballMatch) => {
      const homeTeamLogo = await searchLogo(match.homeTeam);
      const awayTeamLogo = await searchLogo(match.awayTeam);

      return {
        ...match,
        homeTeamLogo,
        awayTeamLogo,
      };
    }));

    return {
      ...category,
      matches: newMatches,
    };
  });
  
  return Promise.all(appendImagesToFinalSortedData);
}

function formulateTime(currentTab: string) {
  let date: Date;

  if (currentTab === "Today") {
    date = new Date();
  } else {
    date = new Date(currentTab);
  }

  // convert date to simple XXXX-XX-XX format

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
  return newDate;
}

async function getApiData(currentTab: string) {
  const date = formulateTime(currentTab);
  const link = GET_LINK(date);
  const fetched = await axios.get(link);
  const data = fetched.data as FootballResult;
  const returningData = [] as Category[];
  const matchData = data.payload[0]?.body.matchData || [] as FootballResult['payload'][number]['body']['matchData'];

  matchData.map((match) => {
    // Pickup the tournment name
    const tournamentName = match.tournamentMeta.tournamentName.full;
    const value = Object.values(match.tournamentDatesWithEvents)[0];
    if (!value) {
      return;
    }
    const tournamentData = value[0];
    const events = tournamentData?.events;
    // Go through the events
    if (!events) return;

    events.map((event) => {
      const fullHomeTeamName = event.homeTeam.name.full;
      const fullAwayTeamName = event.awayTeam.name.full;
      
      const fullTimeHomeScore = event.homeTeam.scores.fullTime ? event.homeTeam.scores.fullTime.toString() : "0";
      const fullTimeAwayScore = event.awayTeam.scores.fullTime ? event.awayTeam.scores.fullTime.toString() : "0";
      const aggScoreHome =  event.homeTeam.scores.aggregate ? event.homeTeam.scores.aggregate.toString() : null;
      const aggScoreAway = event.awayTeam.scores.aggregate ? event.awayTeam.scores.aggregate.toString() : null;

      const currentTime = event.minutesElapsed ? event.minutesElapsed.toString() : "0";
      const dateStarting = event.startTime;
      const inProgress = event.eventStatus == "mid-event";
      const cancelled = event.eventStatus == "canceled";
      const fullTime = event.eventStatus == "post-event";
      const status = event.eventStatus;

      const homeScorers = new Map<string, string[]>([]);
      const awayScorers = new Map<string, string[]>([]);

      event.homeTeam.playerActions && event.homeTeam.playerActions.length > 0 && event.homeTeam.playerActions.map((playerAction) => {
        if (playerAction.actions[0]?.type == "goal") {
          const fullName = playerAction.name.full;
          const timeScored = playerAction.actions[0].displayTime;
          homeScorers.set(fullName, [timeScored]);
        }
      });
      event.awayTeam.playerActions && event.awayTeam.playerActions.length > 0 && event.awayTeam.playerActions.map((playerAction) => {
        if (playerAction.actions[0]?.type == "goal") {
          const fullName = playerAction.name.full;
          const timeScored = playerAction.actions[0].displayTime;
          awayScorers.set(fullName, [timeScored]);
        }
      });

      // push to final
      returningData.push({
        heading: tournamentName,
        matches: [{
          homeTeam: fullHomeTeamName,
          awayTeam: fullAwayTeamName,
          homeTeamScore: fullTimeHomeScore,
          awayTeamScore: fullTimeAwayScore,
          aggScore: aggScoreHome && aggScoreAway ? `Agg: ${aggScoreHome} - ${aggScoreAway}` : null,
          currentTime,
          dateStarting,
          inProgress,
          cancelled,
          fullTime,
          status,
          homeScorers: Array.from(homeScorers || []),
          awayScorers: Array.from(awayScorers || []),
        }],
      });
    });
  });

  // make sure there are not duplicate tournament names, and matches with the same tournament name are in the same category
  const newReturningData = [] as Category[];
  returningData.map((category) => {
    const index = newReturningData.findIndex((newCategory) => newCategory.heading === category.heading);
    if (index === -1) {
      newReturningData.push(category);
    } else {
      newReturningData[index]?.matches.push(...category.matches);
    }
  });

  const processData = processAndApplyData(newReturningData);
  return processData;
}

export default function Football({ }: FootballProps) {
  const [currentTab, setCurrentTab] = useState("Today");
  // const countForToday = todaysData.reduce((acc, category) => acc + category.matches.length, 0);

  // set football categories for the current tab
  const [footballCategoryData, setFootballCategoryData] = useState<Category[]>([]);
  const countForToday = footballCategoryData.reduce((acc, category) => acc + category.matches.length, 0);

  async function test() {
    // const siteToScrape = `https://www.bbc.com/sport/football/scores-fixtures/${currentTab}`;
    // const categories = await scrapeBbcSports(siteToScrape) as Category[];
    // console.log(categories);
    // const newCategories = await appendScorers(categories, currentTab) as unknown as Category[];
    // console.log(newCategories);
    // const processedData = await processAndApplyData(newCategories);
    const test = await getApiData(currentTab);
    console.log(test);
    setFootballCategoryData(test);

    // console.log(processedData);
    // setFootballCategoryData(processedData);
  }

  const isLoading = footballCategoryData.length === 0;

  // const { isLoading, refetch } = api.football.getCurrentFootballMatches.useQuery({ currentTab: formulateTime(currentTab) }, {
  //   // refetch every 10 seconds
  //   // not sure how efficient this is, but it's a start
  //   enabled: true,
  //   refetchInterval: 5000,
  //   refetchOnWindowFocus: true,
  //   onSuccess: (data) => {
  //     console.log("success");
  //     void processAndApplyData(data).then((processedData) => {
  //       setFootballCategoryData(processedData);
  //     });
  //     console.log(data);
  //   }
  // });

  useEffect(() => {
    void test();
  }, [currentTab]);

  const setTab = (tab: string) => {
    // void refetch();
    // void test();
    setCurrentTab(tab);
  };

  return (
    <>
      <Head>
        {/* Calculate how many matches are in all categories */}
        <title>🔴 Football Today - {countForToday} matches</title>
        <meta
          name="og:title"
          content={`🔴 Football Today - ${countForToday} matches`}
        />
        <meta
          name="description"
          content={`Displaying live football scores!
          There are ${countForToday} football matches on today!

          Football Today is a website that displays live football scores for all the major leagues.
          `}
        />
        <link 
          rel="icon" 
          href="/favicon.ico" 
        />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c]">
        <div className="container flex flex-col items-center justify-center gap-3 px-4 py-7 ">
          <div className="flex flex-col items-center">
            <h1 className="animate-pulse text-5xl font-extrabold tracking-tight text-white sm:text-[5rem] text-center">
              Football Today
            </h1>
            <p className="text-white text-center mt-1">Displaying live football scores for all the major leagues</p>
            <p className="text-white text-lg mt-6">
              Today&apos;s date is {format(new Date(), "do MMMM yyyy")}
            </p>

            <div className="tabs max-w-7xl justify-center tabs-boxed bg-transparent">
              {formulateTabs().map((tab, index) => {
                return (
                  <motion.div
                    key={index}
                    initial="initial"
                    animate="animate"
                    variants={{
                      initial: {
                        opacity: 0,
                      },
                      animate: {
                        opacity: 1,
                      },
                    }}
                  >
                    <DateTab 
                      key={index}
                      tab={tab}
                      currentTab={currentTab}
                      setCurrentTab={setTab}
                    />
                  </motion.div>
                );
              })}
            </div>
          </div>
              
          <div>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3">
                <p className="text-white text-center">Loading...</p>
              </div>
            ) : (
              <div>
                {footballCategoryData.map((category, index) => {
                  const { heading, matches } = category;

                  return (
                    <div key={index}>
                      {/* Heading (international games, world cup, euros, friendlies, club friendlies, cups) */}
                      {/* Make sure it wraps the text if its too large */}
                      <div className="flex flex-col items-start justify-start">
                        <h2 className="lg:text-2xl sm:text-1xl font-bold text-white mb-3 mt-7 hover:opacity-75 animate-pulse break-words whitespace-pre-wrap">{heading}</h2>
                      </div>

                      {/* Matches */}
                      <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-4 md:gap-8 max-w-7xl">
                        {matches.map((match: FootballMatch, index) => {
                          // const { awayTeam, awayTeamScore, homeTeam, homeTeamScore, inProgress, time, aggScore, awayTeamLogo, homeTeamLogo, group, finalWinMessage, awayScorers, homeScorers } = match;
                          // console.log(awayScorers);
                          // console.log(homeScorers);
      
                          return (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              variants={{
                                initial: {
                                  opacity: 0,
                                },
                                animate: {
                                  opacity: 1,
                                },
                              }}
                              transition={{
                                type: "spring",
                                stiffness: 260,
                                damping: 20
                              }}
                            >
                              <FootballMatchComp 
                                key={index}
                                data={match}
                              />
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}