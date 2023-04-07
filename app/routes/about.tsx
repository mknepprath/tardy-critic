import React from "react";
import type {V2_MetaFunction, LinksFunction} from "@remix-run/node";

import indexStyles from "../styles/index.css";

export const meta: V2_MetaFunction = () => {
  return [{title: "About Tardy Critic"}];
};

export const links: LinksFunction = () => {
  return [
    {rel: 'stylesheet', href: indexStyles},
  ]
}

export default function About() {
  return (
    <div
      style={{
        fontFamily: "Montserrat, system-ui, sans-serif",
        lineHeight: "1.4",
        fontVariationSettings: "'wght' 400",
        maxWidth: "900px",
        margin: "0 auto",
        padding: "0 1rem"
      }}
    >
      <a href="/" style={{color: "#fff", textDecoration: "none"}}><h1 style={{fontVariationSettings: "'wght' 500", textTransform: "uppercase"}}>Tardy Critic</h1></a>

      <h2>About</h2>

      <p>
        We believe that reviewing movies ten years after their release provides a unique perspective on the film, as it's removed from the initial hype and promotion surrounding its debut. By giving each film time to simmer and re-watching it with a fresh set of eyes, we can more accurately assess its impact and relevance.
      </p>
      <p>
        We're always looking for ways to improve our reviews and expand our coverage. We're open to feedback and suggestions on how we can better serve our readers and provide a more insightful and engaging analysis of each film.
      </p>

      <h3>How it began...</h3>

      <img alt="Twitter conversation where the idea began" src="/Tardy-Critic-Humble-Beginnings.png" />
    </div>
  );
}