import type { V2_MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import xml2js from "xml2js";

const LETTERBOXD_RSS = `https://letterboxd.com/tardycritic/rss/`;

interface Film {
  image_url: string;
  link: string;
  published_at: string;
  rating: string;
  review: string;
  rewatched: boolean;
  title: string;
  year: string;
}

export const meta: V2_MetaFunction = () => {
  return [{ title: "New Remix App" }];
};

export const loader = async () => {
  const films: Film[] = [];
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
              // published_at: filmList[i]["letterboxd:watchedDate"]?.[0],
              published_at: filmList[i].pubDate[0],
              rating: filmList[i]["letterboxd:memberRating"]?.[0],
              review: review.join(`</p>`),
              rewatched: filmList[i]["letterboxd:rewatch"]?.[0] === "Yes",
              title: filmList[i]["letterboxd:filmTitle"]?.[0],
              year: filmList[i]["letterboxd:filmYear"]?.[0],
            });
          }
        });
      })
      .catch((error) => console.error(error));

  return json({ ok: true, films });
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.4" }}>
      <h1>Tardy Critic</h1>
      {/* full-width poster grid that displays the name and year on hover */}
        <div style={{ display: "flex", flexWrap: "wrap" }}>
            {data.films.map((film) => (
                <div
                    key={film.link}
                    style={{
                        width: "100%",
                        maxWidth: "300px",
                        margin: "0 1rem 1rem 0",
                    }}
                >
                    <a href={film.link}>
                        <img
                            src={film.image_url}
                            alt={film.title}
                            style={{ width: "100%" }}
                        />
                    </a>
                    <div style={{ textAlign: "center" }}>
                      {film.title} ({film.year})
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
}
