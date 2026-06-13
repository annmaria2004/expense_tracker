Ledger — Personal Expense Tracker

A clean, fast personal expense tracker built with TanStack Start, React, and Tailwind CSS. Log spending, filter by category and date, and see monthly summaries with category breakdowns.

## Features

- Add expenses with title, amount, category, date, and optional note
- Edit existing expenses
- Delete expenses
- Search and filter by keyword, category, and date range
- Monthly expense summary with category breakdown bars
- Dark mode support
- Responsive layout

## Tech Stack

- TanStack Start (React 19 + Vite)
- TypeScript
- Tailwind CSS v4
- shadcn/ui (Radix UI primitives)
- date-fns
- Recharts
- React Hook Form + Zod
- LocalStorage persistence

## Run Locally

```bash
# Install dependencies
bun install

# Start dev server
bun dev
```

Then open `http://localhost:3000` in your browser.

## Build for Production

```bash
bun run build
```

## Data Storage

Expenses are stored in the browser's `localStorage`. Clearing site data will erase all entries.

## License

MIT
