import type { MetaFunction, LinksFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { motion, AnimatePresence } from "framer-motion";

import xml2js from "xml2js";

import indexStyles from "../styles/index.css?url";
import React, { useState, useEffect, useMemo } from "react";

function useCountdown(dateStr: string) {
  const [days, setDays] = useState(() => {
    const now = new Date();
    const target = new Date(dateStr + "T00:00:00");
    return Math.ceil(
      (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
  });

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      const target = new Date(dateStr + "T00:00:00");
      setDays(
        Math.ceil(
          (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )
      );
    }, 60000);
    return () => clearInterval(id);
  }, [dateStr]);

  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

function CountdownCaption({ dateStr }: { dateStr: string }) {
  const countdown = useCountdown(dateStr);
  return <p className="filmCaption">{countdown}</p>;
}

function Stars({ rating }: { rating: string }) {
  const num = parseFloat(rating);
  if (isNaN(num)) return null;
  const full = Math.floor(num);
  const half = num % 1 >= 0.5;
  return (
    <span className="stars" aria-label={`${num} out of 5 stars`}>
      {"★".repeat(full)}
      {half && "½"}
    </span>
  );
}

const LETTERBOXD_RSS = `https://letterboxd.com/tardycritic/rss/`;

interface Film {
  image_url: string;
  link: string;
  published_at: string;
  rating: string;
  review: string;
  rewatched: boolean;
  title: string;
  watched_date: string;
  year: string;
}

interface Anniversary {
  title: string;
  release_date: string;
  tenth_anniversary_date: string;
  image_url: string;
  link: string;
}

export const meta: MetaFunction = () => {
  return [{ title: "Tardy Critic" }];
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: indexStyles }];
};

export const loader = async () => {
  const films: Film[] = [];
  const anniversaries: Anniversary[] = [];
  await fetch(LETTERBOXD_RSS)
    .then((response) => response.text())
    .then((body) => {
      xml2js.parseString(body, function (error, response) {
        if (error) console.error(error);
        const filmList = response.rss.channel[0].item;
        for (let i = 0; i < filmList.length; i++) {
          const review = filmList[i].description[0].split(`</p>`);
          review.shift();
          films.push({
            image_url: filmList[i].description[0].split(`"`)[1],
            link: filmList[i].link[0],
            published_at: filmList[i].pubDate[0],
            rating: filmList[i]["letterboxd:memberRating"]?.[0],
            review: review.join(`</p>`),
            rewatched: filmList[i]["letterboxd:rewatch"]?.[0] === "Yes",
            title: filmList[i]["letterboxd:filmTitle"]?.[0],
            watched_date: filmList[i]["letterboxd:watchedDate"]?.[0],
            year: filmList[i]["letterboxd:filmYear"]?.[0],
          });
        }
      });
    })
    .catch((error) => console.error(error));

  // Search a wide window: from 1 month before today (10 years ago)
  // to 6 months after, across multiple pages for better coverage
  const now = new Date();
  const tenYearsAgoDate = new Date(now);
  tenYearsAgoDate.setFullYear(now.getFullYear() - 10);

  const rangeStart = new Date(tenYearsAgoDate);
  rangeStart.setMonth(rangeStart.getMonth() - 1);

  const rangeEnd = new Date(tenYearsAgoDate);
  rangeEnd.setMonth(rangeEnd.getMonth() + 6);

  const gte = rangeStart.toISOString().split("T")[0];
  const lte = rangeEnd.toISOString().split("T")[0];

  for (let page = 1; page <= 3; page++) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&region=US&sort_by=popularity.desc&page=${page}&primary_release_date.gte=${gte}&primary_release_date.lte=${lte}`
      );
      const body = await response.json();
      if (!body.results) continue;
      for (let i = 0; i < body.results.length; i++) {
        const film = body.results[i];
        if (film.adult) continue;
        if (film.vote_count < 500) continue;

        const releaseDate = new Date(film.release_date);
        const anniversaryDate = new Date(releaseDate);
        anniversaryDate.setFullYear(releaseDate.getFullYear() + 10);

        anniversaries.push({
          title: film.title,
          release_date: film.release_date,
          tenth_anniversary_date: anniversaryDate.toISOString().split("T")[0],
          image_url: `https://image.tmdb.org/t/p/w500${film.poster_path}`,
          link: `https://www.letterboxd.com/tmdb/${film.id}`,
        });
      }
    } catch (error) {
      console.error("TMDb fetch error:", error);
    }
  }

  // sort films by date
  films.sort((a, b) => {
    return (
      new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime()
    );
  });

  // sort anniversaries by date
  anniversaries.sort((a, b) => {
    return (
      new Date(a.tenth_anniversary_date).getTime() -
      new Date(b.tenth_anniversary_date).getTime()
    );
  });

  const todayStr = now.toISOString().split("T")[0];

  // get today's anniversaries
  const todayAnniversaries = anniversaries.filter(
    (anniversary) => anniversary.tenth_anniversary_date === todayStr
  );

  // upcoming: anniversary date is after today
  const upcomingAnniversaries = anniversaries.filter(
    (anniversary) => anniversary.tenth_anniversary_date > todayStr
  );

  // Trim to a multiple of 6 so the grid always has full rows (6 cols desktop, 3 cols mobile)
  const maxUpcoming = Math.min(upcomingAnniversaries.length, 18);
  const trimmed = maxUpcoming - (maxUpcoming % 6);
  upcomingAnniversaries.splice(trimmed);

  // "On this day" — reviews whose watched_date shares today's month+day
  const todayMD = todayStr.slice(5); // "MM-DD"
  const onThisDay = films.filter(
    (film) => film.watched_date && film.watched_date.slice(5) === todayMD
  );

  return json({
    ok: true,
    films,
    anniversaries: {
      today: todayAnniversaries,
      upcoming: upcomingAnniversaries,
    },
    onThisDay,
  });
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const [firstFilm, ...restFilms] = data.films;
  const [filter, setFilter] = useState("");
  const [randomFilm, setRandomFilm] = useState<Film | null>(null);

  const years = useMemo(() => {
    const set = new Set(data.films.map((f) => f.year));
    return Array.from(set).sort();
  }, [data.films]);

  const filteredFilms = useMemo(() => {
    if (!filter) return restFilms;
    return restFilms.filter((f) => f.year === filter);
  }, [restFilms, filter]);

  const firstFilmDate = new Date(firstFilm.watched_date).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }
  );

  function handleSurpriseMe() {
    const pick = data.films[Math.floor(Math.random() * data.films.length)];
    setRandomFilm(pick);
  }

  return (
    <div className="page">
      <header className="header">
        <div className="headerLeft">
          <h1 className="title">Tardy Critic</h1>
          <p className="tagline">Movie Reviews One Decade Later</p>
        </div>
        <div className="headerRight">
          <button className="surpriseBtn" onClick={handleSurpriseMe}>
            Surprise Me
          </button>
          <a href="/stats" className="aboutLink">
            STATS
          </a>
          <a href="/about" className="aboutLink">
            ABOUT
          </a>
        </div>
      </header>

      <AnimatePresence>
        {randomFilm && (
          <motion.section
            className="surpriseSection"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            key="surprise"
          >
            <div className="surpriseInner">
              <motion.div
                whileHover={{ scale: 1.03 }}
                className="surprisePoster"
              >
                <a href={randomFilm.link}>
                  <img
                    src={randomFilm.image_url}
                    alt={randomFilm.title}
                    className="poster posterGlow"
                  />
                </a>
              </motion.div>
              <div className="surpriseBody">
                <h3 className="surpriseTitle">
                  {randomFilm.title}{" "}
                  <span className="latestYear">({randomFilm.year})</span>
                </h3>
                {randomFilm.rating && <Stars rating={randomFilm.rating} />}
                <a href={randomFilm.link} className="readMore">
                  READ REVIEW &rarr;
                </a>
                <button
                  className="surpriseDismiss"
                  onClick={() => setRandomFilm(null)}
                >
                  &times;
                </button>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {data.anniversaries.today.length > 0 && (
        <section className="todaySection">
          <div className="todayBanner">
            <span className="todayAccent">&#9733;</span>
            <h2 className="todayHeading">
              Happy 10<sup>th</sup> Anniversary
            </h2>
            <span className="todayAccent">&#9733;</span>
          </div>

          <div className="todayGrid">
            {data.anniversaries.today.map((film) => (
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 1.02 }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                key={film.link}
                className="todayCard"
              >
                <a href={film.link}>
                  <img
                    src={film.image_url}
                    alt={film.title}
                    className="poster posterGlow"
                  />
                </a>
                <p className="filmCaption">
                  {film.title} ({film.release_date.split("-")[0]})
                </p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {data.onThisDay.length > 0 && (
        <section>
          <h3 className="sectionHeading">On This Day</h3>
          <div className="divider" />
          <div className="onThisDayGrid">
            {data.onThisDay.map((film) => (
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 1.02 }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                key={film.link}
                className="onThisDayCard"
              >
                <a href={film.link}>
                  <img
                    src={film.image_url}
                    alt={film.title}
                    className="poster"
                  />
                </a>
                <p className="filmCaption">
                  {film.title}{" "}
                  <span className="onThisDayYear">
                    reviewed {film.watched_date.split("-")[0]}
                  </span>
                </p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="sectionHeading">
          Upcoming 10<sup>th</sup> Anniversaries
        </h3>
        <div className="divider" />

        <div className="upcomingGrid">
          {data.anniversaries.upcoming.map((film) => (
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 1.02 }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              key={film.link}
              className="upcomingCard"
            >
              <a href={film.link}>
                <img
                  src={film.image_url}
                  alt={film.title}
                  className="poster"
                />
              </a>
              <CountdownCaption dateStr={film.tenth_anniversary_date} />
            </motion.div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="sectionHeading">Latest Review</h3>
        <div className="divider" />

        <div className="latestReview">
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 1.01 }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            className="latestPoster"
          >
            <a href={firstFilm.link}>
              <img
                src={firstFilm.image_url}
                alt={firstFilm.title}
                className="poster"
              />
            </a>
          </motion.div>

          <div className="latestBody">
            <h2 className="latestTitle">
              {firstFilm.title}{" "}
              <span className="latestYear">({firstFilm.year})</span>
            </h2>

            {firstFilm.rating && (
              <div className="latestRating">
                <Stars rating={firstFilm.rating} />
              </div>
            )}

            <p className="latestMeta">
              Reviewed on {firstFilmDate}, one decade after release
            </p>

            <div
              dangerouslySetInnerHTML={{ __html: firstFilm.review }}
              className="fade"
            />

            <a href={firstFilm.link} className="readMore">
              READ MORE &rarr;
            </a>
          </div>
        </div>
      </section>

      <section>
        <div className="previousHeader">
          <h3 className="sectionHeading">Previous Reviews</h3>
          <select
            className="filterSelect"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All Years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="divider" />

        <motion.div layout className="archiveGrid">
          <AnimatePresence>
            {filteredFilms.map((film) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 1.02 }}
                key={film.link}
                className="archiveCard"
              >
                <a href={film.link}>
                  <img
                    src={film.image_url}
                    alt={film.title}
                    className="poster"
                  />
                </a>
                {film.rating && (
                  <p className="archiveRating">
                    <Stars rating={film.rating} />
                  </p>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
        <p className="filmCount">{data.films.length} films reviewed</p>
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
