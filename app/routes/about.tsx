import React from "react";
import type { V2_MetaFunction, LinksFunction } from "@remix-run/node";

import indexStyles from "../styles/index.css";

export const meta: V2_MetaFunction = () => {
  return [{ title: "About Tardy Critic" }];
};

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: indexStyles }];
};

export default function About() {
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

      <h3 className="sectionHeading">About</h3>
      <div className="divider" />

      <p>
        We believe that reviewing movies ten years after their release provides
        a unique perspective on the film, as it's removed from the initial hype
        and promotion surrounding its debut. By giving each film time to simmer
        and re-watching it with a fresh set of eyes, we can more accurately
        assess its impact and relevance.
      </p>
      <p>
        We're always looking for ways to improve our reviews and expand our
        coverage. We're open to feedback and suggestions on how we can better
        serve our readers and provide a more insightful and engaging analysis of
        each film.
      </p>

      <h3 className="sectionHeading">How it began...</h3>
      <div className="divider" />

      <img
        alt="Twitter conversation where the idea began"
        src="/Tardy-Critic-Humble-Beginnings.png"
        style={{ maxWidth: "100%", borderRadius: "0.25rem", opacity: 0.9 }}
      />

      <footer className="footer">
        <div className="divider" />
        <p className="footerText">
          Tardy Critic &middot; Movie Reviews One Decade Later
        </p>
      </footer>
    </div>
  );
}
