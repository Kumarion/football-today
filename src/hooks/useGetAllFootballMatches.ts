import { api } from "~/utils/api";

export default function useGetAllFootballMatches({ currentTab }: { currentTab: string }) {
  const { isLoading, data, refetch } = api.football.getCurrentFootballMatches.useQuery({ currentTab }, {
    // refetch every 10 seconds
    // not sure how efficient this is, but it's a start
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  return {
    isLoading,
    data,
    refetch,
  };
}