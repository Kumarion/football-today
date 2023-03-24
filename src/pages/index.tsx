import Head from "next/head";
import useGetAllFootballMatches from "~/hooks/useGetAllFootballMatches";
import { useEffect, useState } from "react";
import { format } from "date-fns";

import Image from "next/image";
import formatBbcDate from "~/ServerFunctions/formatBbcDate";
import scrapeBbcSports from "~/ServerFunctions/scrapeBbcSports";
import type { RouterOutputs } from "~/utils/api";
type FootballMatch = RouterOutputs["football"]["getCurrentFootballMatches"][0]["matches"][0] & {
  homeTeamLogo?: string;
  awayTeamLogo?: string;
};
type FootballCategory = RouterOutputs["football"]["getCurrentFootballMatches"][0];
type FootballLogoSearchResponse = {
  teams: {
    images: {
      url: string;
    }[];
  }[];
};

// categories that come first
// if not in this list, they will be sorted alphabetically
// an algorithm will sort the categories by what is most popular, as listed here
const categoriesToComeFirst = [
  "World Cup",
  "World Cup Qualifying",
  "Premier League",
  "Champions League",
  "UEFA Nations League",
  "European Championship",
  "European Championship Qualifying",
  "International Friendlies",
  "Europa League",
  "FA Cup",
  "EFL Cup",
  "Spanish Copa del Rey",
  "Conference League",
  "La Liga",
  "Spanish La Liga",
  "Ligue 1",
  "French Coupe de France",
  "French Ligue 1",
  "Italian Serie A",
  "German Bundesliga",
  "Danish Superliga",
  "League One",
  "League Two",
  "Championship",
  "Scottish Premiership",
  "Scottish Championship",
];

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

function getActualTime(team: string, time: string) {
  if (time == "") {
    return time;
  }

  const timeSplit = time.split(":") as [string, string];
  const hours = timeSplit[0];
  const minutes = timeSplit[1];

  if (!hours || !minutes) {
    return time;
  }

  const currentDate = new Date();

  // convert the hours and minutes to a utc date
  currentDate.setUTCHours(parseInt(hours));
  currentDate.setMinutes(parseInt(minutes));

  return format(currentDate, "hh:mm a");
}

function formulateTabs() {
  // create tabs including TODAYs date and up to 7 days
  const tabs = [];
  const maxDays = 14;

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
  const footballLogoSearch = await fetch("https://search-api.onefootball.com/v2/en/search?q=" + encodeURIComponent(teamName), {
    // "headers": {
    //   "accept": "application/json, text/plain, */*",
    //   "accept-language": "en-US,en;q=0.9",
    //   "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"90\", \"Google Chrome\";v=\"90\"",
    //   "sec-ch-ua-mobile": "?0",
    //   "sec-fetch-dest": "empty",
    //   "sec-fetch-mode": "cors",
    //   "sec-fetch-site": "cross-site"
    // },
    // "referrer": "https://www.onefootball.com/en/",
    // "referrerPolicy": "strict-origin-when-cross-origin",
    // "body": null,
    // "method": "GET",
    // "mode": "cors",
    // "credentials": "omit"
  });

  const data = await footballLogoSearch.json() as FootballLogoSearchResponse;
  const teams = data?.teams || [] as FootballLogoSearchResponse['teams'];
  const first = teams[0] || {} as typeof teams[number];
  const images = first?.images || [] as typeof first['images'];
  const firstImage = images[0] || {} as typeof images[number];

  if (!firstImage) {
    return "/emptyfc.png";
  }

  return firstImage.url;
}

export const getServerSideProps = async () => {
  const siteToScrape = formatBbcDate("Today");
  const data = await scrapeBbcSports(siteToScrape);

  if (!data) {
    return {
      props: {
        count: 0,
      },
    };
  }

  const count = data.reduce((acc, category) => acc + category.matches.length, 0);

  return {
    props: {
      count,
    },
  };
};

export default function Football({ count }: { count: number }) {
  const [footballCategories, setFootballCategories] = useState<FootballCategory[]>([]);
  const [currentTab, setCurrentTab] = useState("Today");
  const { data, isLoading, refetch } = useGetAllFootballMatches({currentTab});

  useEffect(() => {
    if (data) {
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

      const newSortedDataWithImages = newSortedData.map(async (category) => {
        const newMatches = await Promise.all(category.matches.map(async (match: FootballMatch) => {
          const homeTeamLogo = await searchLogo(match.homeTeam);
          const awayTeamLogo = await searchLogo(match.awayTeam);

          return {
            ...match,
            homeTeamLogo,
            awayTeamLogo,
            homeTeamActualTime: getActualTime(match.homeTeam, match.homeTeam),
            awayTeamActualTime: getActualTime(match.awayTeam, match.awayTeam),
          };
        }));

        return {
          ...category,
          matches: newMatches,
        };
      });

      Promise.all(newSortedDataWithImages).then((data) => {
        setFootballCategories(data);
      }).catch(console.error);
    }
  }, [data]);

  return (
    <>
      <Head>
        {/* Calculate how many matches are in all categories */}
        <title>🔴 Football Today - {count} matches</title>
        <meta 
          name="description" 
          content="Displaying live football scores for football leagues around the world" 
        />
        <meta
          name="og:title"
          content={`🔴 Football Today - ${count} matches`}
        />
        <link 
          rel="icon" 
          href="/favicon.ico" 
        />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c]">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-7 ">
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
                const defaultStyling = " tab tab-md ";

                return (
                  <a 
                    key={index}
                    className={defaultStyling + (currentTab == tab ? "tab-active" : defaultStyling)}
                    onClick={() => {
                      setCurrentTab(tab);
                      void refetch();
                    }}
                  >
                    {/* If date is tomorrow, say Tomorrow, or Today, say */}
                    {tab == new Date(new Date().setDate(new Date().getDate() + 1)).toDateString() ? "Tomorrow" : tab}
                  </a> 
                );
              })}
            </div>
          </div>

          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-4">
              <h2 className="text-2xl font-bold text-white">Loading...</h2>
            </div>
          )}

          {footballCategories.map((category, index) => {
            const { heading, matches } = category;
            return (
              <div key={index}>
                {/* Heading (international games, world cup, euros, friendlies, club friendlies, cups) */}
                <h2 className="text-2xl font-bold text-white mb-3 hover:opacity-75 animate-pulse">{heading}</h2>

                {/* Matches */}
                <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-4 md:gap-8 max-w-7xl">
                  {matches.map((match: FootballMatch, index) => {
                    const { awayTeam, awayTeamScore, homeTeam, homeTeamScore, inProgress, time, aggScore, awayTeamLogo, homeTeamLogo, group } = match;
                    return (
                      <div
                        key = {index} // index for now until we get ids
                        className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 text-white hover:bg-white/20"
                      >
                        <div className="flex-row gap-3">
                          {homeTeamScore == "" && awayTeamScore == "" && (
                            <h1 className="text-blue-400 text-xl text-center mb-4">
                              Not started
                            </h1>
                          )}

                          {/* Country v Country with flag */}
                          <div className="flex flex-row gap-4 items-center justify-between w-full">
                            <div className="flex flex-col items-center w-28 h-20 hover:scale-110 transform transition duration-150 ease-in-out">
                              <Image
                                src={homeTeamLogo == "" ? "/emptyfc.png" : homeTeamLogo || "/emptyfc.png"}
                                width={70}
                                height={70}
                                quality={100}
                                alt=""
                              />

                              <h1 className="text-center">
                                {homeTeam}
                              </h1>
                            </div>
                            
                            <div className="flex flex-row items-center gap-5 mb-2">
                              <div>
                                <span className="text-3xl font-bold">
                                  {homeTeamScore}
                                </span>
                              </div>

                              <div>
                                <span className="text-2xl font-mono">
                                  -
                                </span>
                              </div>

                              <div>
                                <span className="text-3xl font-bold">
                                  {awayTeamScore}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-center w-28 h-20 hover:scale-110 transform transition duration-150 ease-in-out">
                              <Image
                                src={awayTeamLogo == "" ? "/emptyfc.png" : awayTeamLogo || "/emptyfc.png"}
                                width={70}
                                height={70}
                                quality={100}
                                alt=""
                              />

                              <h1 className="text-center">
                                {awayTeam}
                              </h1>
                            </div>
                          </div>
                          
                        </div>
                        
                        <div className="grid justify-center mt-9 gap-1 w-full">
                          {group && (
                            <span className="text-[#f5a623] text-lg text-center w-full">
                              {group}
                            </span>
                          )}

                          {inProgress && (
                            <span className="text-[#f5a623] text-lg text-center w-full">
                              In progress
                            </span>
                          )}
                          
                          <span className="flex flex-col text-2xl w-full text-center">
                            {aggScore && (
                              <span className="text-[#f5a623] text-lg text-center w-full">
                                {aggScore}
                              </span>
                            )}

                            {homeTeamScore == "" && awayTeamScore == "" && (
                              <span className="text-2xl">
                                {getActualTime(homeTeam, time)}
                              </span>
                            ) || (
                              <span className="text-3xl text-center w-full font-mono">
                                {time}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}