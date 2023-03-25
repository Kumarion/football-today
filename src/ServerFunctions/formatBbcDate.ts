export default function formatBbcDate(currentTab: string) {
  let date = null;

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
  console.log(newDate);
  const siteToScrape = `https://www.bbc.com/sport/football/scores-fixtures/${newDate}`;

  return {
    siteToScrape,
    newDate,
  };
}