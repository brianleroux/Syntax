const { promisify } = require('util');
const { readFile } = require('fs');
const { join } = require('path');

const glob = promisify(require('glob'));
const marked = require('meta-marked');
const spacetime = require('spacetime');

const readAFile = promisify(readFile);
const pad = num => `000${num}`.substr(-3);

const renderer = new marked.Renderer();
renderer.link = function(href, title, text) {
  return `<a rel="noopener noreferrer" target="_blank" href="${href}"> ${text}</a>`;
};

// deliberate let!
let cache = false;

async function loadShows() {
  if (cache === false) {
    const files = await glob(join(__dirname, 'shows', '*.md'));
    const markdownPromises = files.map(file => readAFile(file, 'utf-8'));
    const showMarkdown = await Promise.all(markdownPromises);

    cache = showMarkdown
      .map(md => marked(md, { renderer }))
      .map((show, i) => {
        const { number } = show.meta;
        return {
          ...show.meta,
          html: show.html,
          notesFile: files[i].replace(__dirname, join('src', 'shared')),
          displayDate: spacetime(show.meta.date).format(
            '{month-short} {date-ordinal}, {year}'
          ),
          number,
        };
      }) // flatten
      .map(show => ({ ...show, displayNumber: pad(show.number) })) // pad zeros
      .reverse();
  }
  return cache;
}

async function getShows() {
  const shows = await loadShows();
  const now = Date.now();
  return shows.filter(show => show.date < now);
}

async function getShow(number) {
  const shows = await loadShows();
  let show = shows.find(showItem => showItem.displayNumber === Number(number));
  if (!show) show = shows.find(showItem => showItem.number === Number(number));
  return show;
}

async function getSickPicks() {
  // Since the sick picks parsed markdown id is not consistent,
  // this RegEx finds the first <h2> tag with an id that contains
  // the sequential characters "icks" from "picks" and selects
  // characters from the string up until the next <h2> tag
  // i.e. the next section (usually Shameless Plugs)
  const sickPickRegex = /(<h2 id=".*(icks).*">*[\s\S]*?(?=<h2))/g;
  const headerRegex = /[\s\S]*(?=<\/h2)/; // finds all characters up until the first closing </h2>

  return (await getShows()).reduce((sickPicksAcc, show) => {
    const episode = `<h2>Episode Number: ${show.number} - Sick Picks`;
    const sickPickMatch = show.html.match(sickPickRegex);

    if (sickPickMatch) {
      const html = sickPickMatch[0].replace(headerRegex, episode);
      const sickPick = {
        id: show.number,
        html,
      };

      return sickPicksAcc.concat(sickPick);
    }

    return sickPicksAcc;
  }, []);
}

async function getShowsSparse(number) {
  const shows = await getShows();
  // show last show first
  let show = shows.slice(0).shift();
  if (number) {
    // unless we have another show
    show = shows.find(s => s.number === Number(number)) || show;
  }
  // remove the html prop from all other shows; we can fetch that later
  const sparse = [];
  let fewback = show.number - 3;
  if (fewback < 0) fewback = 0;
  for (const s of shows) {
    if (s.number >= fewback) {
      sparse.push(s);
    } else {
      const copy = { ...s };
      delete copy.html;
      sparse.push(copy);
    }
  }
  return { shows: sparse, show };
}

module.exports = { getShow, getShows, getShowsSparse, getSickPicks };
