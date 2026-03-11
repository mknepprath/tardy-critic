/**
 * Fetch historical IMDb ratings from the Wayback Machine for a given year.
 *
 * Usage:
 *   OMDB_API_KEY=xxx TMDB_API_KEY=xxx node scripts/fetch-historical-ratings.mjs [year]
 *
 * If no year is given, defaults to (current year - 10).
 * Outputs to app/data/historical-ratings-{year}.json.
 * Each file maps IMDb IDs to their rating from the release year.
 */

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const OMDB_API_KEY = process.env.OMDB_API_KEY;

if (!TMDB_API_KEY || !OMDB_API_KEY) {
  console.error("Set TMDB_API_KEY and OMDB_API_KEY env vars");
  process.exit(1);
}

const YEAR = parseInt(process.argv[2]) || new Date().getFullYear() - 10;
console.log(`\n=== Fetching historical ratings for ${YEAR} films ===\n`);

// Step 1: Get popular films from TMDb
const films = [];
for (let page = 1; page <= 5; page++) {
  const res = await fetch(
    `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&region=US&sort_by=popularity.desc&page=${page}&primary_release_date.gte=${YEAR}-01-01&primary_release_date.lte=${YEAR}-12-31`
  );
  const body = await res.json();
  if (!body.results) continue;
  for (const film of body.results) {
    if (film.adult || film.vote_count < 300) continue;
    films.push({ title: film.title, year: YEAR, tmdb_id: film.id });
  }
}
console.log(`Found ${films.length} films from TMDb`);

// Step 2: Get IMDb IDs from OMDb
const filmsWithIds = [];
for (let i = 0; i < films.length; i += 5) {
  const batch = films.slice(i, i + 5);
  const results = await Promise.allSettled(
    batch.map(async (f) => {
      const res = await fetch(
        `https://www.omdbapi.com/?t=${encodeURIComponent(f.title)}&y=${f.year}&apikey=${OMDB_API_KEY}`
      );
      const data = await res.json();
      return { ...f, imdbId: data.imdbID, currentRating: data.imdbRating };
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.imdbId) {
      filmsWithIds.push(r.value);
    }
  }
  await new Promise((r) => setTimeout(r, 200));
}
console.log(`Got ${filmsWithIds.length} IMDb IDs`);

// Step 3: Fetch historical ratings from Wayback Machine
// Try multiple date ranges for better coverage
const ratings = {};
let success = 0;
let failed = 0;

for (const film of filmsWithIds) {
  process.stdout.write(`  ${film.title}... `);
  try {
    // Try several date windows: H2 of release year, H1, then early next year
    const windows = [
      { from: `${YEAR}0601`, to: `${YEAR}1231` },
      { from: `${YEAR}0101`, to: `${YEAR}0601` },
      { from: `${YEAR + 1}0101`, to: `${YEAR + 1}0601` },
    ];

    let timestamp = null;
    for (const { from, to } of windows) {
      const cdxRes = await fetch(
        `https://web.archive.org/cdx/search/cdx?url=www.imdb.com/title/${film.imdbId}/&from=${from}&to=${to}&output=json&limit=3&filter=statuscode:200`
      );
      const cdxData = await cdxRes.json();
      if (Array.isArray(cdxData) && cdxData.length >= 2) {
        timestamp = cdxData[1][1];
        break;
      }
    }

    if (!timestamp) {
      console.log("no snapshot");
      failed++;
      continue;
    }

    const pageRes = await fetch(
      `https://web.archive.org/web/${timestamp}/http://www.imdb.com/title/${film.imdbId}/`
    );
    const html = await pageRes.text();

    // Try multiple patterns for the rating
    let match = html.match(/itemprop="ratingValue">([0-9.]+)</);
    if (!match) match = html.match(/"ratingValue":\s*"?([0-9.]+)/);
    if (!match) match = html.match(/"aggregateRating".*?"ratingValue":\s*"?([0-9.]+)/s);

    if (match) {
      const rating = parseFloat(match[1]);
      ratings[film.imdbId] = {
        title: film.title,
        tmdb_id: film.tmdb_id,
        rating_then: rating,
        snapshot_year: YEAR,
        snapshot_timestamp: timestamp,
      };
      console.log(`${rating} (snapshot ${timestamp})`);
      success++;
    } else {
      console.log("rating not found in HTML");
      failed++;
    }
  } catch (err) {
    console.log(`error: ${err.message}`);
    failed++;
  }

  // Be polite to the Wayback Machine
  await new Promise((r) => setTimeout(r, 1000));
}

console.log(`\nDone: ${success} ratings found, ${failed} failed`);

// Write output
const fs = await import("fs");
const dir = new URL("../app/data", import.meta.url).pathname;
fs.mkdirSync(dir, { recursive: true });
const outFile = `${dir}/historical-ratings-${YEAR}.json`;
fs.writeFileSync(outFile, JSON.stringify(ratings, null, 2) + "\n");
console.log(`Saved to app/data/historical-ratings-${YEAR}.json`);
