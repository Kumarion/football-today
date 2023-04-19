import { format } from "date-fns";
import { getTimezoneOffset, zonedTimeToUtc } from "date-fns-tz";
import Image from "next/image";

// import type { RouterOutputs } from "~/utils/api";
import type { Category } from "~/helpers/scrapeBbcSports";
type FootballMatch = Category["matches"][0] & {
    homeTeamLogo?: string;
    awayTeamLogo?: string;
};

function getActualTime(team: string, time: string) {
  // the time is in UK and 24 hours format, we need to convert it to the user's timezone and 12 hours format
  if (time == "") {
    return time;
  }

  const newTime = new Date();
  const [hours, minutes] = time.split(":");

  if (!hours || !minutes) {
    return time;
  }

  newTime.setHours(parseInt(hours));
  newTime.setMinutes(parseInt(minutes));

  // get current timezone for the user
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const utcTime = zonedTimeToUtc(newTime, timezone);
  
  // get offset of the timezone to london
  const offsetInMs = getTimezoneOffset(timezone, utcTime);
  const offsetInHours = offsetInMs / 1000 / 60 / 60;

  newTime.setHours(newTime.getHours() + offsetInHours - 1);
  return format(newTime, "h:mm a");
}

const FootballMatchComp = ({
  homeTeam,
  awayTeam,
  homeTeamScore,
  awayTeamScore,
  homeTeamLogo,
  awayTeamLogo,
  time,
  group,
  aggScore,
  inProgress,
  finalWinMessage,
  awayScorers,
  homeScorers,
}: FootballMatch) => {
  return (
    <div
      key = {`${homeTeam} + ${awayTeam}`} // index for now until we get ids
      className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 text-white hover:bg-white/20"
    >
      <div className="flex-row gap-3">
        {homeTeamScore == "" && awayTeamScore == "" && (
          <h1 className="text-blue-400 text-xl text-center mb-4">
              Not started
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
                    key={scorer} 
                    className="text-xs text-left break-words"
                  >
                    {scorer} <span className="text-green-400"></span>
                  </li>
                );
              })}
            </ul>
          </div>
              
          <div className="flex flex-row justify-center items-center gap-2 mb-10 h-full">
            <div>
              <span className="text-4xl font-bold">
                {homeTeamScore}
              </span>
            </div>

            <div>
              <span className="text-4xl font-mono">
                    -
              </span>
            </div>

            <div>
              <span className="text-4xl font-bold">
                {awayTeamScore}
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
                    key={scorer}
                    className="text-xs text-right break-words"
                  >
                    {scorer} <span className="text-green-400"></span>
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

          {finalWinMessage && (
            <span className="text-green-400 text-lg text-center w-full">
              {finalWinMessage}
            </span>
          )}

          {homeTeamScore == "" && awayTeamScore == "" && (
            <span className="text-2xl">
              {getActualTime(homeTeam, time)}
            </span>
          ) || (
            <span className="text-3xl text-center w-full font-mono">
              {/* remove spaces */}
              {time.replace(/\s/g, "")}
            </span>
          )}
        </span>
      </div>
    </div>
  );
};

export default FootballMatchComp;