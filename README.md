# CATS — Campus Appointment Tracking System

## Frontend

The current Expo frontend lives in `front_end/`. Use Node.js 22.13 or newer and pnpm 11.25.0:

make sure you have npm and pnpm installed first
this will run the application for the first time, and install all required dependencies from the lockfile
Or just use the make files
```sh
cd front_end
pnpm install --frozen-lockfile
pnpm web
```

After installation, `pnpm web` also works from the repository root. See [frontend setup](front_end/README.md) and the [setup change record](front_end/SETUP_CHANGES.md). The current Home/Explore starter does not require a running backend.

## Project structure

- `front_end/`: standalone Expo application, assets, configuration, and pnpm lockfile
- `back_end/`: Python backend code
- `DEMO_PLAYGROUND/`: separate experimental applications
- `scraper/`: scraping work

## Backend tooling

The backend uses Python, FastAPI, PostgreSQL, and uv. `make setup` installs Python dependencies and configures Git hooks; it does not install frontend packages. See [backend documentation](back_end/README.md).

## Contributing

Work on a branch and open a pull request against main. For frontend changes, run `pnpm lint`, `pnpm typecheck`, and `pnpm build` from `front_end/`. Use uv for Python dependencies and pnpm for frontend dependencies.
