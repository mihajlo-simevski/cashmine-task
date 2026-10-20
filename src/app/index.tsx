import HomeScreen from "@/features/balances/components/HomeScreen";
import RequireToken from "@/features/token/components/RequireToken";

export default function Index() {
  return <RequireToken>{(token) => <HomeScreen token={token} />}</RequireToken>;
}
