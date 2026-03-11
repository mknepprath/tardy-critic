import type { MetaFunction, LinksFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { motion } from "framer-motion";

import indexStyles from "../styles/index.css?url";
import historicalRatings from "../data/historical-ratings.json";
import React from "react";

interface AnniversaryFilm {
  title: string;
  release_date: string;
  tenth_anniversary_date: string;
  image_url: string;
  link: string;
  tmdb_rating: number;
  tmdb_votes: number;
  popularity: number;
}

interface ThenVsNow {
  title: string;
  image_url: string;
  link: string;
  rating_then: number;
  rating_now: number;
  delta: number;
}

export const meta: MetaFunction = () => {
  return [{ title: "Stats — Tardy Critic" }];
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: indexStyles }];
};

export const loader = async () => {
  const now = new Date();
  const anniversaryYear = now.getFullYear() - 10;

  const gte = `${anniversaryYear}-01-01`;
  const lte = `${anniversaryYear}-12-31`;

  const allFilms: AnniversaryFilm[] = [];

  for (let page = 1; page <= 5; page++) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&region=US&sort_by=popularity.desc&page=${page}&primary_release_date.gte=${gte}&primary_release_date.lte=${lte}`
      );
      const body = await response.json();
      if (!body.results) continue;
      for (const film of body.results) {
        if (film.adult) continue;
        if (film.vote_count < 300) continue;

        const releaseDate = new Date(film.release_date);
        const anniversaryDate = new Date(releaseDate);
        anniversaryDate.setFullYear(releaseDate.getFullYear() + 10);

        allFilms.push({
          title: film.title,
          release_date: film.release_date,
          tenth_anniversary_date: anniversaryDate.toISOString().split("T")[0],
          image_url: film.poster_path
            ? `https://image.tmdb.org/t/p/w300${film.poster_path}`
            : "",
          link: `https://www.letterboxd.com/tmdb/${film.id}`,
          tmdb_rating: film.vote_average,
          tmdb_votes: film.vote_count,
          popularity: film.popularity,
        });
      }
    } catch (error) {
      console.error("TMDb fetch error:", error);
    }
  }

  // Then vs Now: use pre-scraped historical ratings + live OMDb for current
  const thenVsNow: ThenVsNow[] = [];
  const omdbKey = process.env.OMDB_API_KEY;
  const historical = historicalRatings as Record<
    string,
    { title: string; tmdb_id: number; rating_then: number }
  >;

  if (omdbKey) {
    // Find films that have historical data
    const imdbIds = Object.keys(historical);

    // Fetch current ratings from OMDb (fast, parallel)
    const omdbResults = await Promise.allSettled(
      imdbIds.map(async (imdbId) => {
        const res = await fetch(
          `https://www.omdbapi.com/?i=${imdbId}&apikey=${omdbKey}`
        );
        return { imdbId, data: await res.json() };
      })
    );

    for (const result of omdbResults) {
      if (result.status !== "fulfilled") continue;
      const { imdbId, data } = result.value;
      if (data.Response !== "True" || !data.imdbRating || data.imdbRating === "N/A")
        continue;

      const hist = historical[imdbId];
      const currentRating = parseFloat(data.imdbRating);
      const delta = currentRating - hist.rating_then;

      // Find matching TMDb film for poster
      const tmdbFilm = allFilms.find(
        (f) => f.link === `https://www.letterboxd.com/tmdb/${hist.tmdb_id}`
      );

      thenVsNow.push({
        title: hist.title,
        image_url: tmdbFilm?.image_url || "",
        link: tmdbFilm?.link || `https://www.imdb.com/title/${imdbId}/`,
        rating_then: hist.rating_then,
        rating_now: currentRating,
        delta,
      });
    }

    // Sort by absolute delta (biggest changes first)
    thenVsNow.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }

  const todayStr = now.toISOString().split("T")[0];
  const past = allFilms.filter((f) => f.tenth_anniversary_date <= todayStr);
  const upcoming = allFilms.filter((f) => f.tenth_anniversary_date > todayStr);

  const highestRated = [...allFilms]
    .sort((a, b) => b.tmdb_rating - a.tmdb_rating)
    .slice(0, 10);

  const mostVoted = [...allFilms]
    .sort((a, b) => b.tmdb_votes - a.tmdb_votes)
    .slice(0, 10);

  const ratingBuckets: Record<string, number> = {};
  for (const film of allFilms) {
    const bucket = Math.floor(film.tmdb_rating);
    const key = `${bucket}-${bucket + 1}`;
    ratingBuckets[key] = (ratingBuckets[key] || 0) + 1;
  }

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthlyCount: Record<string, number> = {};
  for (const film of allFilms) {
    const month = parseInt(film.release_date.split("-")[1]) - 1;
    monthlyCount[monthNames[month]] =
      (monthlyCount[monthNames[month]] || 0) + 1;
  }

  const avgRating =
    allFilms.reduce((sum, f) => sum + f.tmdb_rating, 0) / allFilms.length;

  return json({
    anniversaryYear,
    totalFilms: allFilms.length,
    avgRating: Math.round(avgRating * 10) / 10,
    passedCount: past.length,
    upcomingCount: upcoming.length,
    highestRated,
    mostVoted,
    thenVsNow,
    ratingBuckets,
    monthlyCount,
  });
};

function RatingBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = (value / max) * 100;
  return (
    <div className="ratingBarRow">
      <span className="ratingBarLabel">{label}</span>
      <div className="ratingBarTrack">
        <motion.div
          className="ratingBarFill"
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="ratingBarValue">{value}</span>
    </div>
  );
}

function DeltaLabel({ delta }: { delta: number }) {
  const abs = Math.abs(delta);
  let label: string;
  let className: string;

  if (abs < 0.2) {
    label = "Holding steady";
    className = "gapNeutral";
  } else if (delta > 0) {
    label = abs >= 0.5 ? "Aged like fine wine" : "Warming up";
    className = "gapPositive";
  } else {
    label = abs >= 0.5 ? "Lost its luster" : "Cooling off";
    className = "gapNegative";
  }

  return <span className={`gapLabel ${className}`}>{label}</span>;
}

export default function Stats() {
  const data = useLoaderData<typeof loader>();

  const maxBucket = Math.max(...Object.values(data.ratingBuckets));
  const maxMonth = Math.max(...Object.values(data.monthlyCount));

  return (
    <div className="page">
      <header className="header">
        <div className="headerLeft">
          <a href="/">
            <h1 className="title">Tardy Critic</h1>
          </a>
          <p className="tagline">Movie Reviews One Decade Later</p>
        </div>
        <a href="/" className="aboutLink">
          &larr; HOME
        </a>
      </header>

      <h2 className="statsHero">The Class of {data.anniversaryYear}</h2>
      <p className="statsSubtitle">
        {data.totalFilms} notable films turning 10 this year &middot; Average
        audience score: {data.avgRating}/10
      </p>
      <p className="statsProgress">
        {data.passedCount} anniversaries passed &middot;{" "}
        {data.upcomingCount} still to come
      </p>

      {data.thenVsNow.length > 0 && (
        <section>
          <h3 className="sectionHeading">Then vs Now</h3>
          <p className="statsDescription">
            IMDb rating in {data.anniversaryYear} vs today — same audience,
            same scale, a decade apart
          </p>
          <div className="divider" />

          <div className="gapGrid">
            {data.thenVsNow.map((film) => (
              <motion.div
                key={film.link}
                className="gapCard"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <a href={film.link} className="gapPoster">
                  <img
                    src={film.image_url}
                    alt={film.title}
                    className="poster"
                  />
                </a>
                <div className="gapInfo">
                  <p className="gapTitle">{film.title}</p>
                  <div className="gapScores">
                    <span className="gapScore">
                      {data.anniversaryYear}: {film.rating_then.toFixed(1)}
                      <small>/10</small>
                    </span>
                    <span className="gapArrow">&rarr;</span>
                    <span className="gapScore">
                      Now: {film.rating_now.toFixed(1)}
                      <small>/10</small>
                    </span>
                    <span
                      className={`gapDelta ${film.delta > 0 ? "gapDeltaUp" : film.delta < -0.05 ? "gapDeltaDown" : ""}`}
                    >
                      {film.delta > 0 ? "+" : ""}
                      {film.delta.toFixed(1)}
                    </span>
                  </div>
                  <DeltaLabel delta={film.delta} />
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="sectionHeading">Highest Rated</h3>
        <p className="statsDescription">
          Top audience scores on TMDb, a decade later
        </p>
        <div className="divider" />

        <div className="statsListGrid">
          {data.highestRated.map((film, i) => (
            <motion.div
              key={film.link}
              className="statsListCard"
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <span className="statsRank">{i + 1}</span>
              <a href={film.link}>
                <img
                  src={film.image_url}
                  alt={film.title}
                  className="poster statsListPoster"
                />
              </a>
              <div className="statsListInfo">
                <p className="statsListTitle">{film.title}</p>
                <p className="statsListScore">
                  {film.tmdb_rating.toFixed(1)}/10
                  <small> ({film.tmdb_votes.toLocaleString()} votes)</small>
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="sectionHeading">Most Discussed</h3>
        <p className="statsDescription">
          Films with the most audience votes — still on people's minds
        </p>
        <div className="divider" />

        <div className="statsListGrid">
          {data.mostVoted.map((film, i) => (
            <motion.div
              key={film.link}
              className="statsListCard"
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <span className="statsRank">{i + 1}</span>
              <a href={film.link}>
                <img
                  src={film.image_url}
                  alt={film.title}
                  className="poster statsListPoster"
                />
              </a>
              <div className="statsListInfo">
                <p className="statsListTitle">{film.title}</p>
                <p className="statsListScore">
                  {film.tmdb_votes.toLocaleString()} votes
                  <small> ({film.tmdb_rating.toFixed(1)}/10)</small>
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="sectionHeading">Rating Distribution</h3>
        <p className="statsDescription">
          How audiences rate the class of {data.anniversaryYear} today
        </p>
        <div className="divider" />

        <div className="chartContainer">
          {Object.entries(data.ratingBuckets)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([bucket, count]) => (
              <RatingBar
                key={bucket}
                label={bucket}
                value={count}
                max={maxBucket}
              />
            ))}
        </div>
      </section>

      <section>
        <h3 className="sectionHeading">Release Calendar</h3>
        <p className="statsDescription">
          When {data.anniversaryYear}'s notable films hit theaters
        </p>
        <div className="divider" />

        <div className="chartContainer">
          {[
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
          ].map((month) => (
            <RatingBar
              key={month}
              label={month}
              value={data.monthlyCount[month] || 0}
              max={maxMonth}
            />
          ))}
        </div>
      </section>

      <footer className="footer">
        <div className="divider" />
        <p className="footerText">
          Tardy Critic &middot; Movie Reviews One Decade Later
        </p>
      </footer>
    </div>
  );
}
