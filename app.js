const dateInput = document.getElementById('date-input');
const goBtn = document.getElementById('go-btn');
const chartSection = document.getElementById('chart-section');
const chartTitle = document.getElementById('chart-title');
const chartSubtitle = document.getElementById('chart-subtitle');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error-msg');
const songList = document.getElementById('song-list');

const CHART_START = new Date('1958-08-04');

const today = new Date();
const todayStr = today.toISOString().slice(0, 10);
dateInput.setAttribute('max', todayStr);
dateInput.value = '1984-06-15';

goBtn.addEventListener('click', handleSubmit);
dateInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleSubmit(); });

// Clicking an artist name opens their full Top 100 history
songList.addEventListener('click', e => {
  const link = e.target.closest('.artist-link');
  if (link) openArtist(link.dataset.artist);
});

// Allow deep-linking to a specific week's countdown via ?date=YYYY-MM-DD
const presetDate = new URLSearchParams(location.search).get('date');
if (presetDate && /^\d{4}-\d{2}-\d{2}$/.test(presetDate)) {
  dateInput.value = presetDate;
  loadChart(new Date(presetDate + 'T12:00:00'));
}

function handleSubmit() {
  const raw = dateInput.value;
  if (!raw) { showError('Please pick a date first.'); return; }

  const chosen = new Date(raw + 'T12:00:00');
  if (chosen < CHART_START) {
    showError('Top 100 charts begin on August 4, 1958. Please pick a later date.');
    return;
  }
  if (chosen > today) {
    showError('Please pick a date that is not in the future.');
    return;
  }

  const chartDate = nearestChartSaturday(chosen);
  loadChart(chartDate);
}

function nearestChartSaturday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const offset = day === 6 ? 0 : day + 1;
  d.setDate(d.getDate() - offset);
  if (d < CHART_START) return new Date(CHART_START);
  return d;
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

async function loadChart(date) {
  const iso = toISO(date);

  chartSection.classList.remove('hidden');
  setLoading(true);
  hideError();
  songList.innerHTML = '';

  chartTitle.textContent = 'Week of ' + formatDisplay(date);
  chartSubtitle.textContent = 'The complete Top 100';

  try {
    const data = await fetchChartData(iso);
    const sorted = [...data].sort((a, b) => (a.this_week || 999) - (b.this_week || 999));
    renderSongs(sorted.slice(0, 100));
  } catch (err) {
    showError(err.message || 'Could not load chart data. Try a different date.');
  } finally {
    setLoading(false);
  }
}

async function fetchChartData(iso) {
  const base = 'https://raw.githubusercontent.com/mwolverine2000/billboard-hot-100/main/date';
  const attempts = [iso, nextSaturday(iso), prevSaturday(iso)];

  for (const dateStr of attempts) {
    try {
      const res = await fetch(`${base}/${dateStr}.json`);
      if (res.ok) {
        const json = await res.json();
        const songs = Array.isArray(json) ? json : json.data;
        if (Array.isArray(songs) && songs.length > 0) return songs;
      }
    } catch (_) {}
  }

  throw new Error(
    'No chart data found for this date. The dataset may not cover this week. Try a nearby date.'
  );
}

function nextSaturday(iso) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + 7);
  return toISO(d);
}

function prevSaturday(iso) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() - 7);
  return toISO(d);
}

function renderSongs(songs) {
  songList.innerHTML = '';
  let dividerInserted = false;
  songs.forEach((song, i) => {
    const rank = song.this_week || (i + 1);
    const title = song.song || song.title || 'Unknown Title';
    const artist = song.artist || 'Unknown Artist';
    const weeksOnChart = song.weeks_on_chart;
    const peakPosition = song.peak_position;

    // Divider marking the end of the Top 40, before position 41
    if (!dividerInserted && rank > 40) {
      songList.appendChild(makeChartDivider());
      dividerInserted = true;
    }

    const li = document.createElement('li');
    li.className = 'song-item';
    li.style.setProperty('--i', Math.min(i, 20)); // cap the stagger for long lists

    const rankEl = `<div class="song-rank">#${rank}</div>`;
    const placeholder = `<div class="song-album-art-placeholder">${rankEmoji(rank)}</div>`;

    const peakStr   = peakPosition ? `Peak: #${peakPosition}` : '';
    const peakClass = peakPosition === 1 || peakPosition === '1' ? 'peak-1' : '';
    const lastWeek  = song.last_week;
    let moveBadgeHtml;
    if (lastWeek == null) {
      moveBadgeHtml = '<span class="move-badge move-new">NEW</span>';
    } else {
      const delta = lastWeek - (song.this_week || (i + 1));
      if (delta > 0) {
        moveBadgeHtml = `<span class="move-badge move-up">▲${delta}</span>`;
      } else if (delta < 0) {
        moveBadgeHtml = `<span class="move-badge move-down">▼${Math.abs(delta)}</span>`;
      } else {
        moveBadgeHtml = '<span class="move-badge move-same">&#8212;</span>';
      }
    }
    const weeksStr = weeksOnChart ? `${weeksOnChart} wk${weeksOnChart !== 1 ? 's' : ''}` : '';
    const query = `${title} ${artist}`;
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
    const wikiUrl = `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`;

    li.innerHTML = `
      ${rankEl}
      ${placeholder}
      <div class="song-info">
        <div class="song-title">${escHtml(title)}</div>
        <button class="song-artist artist-link" data-artist="${escHtml(artist)}" title="See all Top 100 hits by ${escHtml(artist)}">${escHtml(artist)}</button>
      </div>
      <div class="song-movement">
        ${moveBadgeHtml}
        ${weeksStr ? `<span class="move-weeks">${weeksStr}</span>` : ''}
      </div>
      <div class="song-meta">
        ${peakStr ? `<span class="song-peak ${peakClass}">${escHtml(peakStr)}</span>` : ''}
      </div>
      <div class="song-links">
        <a class="icon-btn spotify-btn" href="${spotifyUrl}" target="_blank" rel="noopener noreferrer" title="Find on Spotify">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.82-1.72-6.36-2.11-10.54-1.16a.75.75 0 1 1-.33-1.46c4.57-1.04 8.5-.59 11.65 1.34.36.22.47.69.25 1.03zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.98-8.15-2.56-11.97-1.4a.94.94 0 1 1-.55-1.8c4.37-1.33 9.79-.68 13.5 1.6.44.27.58.85.31 1.29zm.13-3.4C15.74 8.3 8.9 8.08 5.02 9.26a1.12 1.12 0 1 1-.65-2.15C8.83 5.76 16.38 6.02 20.6 8.5a1.12 1.12 0 1 1-1.14 1.93z"/>
          </svg>
        </a>
        <a class="icon-btn yt-btn" href="${ytUrl}" target="_blank" rel="noopener noreferrer" title="Watch on YouTube">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
          </svg>
        </a>
        <a class="icon-btn wiki-btn" href="${wikiUrl}" target="_blank" rel="noopener noreferrer" title="Read on Wikipedia">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M5.1 5.3h4.2v.8c-.5 0-.9.1-1.1.2-.2.1-.3.3-.3.5 0 .2.1.5.3.9l2.4 5.2 1.6-3.6-.6-1.4c-.3-.6-.5-1-.7-1.2-.2-.2-.5-.3-1-.4v-.8h4.6v.8c-.5 0-.8.1-1 .2-.1.1-.2.3-.2.5 0 .1 0 .3.1.4l.1.4 2.3 5 2.2-5c.1-.3.2-.6.2-.8 0-.3-.1-.5-.3-.6-.2-.1-.5-.2-1-.2v-.8h3.6v.8c-.4 0-.7.2-.9.4-.2.2-.5.7-.8 1.4l-3.8 8.6h-.8L11 9.9l-3.1 6.9H7L3.3 8.1c-.3-.7-.6-1.2-.8-1.4-.2-.2-.5-.3-.9-.4v-.8h3.5z"/>
          </svg>
        </a>
      </div>
    `;

    songList.appendChild(li);
  });
}

// Divider separating the Top 40 from the rest of the Top 100 (#41–#100)
function makeChartDivider() {
  const li = document.createElement('li');
  li.className = 'chart-divider';
  li.setAttribute('aria-hidden', 'true');
  li.innerHTML = `
    <span class="chart-divider-line"></span>
    <span class="chart-divider-label">
      <span class="chart-divider-top">★ The Top 40 ★</span>
      <span class="chart-divider-sub">#41–#100 of the Top 100 below</span>
    </span>
    <span class="chart-divider-line"></span>`;
  return li;
}

function rankEmoji(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '🎵';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setLoading(on) {
  loadingEl.classList.toggle('hidden', !on);
}

function showError(msg) {
  chartSection.classList.remove('hidden');
  errorEl.textContent = msg;
  errorEl.classList.remove('hidden');
}

function hideError() {
  errorEl.classList.add('hidden');
  errorEl.textContent = '';
}

/* Artist history — every Top 100 appearance across all charts */

const ALL_CHARTS_URL = 'https://raw.githubusercontent.com/mwolverine2000/billboard-hot-100/main/all.json';
let allChartsCache = null;
let allChartsPromise = null;

function loadAllCharts() {
  if (allChartsCache) return Promise.resolve(allChartsCache);
  if (allChartsPromise) return allChartsPromise;
  allChartsPromise = fetch(ALL_CHARTS_URL)
    .then(r => {
      if (!r.ok) throw new Error('Could not load the full chart history.');
      return r.json();
    })
    .then(data => { allChartsCache = data; return data; })
    .catch(err => { allChartsPromise = null; throw err; });
  return allChartsPromise;
}

function getArtistAppearances(charts, artist) {
  const map = new Map();
  for (const chart of charts) {
    if (!chart || !Array.isArray(chart.data)) continue;
    for (const e of chart.data) {
      if (e.artist === artist && e.this_week && e.this_week <= 100) {
        let g = map.get(e.song);
        if (!g) { g = { song: e.song, peak: e.this_week, top40Weeks: 0, weeks: [] }; map.set(e.song, g); }
        g.weeks.push({ date: chart.date, position: e.this_week });
        if (e.this_week < g.peak) g.peak = e.this_week;
        if (e.this_week <= 40) g.top40Weeks++;
      }
    }
  }
  const groups = [...map.values()];
  groups.forEach(g => g.weeks.sort((a, b) => (a.date < b.date ? -1 : 1)));
  // Order songs by when they first appeared on the charts (earliest first)
  groups.sort((a, b) => (a.weeks[0].date < b.weeks[0].date ? -1 : 1));
  return groups;
}

function formatShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

/* Album lookups via the iTunes Search API (free, no key, CORS-enabled) */

const albumCache = new Map();

function albumQueryArtist(artist) {
  const cleaned = String(artist || '').replace(/\s+(featuring|feat\.?|ft\.?|with)\s+.*/i, '').trim();
  return cleaned || String(artist || '');
}

function lookupAlbum(song, artist) {
  const key = song + '|' + artist;
  if (albumCache.has(key)) return albumCache.get(key);
  const term = encodeURIComponent(`${albumQueryArtist(artist)} ${song}`);
  const url = `https://itunes.apple.com/search?media=music&entity=song&limit=15&term=${term}`;
  const p = fetch(url)
    .then(r => (r.ok ? r.json() : null))
    .then(json => {
      if (!json || !Array.isArray(json.results)) return null;
      const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const target = norm(song);
      const withAlbum = json.results.filter(r => r.collectionName);
      const pick =
        withAlbum.find(r => norm(r.trackName) === target) ||
        withAlbum.find(r => norm(r.trackName).includes(target) || target.includes(norm(r.trackName))) ||
        withAlbum[0];
      return pick ? { album: pick.collectionName } : null;
    })
    .catch(() => null);
  albumCache.set(key, p);
  return p;
}

// Fills in each song's album name + Discogs/Spotify links once iTunes responds
function hydrateAlbums(scope) {
  if (!scope) return;
  scope.querySelectorAll('.ah-album[data-pending="1"]').forEach(el => {
    el.removeAttribute('data-pending');
    lookupAlbum(el.dataset.song, el.dataset.artist)
      .then(info => fillAlbum(el, info, el.dataset.artist));
  });
}

function fillAlbum(el, info, artist) {
  const nameEl = el.querySelector('.ah-album-name');
  const linksEl = el.querySelector('.ah-album-links');
  if (!nameEl || !linksEl) return;
  if (info && info.album) {
    nameEl.textContent = info.album;
    nameEl.classList.remove('ah-album-unknown');
    const q = encodeURIComponent(`${info.album} ${albumQueryArtist(artist)}`);
    linksEl.innerHTML =
      `<a class="ah-album-link" href="https://open.spotify.com/search/${q}" target="_blank" rel="noopener noreferrer">Spotify</a>` +
      `<a class="ah-album-link" href="https://www.discogs.com/search/?q=${q}&type=release" target="_blank" rel="noopener noreferrer">Discogs</a>`;
  } else {
    nameEl.textContent = 'not found';
    nameEl.classList.add('ah-album-unknown');
    linksEl.innerHTML = '';
  }
}

/* Artist thumbnail — TheAudioDB has real artist portraits; fall back to iTunes
   artwork, and finally to a letter avatar so the slot is never broken/empty. */

const artistImageCache = new Map();

function lookupArtistImage(artist) {
  if (artistImageCache.has(artist)) return artistImageCache.get(artist);
  const name = albumQueryArtist(artist);
  const p = (async () => {
    try {
      const r = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(name)}`);
      if (r.ok) {
        const j = await r.json();
        const a = j && j.artists && j.artists[0];
        if (a && a.strArtistThumb) return a.strArtistThumb + '/preview';
      }
    } catch (_) {}
    try {
      const r = await fetch(`https://itunes.apple.com/search?media=music&entity=album&limit=1&term=${encodeURIComponent(name)}`);
      if (r.ok) {
        const j = await r.json();
        const res = j && Array.isArray(j.results) && j.results[0];
        if (res && res.artworkUrl100) return res.artworkUrl100.replace('100x100', '300x300');
      }
    } catch (_) {}
    return null;
  })();
  artistImageCache.set(artist, p);
  return p;
}

// Swaps the letter avatar for a real image once one is found (keeps avatar on failure)
function hydrateArtistImage(scope) {
  if (!scope) return;
  const el = scope.querySelector('.ah-artist-thumb[data-pending="1"]');
  if (!el) return;
  el.removeAttribute('data-pending');
  lookupArtistImage(el.dataset.artist).then(src => {
    if (!src) return;
    const img = el.ownerDocument.createElement('img');
    img.className = 'ah-thumb-img';
    img.alt = el.dataset.artist;
    img.referrerPolicy = 'no-referrer';
    img.onload = () => { el.innerHTML = ''; el.appendChild(img); };
    img.src = src;
  });
}

function buildArtistInnerHTML(artist, groups, baseUrl) {
  if (!groups.length) {
    return `<div class="ah-empty">No Top 100 hits found for <strong>${escHtml(artist)}</strong>.</div>`;
  }
  const totalWeeks = groups.reduce((n, g) => n + g.weeks.length, 0);
  const songCount = groups.length;

  const rows = groups.map(g => {
    const weeks = g.weeks.map(w =>
      `<a class="ah-week" data-date="${w.date}" href="${baseUrl}?date=${w.date}"` +
      ` onclick="if(window.opener&&!window.opener.closed){window.opener.location.href=this.href;window.opener.focus();return false;}">` +
      `${formatShort(w.date)} &middot; #${w.position}</a>`
    ).join('');
    const q = encodeURIComponent(`${g.song} ${artist}`);
    const top40Str = g.top40Weeks ? ` · ${g.top40Weeks} in Top 40` : '';
    return `
      <li class="ah-song">
        <div class="ah-song-head">
          <span class="ah-song-title">${escHtml(g.song)}</span>
          <span class="ah-song-peak">peak #${g.peak}</span>
        </div>
        <div class="ah-song-stats">${g.weeks.length} wk${g.weeks.length !== 1 ? 's' : ''} on Top 100${top40Str}</div>
        <div class="ah-album" data-song="${escHtml(g.song)}" data-artist="${escHtml(artist)}" data-pending="1">
          <span class="ah-album-tag">Album</span>
          <span class="ah-album-name">Looking up…</span>
          <span class="ah-album-links"></span>
        </div>
        <div class="ah-song-links">
          <a class="ah-icon-btn ah-spotify" href="https://open.spotify.com/search/${q}" target="_blank" rel="noopener noreferrer" title="Find on Spotify"><svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.82-1.72-6.36-2.11-10.54-1.16a.75.75 0 1 1-.33-1.46c4.57-1.04 8.5-.59 11.65 1.34.36.22.47.69.25 1.03zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.98-8.15-2.56-11.97-1.4a.94.94 0 1 1-.55-1.8c4.37-1.33 9.79-.68 13.5 1.6.44.27.58.85.31 1.29zm.13-3.4C15.74 8.3 8.9 8.08 5.02 9.26a1.12 1.12 0 1 1-.65-2.15C8.83 5.76 16.38 6.02 20.6 8.5a1.12 1.12 0 1 1-1.14 1.93z"/></svg></a>
          <a class="ah-icon-btn ah-yt" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener noreferrer" title="Watch on YouTube"><svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg></a>
          <a class="ah-icon-btn ah-wiki" href="https://en.wikipedia.org/w/index.php?search=${q}" target="_blank" rel="noopener noreferrer" title="Read on Wikipedia"><svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M5.1 5.3h4.2v.8c-.5 0-.9.1-1.1.2-.2.1-.3.3-.3.5 0 .2.1.5.3.9l2.4 5.2 1.6-3.6-.6-1.4c-.3-.6-.5-1-.7-1.2-.2-.2-.5-.3-1-.4v-.8h4.6v.8c-.5 0-.8.1-1 .2-.1.1-.2.3-.2.5 0 .1 0 .3.1.4l.1.4 2.3 5 2.2-5c.1-.3.2-.6.2-.8 0-.3-.1-.5-.3-.6-.2-.1-.5-.2-1-.2v-.8h3.6v.8c-.4 0-.7.2-.9.4-.2.2-.5.7-.8 1.4l-3.8 8.6h-.8L11 9.9l-3.1 6.9H7L3.3 8.1c-.3-.7-.6-1.2-.8-1.4-.2-.2-.5-.3-.9-.4v-.8h3.5z"/></svg></a>
        </div>
        <div class="ah-weeks">${weeks}</div>
      </li>`;
  }).join('');

  return `
    <div class="ah-header">
      <h1 class="ah-artist">${escHtml(artist)}</h1>
      <p class="ah-summary">${songCount} song${songCount !== 1 ? 's' : ''} on the Top 100 &middot; ${totalWeeks} weekly appearance${totalWeeks !== 1 ? 's' : ''}</p>
      <p class="ah-hint">Click any week to open that Top 100 countdown.</p>
    </div>
    <div class="ah-bio-section">
      <div class="ah-artist-thumb" data-artist="${escHtml(artist)}" data-pending="1">
        <span class="ah-thumb-fallback">${escHtml((artist.trim()[0] || '?').toUpperCase())}</span>
      </div>
      <a class="ah-allmusic-btn" href="https://www.allmusic.com/search/artists/${encodeURIComponent(albumQueryArtist(artist))}" target="_blank" rel="noopener noreferrer">View ${escHtml(artist)} on AllMusic →</a>
    </div>
    <ul class="ah-list">${rows}</ul>`;
}

const ARTIST_DOC_STYLES = `
  :root { --bg:#0d0d14; --surface:#16161f; --surface2:#1e1e2a; --accent2:#c084fc; --gold:#f5c842; --text:#f0f0f5; --muted:#8888aa; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Inter',system-ui,sans-serif; background:var(--bg); color:var(--text); padding:1.5rem; }
  .ah-header { text-align:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:1.2rem; }
  .ah-artist { font-size:1.6rem; font-weight:700; background:linear-gradient(135deg,#fff 30%,var(--accent2)); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
  .ah-summary { color:var(--accent2); font-size:.85rem; margin-top:.4rem; font-weight:600; }
  .ah-hint { color:var(--muted); font-size:.75rem; margin-top:.3rem; }
  .ah-list { list-style:none; display:flex; flex-direction:column; gap:.6rem; }
  .ah-song { background:var(--surface); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:.85rem 1rem; }
  .ah-song-head { display:flex; align-items:baseline; justify-content:space-between; gap:.75rem; margin-bottom:.55rem; }
  .ah-song-title { font-weight:600; font-size:.98rem; }
  .ah-song-peak { color:var(--gold); font-size:.75rem; font-weight:600; white-space:nowrap; }
  .ah-weeks { display:flex; flex-wrap:wrap; gap:.35rem; }
  .ah-week { font-size:.74rem; color:var(--muted); text-decoration:none; background:var(--surface2); border:1px solid rgba(255,255,255,0.07); border-radius:999px; padding:.25rem .6rem; transition:all .15s ease; white-space:nowrap; cursor:pointer; }
  .ah-week:hover { color:#fff; border-color:rgba(124,92,252,.5); background:rgba(124,92,252,.18); }
  .ah-empty { text-align:center; color:var(--muted); padding:3rem 1rem; }
  .ah-loading { text-align:center; color:var(--muted); padding:4rem 1rem; font-size:.95rem; line-height:1.7; }
  .ah-song-stats { font-size:.72rem; color:var(--muted); margin:.2rem 0 .35rem; }
  .ah-song-links { display:flex; gap:.15rem; margin-bottom:.4rem; }
  .ah-icon-btn { display:flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:6px; color:#888; text-decoration:none; background:transparent; transition:color .15s ease,background .15s ease; }
  .ah-spotify:hover { color:#1db954; background:rgba(29,185,84,.12); }
  .ah-yt:hover { color:#f00; background:rgba(255,0,0,.1); }
  .ah-wiki:hover { color:#fff; background:rgba(255,255,255,.12); }
  .ah-album { display:flex; align-items:center; flex-wrap:wrap; gap:.4rem; margin:.1rem 0 .45rem; font-size:.74rem; }
  .ah-album-tag { text-transform:uppercase; letter-spacing:.5px; font-size:.6rem; color:var(--muted); background:var(--surface2); border-radius:4px; padding:.1rem .35rem; }
  .ah-album-name { color:var(--text); font-weight:500; }
  .ah-album-name.ah-album-unknown { color:var(--muted); font-style:italic; font-weight:400; }
  .ah-album-links { display:inline-flex; gap:.3rem; }
  .ah-album-link { color:var(--accent2); text-decoration:none; border:1px solid rgba(192,132,252,.35); border-radius:999px; padding:.05rem .45rem; font-size:.68rem; transition:all .15s ease; }
  .ah-album-link:hover { background:rgba(192,132,252,.18); color:#fff; }
  .ah-bio-section { display:flex; align-items:center; gap:.9rem; margin-bottom:1.25rem; }
  .ah-artist-thumb { width:64px; height:64px; border-radius:50%; overflow:hidden; flex-shrink:0; background:var(--surface2); border:1px solid rgba(255,255,255,.1); display:flex; align-items:center; justify-content:center; }
  .ah-thumb-img { width:100%; height:100%; object-fit:cover; display:block; }
  .ah-thumb-fallback { font-size:1.7rem; font-weight:700; color:var(--accent2); }
  .ah-allmusic-btn { display:inline-block; font-size:.8rem; font-weight:600; color:var(--accent2); text-decoration:none; border:1px solid rgba(192,132,252,.35); border-radius:999px; padding:.35rem .85rem; transition:all .15s ease; }
  .ah-allmusic-btn:hover { background:rgba(192,132,252,.15); color:#fff; }
`;

function artistDoc(artist, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1.0">` +
    `<title>${escHtml(artist)} — Top 100 Appearances</title>` +
    `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">` +
    `<style>${ARTIST_DOC_STYLES}</style></head><body>${body}</body></html>`;
}

function openArtist(artist) {
  const baseUrl = location.origin + location.pathname;
  const popup = window.open('', '_blank', 'width=560,height=780,scrollbars=yes,resizable=yes');

  if (popup) {
    popup.document.write(artistDoc(artist,
      `<div class="ah-loading">Searching every Top 100 chart since 1958<br>for <strong>${escHtml(artist)}</strong>…</div>`));
    popup.document.close();
  }

  loadAllCharts()
    .then(charts => {
      const groups = getArtistAppearances(charts, artist);
      const inner = buildArtistInnerHTML(artist, groups, baseUrl);
      if (popup && !popup.closed) {
        popup.document.open();
        popup.document.write(artistDoc(artist, inner));
        popup.document.close();
        hydrateArtistImage(popup.document);
        hydrateAlbums(popup.document);
      } else {
        showArtistModal(artist, inner);
      }
    })
    .catch(err => {
      const msg = `<div class="ah-empty">${escHtml(err.message || 'Something went wrong.')}</div>`;
      if (popup && !popup.closed) {
        popup.document.open();
        popup.document.write(artistDoc(artist, msg));
        popup.document.close();
      } else {
        showArtistModal(artist, msg);
      }
    });
}

function showArtistModal(artist, innerHtml) {
  let overlay = document.getElementById('artist-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'artist-modal';
    overlay.className = 'artist-modal-overlay';
    overlay.innerHTML = `
      <div class="artist-modal">
        <button class="artist-modal-close" aria-label="Close">&times;</button>
        <div class="artist-modal-body"></div>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.classList.remove('open');
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.artist-modal-close').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    overlay.querySelector('.artist-modal-body').addEventListener('click', e => {
      const wk = e.target.closest('.ah-week');
      if (!wk) return;
      e.preventDefault();
      const d = wk.dataset.date;
      close();
      dateInput.value = d;
      loadChart(new Date(d + 'T12:00:00'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  overlay.querySelector('.artist-modal-body').innerHTML = innerHtml;
  overlay.classList.add('open');
  hydrateArtistImage(overlay.querySelector('.artist-modal-body'));
  hydrateAlbums(overlay.querySelector('.artist-modal-body'));
}
