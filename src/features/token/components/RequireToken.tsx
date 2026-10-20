import { Redirect } from "expo-router";

import { useToken } from "@/features/token/token-store";

type RequireTokenProps = { children: (token: string) => React.ReactNode };

// Shows the screen only when a token is saved; otherwise sends the user to the token screen.
export default function RequireToken({ children }: RequireTokenProps) {
  const token = useToken();
  if (token === undefined) return null; // server render: storage not known yet
  if (!token) return <Redirect href="/token" />;
  return children(token);
}
