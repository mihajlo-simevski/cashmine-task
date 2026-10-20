import { useLocalSearchParams } from "expo-router";

import ClaimStatusScreen from "@/features/claims/components/ClaimStatusScreen";
import RequireToken from "@/features/token/components/RequireToken";

export default function ClaimStatusRoute() {
  const { id, replayed } = useLocalSearchParams<{ id: string; replayed?: string }>();
  return (
    <RequireToken>
      {(token) => <ClaimStatusScreen token={token} id={id} replayed={replayed === "1"} />}
    </RequireToken>
  );
}
