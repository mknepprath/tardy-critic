import type { V2_MetaFunction, LinksFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { motion } from "framer-motion";

import xml2js from "xml2js";

import indexStyles from "../styles/index.css";
import React from "react";

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

export const meta: V2_MetaFunction = () => {
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

  // return up to 8 upcoming anniversaries
  upcomingAnniversaries.splice(8);

  return json({
    ok: true,
    films,
    anniversaries: {
      today: todayAnniversaries,
      upcoming: upcomingAnniversaries,
    },
  });
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const [firstFilm, ...films] = data.films;

  const firstFilmDate = new Date(firstFilm.watched_date).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }
  );

  return (
    <div className="page">
      <header className="header">
        <div className="headerLeft">
          <h1 className="title">Tardy Critic</h1>
          <p className="tagline">Movie Reviews One Decade Later</p>
        </div>
        <a href="/about" className="aboutLink">
          ABOUT
        </a>
      </header>

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
              <p className="filmCaption">
                {new Date(film.tenth_anniversary_date).toLocaleDateString(
                  "en-US",
                  {
                    month: "long",
                    day: "numeric",
                    timeZone: "UTC",
                  }
                )}
              </p>
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
        <h3 className="sectionHeading">Previous Reviews</h3>
        <div className="divider" />

        <motion.div layout className="archiveGrid">
          {films.map((film) => (
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 1.02 }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
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
            </motion.div>
          ))}
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
