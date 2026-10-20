import { useLocalSearchParams } from "expo-router";

import ClaimScreen from "@/features/claims/components/ClaimScreen";
import RequireToken from "@/features/token/components/RequireToken";

export default function ClaimRoute() {
  const { asset } = useLocalSearchParams<{ asset?: string }>();
  return (
    <RequireToken>{(token) => <ClaimScreen token={token} initialAsset={asset} />}</RequireToken>
  );
}
