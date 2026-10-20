# CashMine Task

A small slice of the CashMine app, built with Expo (React Native + TypeScript) and delivered as a mobile web app.

**Live:** https://cashmine-app.expo.app (open on a phone)

## Stack

- Expo SDK 57, Expo Router (file-based routes in `src/app`)
- NativeWind 4 (Tailwind CSS) + react-native-reusables (shadcn/ui for React Native), lucide icons
- TanStack Query for server state, zod for response validation, react-hook-form for forms
- i18next for copy, Jest + React Native Testing Library for tests
- EAS Hosting (static pages + server API routes)

## How the API is called

The browser never talks to the API directly and never sees the API token.
Client code calls `/api/proxy/<path>`. That Expo API route (`src/app/api/proxy/[...path]+api.ts`) runs on the server, adds the token from a server-only environment variable and forwards the request. Responses are validated with zod before they reach the UI.

## Run locally

Requires Node 24 and pnpm 11.

```bash
pnpm install
cp .env.example .env.local   # fill in API_BASE_URL and API_TOKEN
pnpm web                     # http://localhost:8081
```

## Checks

```bash
pnpm check   # lint (oxlint) + format (oxfmt) + typecheck + tests
```

## Deploy

```bash
pnpm deploy:web:prod   # export + deploy to EAS Hosting (production env vars)
```

## Project layout

```
src/app/                 routes (screens, layouts, API routes)
src/features/<domain>/   screens and logic per feature
src/components/ui/       UI primitives (react-native-reusables)
src/components/layout/   page chrome
src/lib/                 API client, query client, utilities
src/i18n/                strings
ai-logs/                 AI conversations used to build this
```

## AI usage

AI tools were used to write code. The conversations are in [`ai-logs/`](./ai-logs), with secrets removed.
