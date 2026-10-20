# CashMine task — project rules

2-hour practical task for CashMine. Expo SDK 57 + Expo Router + TypeScript, delivered as a **web app opened on a phone** (no iOS/Android build needed), hosted on EAS Hosting. Submission: a public GitHub repo with full commit history + the live link. AI conversations go in `ai-logs/` and must contain **no secrets**. See `AGENTS.md` for general Expo guidance.

Design for a ~390px-wide phone screen first. Desktop only needs to look reasonable (the `Screen` wrapper centres a phone-width column).

## Tooling

- **pnpm 11** (`packageManager` in package.json; Node 24 via `.mise.toml`). Add Expo/RN packages with `npx expo install`, others with `pnpm add`. pnpm blocks dependency build scripts: approve new ones in `pnpm-workspace.yaml` → `allowBuilds`.
- Before calling anything done: `pnpm check` (lint + format check + typecheck + tests). Lefthook runs format/lint/typecheck on commit; commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:` …).
- oxlint only auto-discovers `oxlint.config.mts` (object export). If you touch it, prove it loads by linting a probe file containing `Array<string>`.
- `pnpm test` runs `jest --no-watchman`: with watchman, Jest sometimes hangs without output.
- If Metro serves stale code: `npx expo start --web --clear`.

## Styling: NativeWind 4 + react-native-reusables

- Tailwind 3 classes via `className`. Use the semantic tokens from `tailwind.config.js` / `src/global.css` (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-destructive`, `text-success` …). **Never hardcode colours**: dark mode follows the phone's setting through CSS media queries, so tokens switch automatically.
- UI primitives live in `src/components/ui` (shadcn port). Reuse them before writing custom ones. Add more with `npx @react-native-reusables/cli@latest add <name> --yes` (e.g. `dialog`, `tabs`, `select`, `checkbox`, `progress`, `avatar`).
- Text must go through `Text` from `@/components/ui/text` (has variants: `h1`–`h4`, `muted`, `large`, `small`, `lead`).
- **Icons**: import one at a time, `import Plus from "lucide-react-native/icons/plus"` (kebab-case file name), and render with `<Icon as={Plus} className="size-4 text-foreground" />`. The barrel import is lint-blocked: Metro doesn't tree-shake and it adds ~3,800 icons (+2 MB).
- `react-native-css-interop` must stay a **direct** dependency: NativeWind's Babel output imports it and pnpm doesn't hoist it.
- Fonts: Inter is loaded from Google Fonts (`@import` in `global.css`, turned into a `<link>` by Expo). The rule that makes RN-web text inherit it matches `[dir="auto"]`. Don't change it back to `css-text-*` class selectors: those names only exist in dev builds.
- Flex rows with text: give the text child `min-w-0 flex-1` or it won't shrink.
- `hoverOnlyWhenSupported` is on, so `hover:` styles don't stick after taps on phones.

## Routing and screens

- `src/app/` holds route files only. Screens live in `src/features/<domain>/components`, shared UI in `src/components/ui`, layout chrome in `src/components/layout`.
- Wrap each screen in `Screen` from `@/components/layout/Screen` (scrolling, safe areas, phone-width column).
- Stack headers are off (`headerShown: false`); build headers in the screen. Set page titles with `<Head><title>…</title></Head>` from `expo-router/head` (Expo Router's own `<title>` tag wins over anything in `+html.tsx`).
- Prefer `<Link href asChild>` over `router.push`. `router.back()` needs a fallback on web: `router.canGoBack() ? router.back() : router.replace("/")`.
- `src/app/+html.tsx` holds the viewport/PWA meta (`viewport-fit=cover`, manifest, theme-color).

## Data: API calls go through the server proxy

- **The browser never calls the upstream API or sees the token.** Client code calls `api(schema, path, options)` from `@/lib/api`, which hits `/api/proxy/<path>`. `src/app/api/proxy/[...path]+api.ts` adds the token and forwards to `API_BASE_URL`. This also avoids CORS problems.
- Adjust `AUTH_HEADER` / `formatToken` in the proxy route to match the API docs (default: `Authorization: Bearer <token>`).
- Every response is validated with a zod schema (`api(UserSchema, "users/me")`). Failures throw `ApiError` (status + body). Query retries skip 4xx.
- Use TanStack Query for all server state: `useQuery` for reads, `useMutation` + `invalidateQueries` for writes. Never `useEffect` + `useState` for fetching. Use `enabled` + a type guard for dependent queries.
- Forms: react-hook-form + zod (`@hookform/resolvers/zod`), `Controller` around reusables `Input`. Use `setError("root", …)` for server errors.
- `src/lib/proxy-target.ts` refuses paths that would leave `API_BASE_URL` (absolute or `//` URLs), so the token can't be sent to another host. Keep that check.

## Secrets and environments

- Local dev: `.env.local` (gitignored) with `API_BASE_URL` and `API_TOKEN`. See `.env.example`. **Never** use the `EXPO_PUBLIC_` prefix for the token: those values are baked into the public JS bundle.
- EAS Hosting: env vars per environment, visibility **sensitive** (EAS Hosting can't use `secret`):
  `npx eas-cli@latest env:create --environment production --name API_TOKEN --value <token> --visibility sensitive`
  (`API_BASE_URL` can be `plaintext`.) Deployments are immutable: after changing a variable, deploy again.
- The `preview` environment currently holds **fake** values (`https://httpbin.org/anything` + a dummy token) from the setup check. Replace them or use `production` for the real API.
- Never put the token in code, commits, command lines that get logged into `ai-logs/`, or screenshots.

## Deploy

- Preview: `pnpm deploy:web` → `https://cashmine-app--<id>.expo.app`
- Production: `pnpm deploy:web:prod` → `https://cashmine-app.expo.app` (needs the `production` env vars first)
- Check the live proxy with `curl <url>/api/health` (`proxyConfigured: true`).

## Tests

- jest-expo (native preset) + React Native Testing Library 14: `render` is async (`await render(...)`), and `findBy*` is for async UI.
- Helpers: `renderWithProviders` (`@/test/render`, fresh QueryClient, no retries) and `mockFetch(status, body)` (`@/test/mock-fetch`; the Jest env has no `Response`).
- `test-renderer` is pinned to `~1.2.0` (React 19.2). 1.3 needs React 19.3.
- Prioritise tests for logic (formatting, mapping, validation) and one or two screen flows.

## Conventions

- `T[]` not `Array<T>`, no non-null `!`, `export default function` for components, no `React.FC`.
- All user-facing strings go through i18n (`src/i18n/en.ts`, typed keys via `useTranslation`).
- Prefer `Pressable`. Reserve space for async content (skeletons) instead of mounting it late. Keep `useEffect` for real side effects.
- Money: never use floats for arithmetic if the API gives minor units. Format with `Intl.NumberFormat` with the API's currency.
