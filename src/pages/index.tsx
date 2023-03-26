import Head from "next/head";
import useGetAllFootballMatches from "~/hooks/useGetAllFootballMatches";
import { useEffect, useState } from "react";
import { format } from "date-fns";

import { getPoolForToday } from "~/ServerFunctions/scrapeBbcSports";
import FootballMatchComp from "~/components/footballMatch";

import type { RouterOutputs } from "~/utils/api";
import DateTab from "~/components/dateTab";
import { categoriesToComeFirst } from "~/helpers/footballCategoriesAlgorithm";
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
interface FootballProps {
  count: number;
  todaysData: FootballCategory[];
}

// categories that come first
// if not in this list, they will be sorted alphabetically
// an algorithm will sort the categories by what is most popular, as listed here

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

function processAndApplyData(data: FootballCategory[]) {
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

export const getServerSideProps = async () => {
  // const niceDate = formulateTime("Today");
  // const siteToScrape = `https://www.bbc.com/sport/football/scores-fixtures/${niceDate}`;
  // const data = await scrapeBbcSports(siteToScrape);
  const data = await getPoolForToday();

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
      todaysData: data,
    },
  };
};

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

export default function Football({ count, todaysData }: FootballProps) {
  const [currentTab, setCurrentTab] = useState("Today");
  // const [search, setSearch] = useState("");

  // set football categories for the current tab
  const [footballCategoryData, setFootballCategoryData] = useState<FootballCategory[]>(todaysData);

  // get all football matches
  const { isLoading, data, refetch } = useGetAllFootballMatches({
    currentTab: formulateTime(currentTab),
    enabled: true,
  });

  // useEffect for further tab data
  useEffect(() => {
    if (data) {
      void processAndApplyData(data).then((processedData) => {
        setFootballCategoryData(processedData);
      });
    }
  }, [data]);

  const setTab = (tab: string) => {
    void refetch();
    setCurrentTab(tab);
  };

  return (
    <>
      <Head>
        {/* Calculate how many matches are in all categories */}
        <title>🔴 Football Today - {count} matches</title>
        <meta
          name="og:title"
          content={`🔴 Football Today - ${count} matches`}
        />
        <meta
          name="description"
          content={`Displaying live football scores!
          There are ${count} football matches on today!

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
                  <DateTab 
                    key={index}
                    tab={tab}
                    currentTab={currentTab}
                    setCurrentTab={setTab}
                  />
                );
              })}
            </div>
          </div>

          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-4 mt-8">
              <h2 className="btn normal-case btn-ghost text-2xl font-bold text-white loading">Loading...</h2>
            </div>
          ) || (
            <div>
              {footballCategoryData.map((category, index) => {
                const { heading, matches } = category;

                return (
                  <div key={index}>
                    {/* Heading (international games, world cup, euros, friendlies, club friendlies, cups) */}
                    <h2 className="text-2xl font-bold text-white mb-3 mt-7 hover:opacity-75 animate-pulse break-words whitespace-pre-wrap">{heading}</h2>

                    {/* Matches */}
                    <div className="grid lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 gap-4 md:gap-8 max-w-7xl">
                      {matches.map((match: FootballMatch, index) => {
                        const { awayTeam, awayTeamScore, homeTeam, homeTeamScore, inProgress, time, aggScore, awayTeamLogo, homeTeamLogo, group, finalWinMessage } = match;
                        return (
                          <FootballMatchComp 
                            key={index}
                            awayTeam={awayTeam}
                            awayTeamScore={awayTeamScore}
                            homeTeam={homeTeam}
                            homeTeamScore={homeTeamScore}
                            inProgress={inProgress}
                            time={time}
                            aggScore={aggScore}
                            awayTeamLogo={awayTeamLogo}
                            homeTeamLogo={homeTeamLogo}
                            group={group}
                            finalWinMessage={finalWinMessage}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}