import { screen } from "@testing-library/react-native";

import SetupCheckScreen from "@/features/setup/components/SetupCheckScreen";
import { mockFetch } from "@/test/mock-fetch";
import { renderWithProviders } from "@/test/render";

describe("SetupCheckScreen", () => {
  it("shows the API route as OK and the proxy as not set", async () => {
    mockFetch(200, { ok: true, proxyConfigured: false, time: "now" });

    await renderWithProviders(<SetupCheckScreen />);

    expect(await screen.findByText("Not set")).toBeOnTheScreen();
    expect(screen.getAllByText("OK")).toHaveLength(2);
  });
});
