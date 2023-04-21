import { format } from "date-fns";
import { zonedTimeToUtc } from "date-fns-tz";
import Image from "next/image";

import type { Category } from "~/helpers/scrapeBbcSports";
type FootballMatch = Category["matches"][0] & {
    homeTeamLogo?: string;
    awayTeamLogo?: string;
};

function getActualTime(time: string) {
  // the time is in UK and 24 hours format, we need to convert it to the user's timezone and 12 hours format
  if (time == "") {
    return time;
  }
  
  // get their timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // convert the time to their timezone
  const newTime = zonedTimeToUtc(time, timezone);
  return format(newTime, "h:mm a");
}

const STATUS = {
  "post-event": "Full time",
  "in-play": "Live",
  "mid-event": "Live",
  "pre-event": "Not started",
} as { [key: string]: string };

const FootballMatchComp = ({
  data
}: {
  data: FootballMatch;
}) => {
  const {
    homeTeam,
    awayTeam,
    // homeTeamScore,
    // awayTeamScore,
    homeTeamLogo,
    awayTeamLogo,
    currentTime,
    dateStarting,
    group,
    aggScore,
    // inProgress,
    // finalWinMessage,
    awayScorers,
    homeScorers,
    fullTime,
    status,
  } = data;

  const newAwayTeamScore = awayScorers ? awayScorers.length : 0;
  const newHomeTeamScore = homeScorers ? homeScorers.length : 0;
  
  return (
    <div
      key = {`${homeTeam} + ${awayTeam}`} // index for now until we get ids
      className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 text-white hover:bg-white/20"
    >
      <div className="flex-row gap-3">
        {fullTime && (
          <h1 className="text-blue-400 text-xl text-center mb-4">
              Full time
          </h1>
        )}

        {/* Country v Country with flag */}
        <div className="grid grid-cols-3 gap-7 items-center">
          <div className="w-auto grid grid-rows-1 gap-2 h-full">
            <div className="hover:scale-110 transform transition duration-150 ease-in-out">
              <Image
                src={homeTeamLogo == "" ? "/emptyfc.png" : homeTeamLogo || "/emptyfc.png"}
                width={65}
                height={65}
                quality={100}
                className="ml-2"
                alt=""
              />

              <div className="text-center">
                <h1 className="text-center w-20 break-words">
                  {homeTeam}
                </h1>
              </div>
            </div>

            <ul className="min-h-10">
              {homeScorers && homeScorers.length > 0 && homeScorers.map((scorer) => {
                return (
                  <li 
                    key={scorer[0]} 
                    className="text-xs text-left break-words"
                  >
                    {scorer[0]} <span className="text-green-400">{scorer[1]}</span>
                  </li>
                );
              })}
            </ul>
          </div>
              
          <div className="flex flex-row justify-center items-center gap-2 mb-10 h-full">
            <div>
              <span className="text-4xl font-bold">
                {STATUS[status] === "Full time" && newHomeTeamScore}
                {STATUS[status] === "Live" && newHomeTeamScore}
              </span>
            </div>

            <div>
              <span className="text-4xl font-mono">
                  -
              </span>
            </div>
                
            <div>
              <span className="text-4xl font-bold">
                {STATUS[status] === "Full time" && newAwayTeamScore}
                {STATUS[status] === "Live" && newAwayTeamScore}
              </span>
            </div>
          </div>
              
          <div className="w-auto grid grid-rows-1 gap-2 h-full">
            <div className="hover:scale-110 transform transition duration-150 ease-in-out">
              <Image
                src={awayTeamLogo == "" ? "/emptyfc.png" : awayTeamLogo || "/emptyfc.png"}
                width={65}
                height={65}
                quality={100}
                className="ml-2"
                alt=""
              />

              <div>
                <h1 className="text-center w-20 break-words">
                  {awayTeam}
                </h1>
              </div>
            </div>

            <ul className="min-h-10">
              {awayScorers && awayScorers.length > 0 && awayScorers.map((scorer) => {
                return (
                  <li
                    key={scorer[0]}
                    className="text-xs text-right break-words"
                  >
                    {scorer[0]} <span className="text-green-400">{scorer[1]}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
          
      <div className="grid justify-center mt-4 gap-1 w-full">
        {group && (
          <span className="text-[#f5a623] text-lg text-center w-full">
            {group}
          </span>
        )}

        <span className="flex flex-col text-2xl w-full text-center">
          {aggScore && (
            <span className="text-[#f5a623] text-lg text-center w-full">
              {aggScore}
            </span>
          )}

          {STATUS[status] && STATUS[status] === "Not started" ? (
            <span className="text-2xl normal-case text-green-400">
              {getActualTime(dateStarting)}
            </span>
          ) : null}

          {STATUS[status] === "Live" && (
            <span className="text-2xl normal-case text-red-400">
              {currentTime + "'"} live
            </span>
          )}
        </span>
      </div>
    </div>
  );
};

export default FootballMatchComp;