const DateTab = ({ tab, currentTab, setCurrentTab }: 
    {
        tab: string; 
        currentTab: 
        string; setCurrentTab: (tab: string) => void; 
}) => {
  const defaultStyling = " tab tab-md ";

  return (
    <a 
      className={defaultStyling + (currentTab == tab ? "tab-active" : defaultStyling)}
      onClick={() => {
        setCurrentTab(tab);
      }}
    >
      {/* If date is tomorrow, say Tomorrow, or Today, say */}
      {tab == new Date(new Date().setDate(new Date().getDate() + 1)).toDateString() ? "Tomorrow" : tab}
    </a> 
  );
};

export default DateTab;