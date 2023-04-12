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

  // get 10 years ago today in YYYY-MM-DD format
  const tenYearsAgo = new Date(
    new Date().setFullYear(new Date().getFullYear() - 10)
  )
    .toISOString()
    .split("T")[0];
  // Get movies from one month before and after date. This is because the API
  //  returns movies based on the primary release date, so even though Oblivion
  //  comes out on the 19th (US) and today is the 10th, it will not be returned,
  //  because it's primary release date has passed.
  const oneMonthBefore = new Date(
    new Date(tenYearsAgo).setMonth(new Date(tenYearsAgo).getMonth() - 2)
  )
    .toISOString()
    .split("T")[0];
  // get one month later than ten_years_ago in YYYY-MM-DD format
  const oneMonthLater = new Date(
    new Date(tenYearsAgo).setMonth(new Date(tenYearsAgo).getMonth() + 2)
  )
    .toISOString()
    .split("T")[0];

  await fetch(
    `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.TMDB_API_KEY}&region=US&sort_by=popularity.desc&page=1&primary_release_date.gte=${oneMonthBefore}&primary_release_date.lte=${oneMonthLater}`
  )
    .then((response) => response.json())
    .then((body) => {
      for (let i = 0; i < body.results.length; i++) {
        const film = body.results[i];
        if (film.adult) continue;
        if (film.vote_count < 2000) continue;

        anniversaries.push({
          title: film.title,
          release_date: film.release_date,
          tenth_anniversary_date: new Date(
            new Date(film.release_date).setFullYear(
              new Date(film.release_date).getFullYear() + 10
            )
          )
            .toISOString()
            .split("T")[0],
          image_url: `https://image.tmdb.org/t/p/w500${film.poster_path}`,
          link: `https://www.letterboxd.com/tmdb/${film.id}`,
        });
      }
    });

  // sort films by date
  films.sort((a, b) => {
    return (
      new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime()
    );
  });

  // sort anniversaries by date
  anniversaries.sort((a, b) => {
    return (
      new Date(a.release_date).getTime() - new Date(b.release_date).getTime()
    );
  });

  // get today's anniversaries
  const todayAnniversaries = anniversaries.filter(
    (anniversary) =>
      new Date(anniversary.tenth_anniversary_date)
        .toISOString()
        .split("T")[0] === new Date().toISOString().split("T")[0]
  );

  // only return ones that are 10 years old or less
  const upcomingAnniversaries = anniversaries.filter(
    (anniversary) =>
      new Date(anniversary.tenth_anniversary_date).getTime() >=
      new Date().getTime()
  );

  // return 5 anniversaries
  upcomingAnniversaries.splice(5);

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
    <div
      style={{
        fontFamily: "Montserrat, system-ui, sans-serif",
        lineHeight: "1.4",
        fontVariationSettings: "'wght' 400",
        maxWidth: "900px",
        margin: "0 auto",
        padding: "0 1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: data.anniversaries.today.length > 0 ? "0" : "2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <h1
            style={{
              fontVariationSettings: "'wght' 500",
              textTransform: "uppercase",
            }}
          >
            Tardy Critic
          </h1>
          <p className="tagline">Movie Reviews One Decade Later</p>
        </div>
        <a href="/about" style={{ fontVariationSettings: "'wght' 500" }}>
          ABOUT
        </a>
      </div>

      {data.anniversaries.today.length > 0 && (
        <>
          <hr style={{ opacity: 0.2, marginBottom: "2rem" }} />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gridGap: "1rem",
              margin: "1rem 0 3rem 0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              <h2
                style={{
                  fontVariationSettings: "'wght' 500",
                  textTransform: "uppercase",
                  fontSize: "1.8rem",
                }}
              >
                Happy 10<sup style={{ textTransform: "lowercase" }}>th</sup>{" "}
                Anniversary!
              </h2>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                gap: "1rem",
              }}
            >
              {data.anniversaries.today.map((film) => (
                <motion.div
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 1.02 }}
                  initial={{ opacity: 0, scale: 0.2 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  key={film.link}
                  style={{
                    minWidth: "25%",
                    maxWidth: "320px",
                  }}
                >
                  <a href={film.link} style={{ lineHeight: 0 }}>
                    <img
                      src={film.image_url}
                      alt={film.title}
                      style={{
                        width: "100%",
                        borderRadius: "0.4rem",
                        display: "block",
                        border: "1px solid rgba(256,256,256,0.2)",
                        boxShadow: "0 2px 8px 0 rgba(0,0,0,0.4)",
                      }}
                    />
                  </a>
                  <p style={{ fontSize: "0.8rem" }}>
                    {film.title} ({film.release_date.split("-")[0]})
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}

      <b
        style={{
          textTransform: "uppercase",
          fontVariationSettings: "'wght' 500",
        }}
      >
        Upcoming 10<sup style={{ textTransform: "lowercase" }}>th</sup>{" "}
        Anniversaries
      </b>

      <hr style={{ opacity: "0.2" }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gridGap: "1rem",
          margin: "1rem 0 3rem 0",
        }}
      >
        {data.anniversaries.upcoming.map((film) => (
          <motion.div
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 1.02 }}
            initial={{ opacity: 0, scale: 0.2 }}
            whileInView={{ opacity: 1, scale: 1 }}
            key={film.link}
            style={{
              width: "100%",
            }}
          >
            <a href={film.link} style={{ lineHeight: 0 }}>
              <img
                src={film.image_url}
                alt={film.title}
                style={{
                  width: "100%",
                  borderRadius: "0.4rem",
                  display: "block",
                  border: "1px solid rgba(256,256,256,0.2)",
                  boxShadow: "0 2px 8px 0 rgba(0,0,0,0.4)",
                }}
              />
            </a>
            <p style={{ fontSize: "0.8rem" }}>
              {/* formatted anniversary date */}
              10 years old on{" "}
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

      {/*<hr style={{ opacity: 0.2, marginBottom: "2rem" }} />*/}

      <b
        style={{
          textTransform: "uppercase",
          fontVariationSettings: "'wght' 500",
        }}
      >
        Latest Review
      </b>

      <hr style={{ opacity: "0.2", marginBottom: "2rem" }} />

      <div
        className="firstReview"
        style={{
          gap: "2rem",
          justifyContent: "space-between",
          marginBottom: "3rem",
        }}
      >
        <motion.div
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 1.02 }}
          initial={{ opacity: 0, scale: 0.2 }}
          whileInView={{ opacity: 1, scale: 1 }}
          key={firstFilm.link}
          style={{
            width: "300px",
            flexShrink: 0,
            flexGrow: 0,
          }}
        >
          <a href={firstFilm.link} style={{ lineHeight: 0 }}>
            <img
              src={firstFilm.image_url}
              alt={firstFilm.title}
              style={{
                width: "100%",
                borderRadius: "0.4rem",
                display: "block",
                border: "1px solid rgba(256,256,256,0.2)",
                boxShadow: "0 2px 8px 0 rgba(0,0,0,0.4)",
              }}
            />
          </a>
        </motion.div>

        <div>
          <h2 style={{ margin: 0 }}>
            {firstFilm.title} ({firstFilm.year})
          </h2>

          <small>Reviewed on {firstFilmDate}, one decade after release</small>

          <div
            dangerouslySetInnerHTML={{ __html: firstFilm.review }}
            className="fade"
          />

          <a
            href={firstFilm.link}
            style={{
              display: "block",
              marginTop: "1rem",
              fontSize: "0.8rem",
              fontVariationSettings: "'wght' 500",
            }}
          >
            READ MORE
          </a>
        </div>
      </div>

      <b
        style={{
          textTransform: "uppercase",
          fontVariationSettings: "'wght' 500",
        }}
      >
        Previous Reviews
      </b>

      <hr style={{ opacity: "0.2" }} />

      <motion.div
        layout
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gridGap: "1rem",
          margin: "1rem 0",
        }}
      >
        {films.map((film) => (
          <motion.div
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 1.02 }}
            initial={{ opacity: 0, scale: 0.2 }}
            whileInView={{ opacity: 1, scale: 1 }}
            // animate={{rotate: [0, 0, -2, -2, 0]}}
            key={film.link}
            style={{
              width: "100%",
            }}
          >
            <a href={film.link} style={{ lineHeight: 0 }}>
              <img
                src={film.image_url}
                alt={film.title}
                style={{
                  width: "100%",
                  borderRadius: "0.4rem",
                  display: "block",
                  border: "1px solid rgba(256,256,256,0.2)",
                  boxShadow: "0 2px 8px 0 rgba(0,0,0,0.4)",
                }}
              />
            </a>
            {/*<p style={{ fontSize: "0.8rem",  }}>*/}
            {/*  {film.title} ({film.year})*/}
            {/*</p>*/}
          </motion.div>
        ))}
      </motion.div>
      <p>
        <small>{data.films.length} films reviewed</small>
      </p>
    </div>
  );
}
