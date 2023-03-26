import { format } from "date-fns";
import Image from "next/image";

import type { RouterOutputs } from "~/utils/api";
type FootballMatch = RouterOutputs["football"]["getCurrentFootballMatches"][0]["matches"][0] & {
    homeTeamLogo?: string;
    awayTeamLogo?: string;
};

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