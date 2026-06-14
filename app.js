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

function handleSubmit() {
  const raw = dateInput.value;
  if (!raw) { showError('Please pick a date first.'); return; }

  const chosen = new Date(raw + 'T12:00:00');
  if (chosen < CHART_START) {
    showError('Billboard Hot 100 charts begin on August 4, 1958. Please pick a later date.');
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
  chartSubtitle.textContent = 'Top 40 songs on the Billboard Hot 100';

  try {
    const data = await fetchChartData(iso);
    const sorted = [...data].sort((a, b) => (a.this_week || 999) - (b.this_week || 999));
    renderSongs(sorted.slice(0, 40));
  } catch (err) {
    showError(err.message || 'Could not load chart data. Try a different date.');
  } finally {
    setLoading(false);
  }
}

async function fetchChartData(iso) {
  const base = 'https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/date';
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
  songs.forEach((song, i) => {
    const rank = song.this_week || (i + 1);
    const title = song.song || song.title || 'Unknown Title';
    const artist = song.artist || 'Unknown Artist';
    const weeksOnChart = song.weeks_on_chart;
    const peakPosition = song.peak_position;

    const li = document.createElement('li');
    li.className = 'song-item';
    li.style.setProperty('--i', i);

    const rankEl = `<div class="song-rank">#${rank}</div>`;
    const placeholder = `<div class="song-album-art-placeholder">${rankEmoji(rank)}</div>`;

    const weeksStr = weeksOnChart ? `${weeksOnChart} wk${weeksOnChart !== 1 ? 's' : ''} on chart` : '';
    const peakStr  = peakPosition  ? `Peak: #${peakPosition}` : '';
    const peakClass = peakPosition === 1 || peakPosition === '1' ? 'peak-1' : '';
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(title + ' ' + artist)}`;

    li.innerHTML = `
      ${rankEl}
      ${placeholder}
      <div class="song-info">
        <div class="song-title">${escHtml(title)}</div>
        <div class="song-artist">${escHtml(artist)}</div>
      </div>
      <div class="song-meta">
        ${weeksStr ? `<span class="song-weeks">${escHtml(weeksStr)}</span>` : ''}
        ${peakStr  ? `<span class="song-peak ${peakClass}">${escHtml(peakStr)}</span>` : ''}
      </div>
      <a class="yt-btn" href="${ytUrl}" target="_blank" rel="noopener noreferrer" title="Watch on YouTube">
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
        </svg>
      </a>
    `;

    songList.appendChild(li);
  });
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
