This is an Expo (React Native) app delivered as a **web app for phones**. Project rules are in `CLAUDE.md`.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. Before writing code that touches an Expo, EAS or React Native API:

1. Read the major version of the `expo` package in `package.json` (currently 57).
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v57.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt and follow its links to the page you need.

## Commands (pnpm)

```bash
npx expo install <package>  # Expo/RN packages — resolves SDK-compatible versions
pnpm add <package>          # everything else
pnpm web                    # dev server (web)
pnpm check                  # lint + format check + typecheck + tests
pnpm fmt                    # oxfmt
pnpm export:web             # production web build to dist/
pnpm deploy:web             # preview deploy to EAS Hosting
pnpm deploy:web:prod        # production deploy
npx expo-doctor@latest      # diagnose dependency and config issues
```

## Navigation & Routing

- **Expo Router**. Routes live in `src/app/`; every file there is a screen or API route (`+api.ts`), `_layout.tsx` files define navigators. Keep non-route code outside `src/app/`.
- Import `Link`, `router`, `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Hosting

EAS Hosting (`eas deploy`). Server env vars come from EAS environments (`--environment`), visibility `plaintext` or `sensitive`. Docs: https://docs.expo.dev/eas/hosting/introduction/
