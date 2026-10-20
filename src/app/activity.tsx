import ActivityScreen from "@/features/activity/components/ActivityScreen";
import RequireToken from "@/features/token/components/RequireToken";

export default function ActivityRoute() {
  return <RequireToken>{(token) => <ActivityScreen token={token} />}</RequireToken>;
}
