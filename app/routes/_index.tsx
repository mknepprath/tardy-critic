import type {V2_MetaFunction, LinksFunction} from "@remix-run/node";
import {json} from "@remix-run/node";
import {useLoaderData} from "@remix-run/react";
import {motion} from "framer-motion"


import xml2js from "xml2js";

import indexStyles from "../styles/index.css";

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

export const meta: V2_MetaFunction = () => {
    return [{title: "Tardy Critic"}];
};

export const links: LinksFunction = () => {
    return [
        {rel: 'stylesheet', href: indexStyles},
    ]
}

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

    return json({ok: true, films});
};

export default function Index() {
    const data = useLoaderData<typeof loader>();
    const [firstFilm, ...films] = data.films;
    // sort films by date
    films.sort((a, b) => {
        return new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime();
    });
    return (
        <div style={{
            fontFamily: "Montserrat, system-ui, sans-serif",
            lineHeight: "1.4",
            fontVariationSettings: "'wght' 400",
            maxWidth: "900px",
            margin: "0 auto",
            padding: "0 1rem"
        }}>
            <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
            <div style={{display: "flex", alignItems: "center", gap: "1rem"}}>
            <h1 style={{fontVariationSettings: "'wght' 500", textTransform: "uppercase"}}>Tardy Critic</h1>
                <p>Movie Reviews One Decade Later
                </p>
            </div>
                <a href="/about" style={{fontVariationSettings: "'wght' 500"}}>ABOUT</a>
            </div>

            <hr style={{opacity: 0.2, marginBottom: "2rem"}}/>

            <div style={{display: "flex", gap: "2rem", justifyContent: "space-between", marginBottom: "4rem"}}>

            <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 1.02 }}
                initial={{ opacity: 0, scale: 0.2 }}
                whileInView={{ opacity: 1, scale: 1 }}
                key={firstFilm.link}
                style={{
                  width: "300px",
                    flexShrink: 0,
                    flexGrow: 0
                }}
            >
              <a href={firstFilm.link} style={{lineHeight: 0}}>
                <img
                    src={firstFilm.image_url}
                    alt={firstFilm.title}
                    style={{ width: "100%", borderRadius: "0.4rem", display: "block", border: "1px solid rgba(256,256,256,0.2)",  boxShadow: "0 2px 8px 0 rgba(0,0,0,0.4)" }}
                />
              </a>
            </motion.div>

                <div>
                <h2 style={{margin: 0}}>{firstFilm.title} ({firstFilm.year})</h2>

            <div dangerouslySetInnerHTML={{__html: firstFilm.review}} className="fade" />

                    <a href={firstFilm.link} style={{display: "block", marginTop: "1rem", fontSize: "0.8rem", fontVariationSettings: "'wght' 500"}}>READ MORE</a>
                </div>
            </div>

            <b style={{textTransform: "uppercase", fontVariationSettings: "'wght' 500"}}>Previous Reviews</b>

            <hr style={{opacity: "0.2"}} />

            <motion.div layout style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gridGap: "1rem",
                margin: "1rem 0"
            }}>
                {films.map((film) => (
                    <motion.div
                        whileHover={{scale: 1.04}}
                        whileTap={{scale: 1.02}}
                        initial={{opacity: 0, scale: 0.2}}
                        whileInView={{opacity: 1, scale: 1}}
                        // animate={{rotate: [0, 0, -2, -2, 0]}}
                        key={film.link}
                        style={{
                            width: "100%",
                        }}
                    >
                        <a href={film.link} style={{lineHeight: 0}}>
                            <img
                                src={film.image_url}
                                alt={film.title}
                                style={{
                                    width: "100%",
                                    borderRadius: "0.4rem",
                                    display: "block",
                                    border: "1px solid rgba(256,256,256,0.2)",
                                    boxShadow: "0 2px 8px 0 rgba(0,0,0,0.4)"
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
            <small>
                {data.films.length} films reviewed
            </small>
            </p>
        </div>
    );
}
