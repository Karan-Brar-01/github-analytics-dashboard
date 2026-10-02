# GitPulse

A polished, live engineering analytics dashboard for the public GitHub portfolio of [Karan-Brar-01](https://github.com/Karan-Brar-01).

## What it shows

- Repository activity and recent public push events
- Portfolio language distribution
- Repository-level momentum scoring
- Documentation and activity signals
- Searchable and sortable repository performance table
- Recent public GitHub activity

## Data and privacy

GitPulse reads only public profile, repository, and event data from GitHub's REST API. It does not request a token, access private repositories, or store personal commit content. Browser data is cached locally for 15 minutes to reduce API usage. A bundled public-data snapshot keeps the dashboard useful if GitHub's unauthenticated API limit is temporarily reached.

The momentum score is an explanatory portfolio signal—not a measure of developer productivity. It combines repository freshness, public description/topics, stewardship metadata, and public adoption signals.

## Run locally

No build step or dependencies are required.

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Deployment

The site is published directly from the repository's `main` branch using GitHub Pages.
