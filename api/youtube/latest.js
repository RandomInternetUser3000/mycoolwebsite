const fetchJson = async (url) => {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Request failed ${res.status}`);
  return res.json();
};

const YT_API = 'https://www.googleapis.com/youtube/v3';

const respond = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const pick = (obj, keys) => keys.reduce((acc, key) => {
  if (obj && obj[key] != null) acc[key] = obj[key];
  return acc;
}, {});

const resolveChannelId = async ({ apiKey, handle, username, channelId }) => {
  if (channelId) return channelId.trim();
  if (!apiKey) throw new Error('Missing API key');

  if (handle) {
    const url = `${YT_API}/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
    const data = await fetchJson(url);
    const found = data?.items?.[0]?.id;
    if (found) return found;
  }

  if (username) {
    const url = `${YT_API}/channels?part=id&forUsername=${encodeURIComponent(username)}&key=${apiKey}`;
    const data = await fetchJson(url);
    const found = data?.items?.[0]?.id;
    if (found) return found;
  }

  return '';
};

const getLatestVideo = async ({ apiKey, channelId }) => {
  const searchUrl = `${YT_API}/search?part=snippet&channelId=${encodeURIComponent(channelId)}&maxResults=1&order=date&type=video&key=${apiKey}`;
  const searchData = await fetchJson(searchUrl);
  const item = searchData?.items?.[0];
  if (!item) return null;

  const videoId = item.id?.videoId;
  const snippet = item.snippet || {};
  const videosUrl = `${YT_API}/videos?part=contentDetails,statistics,snippet&id=${encodeURIComponent(videoId)}&key=${apiKey}`;
  const videosData = await fetchJson(videosUrl);
  const video = videosData?.items?.[0];
  if (!video) return null;

  const thumb = video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url;
  const duration = video.contentDetails?.duration || '';
  const viewCount = Number.parseInt(video.statistics?.viewCount ?? '0', 10);

  return {
    videoId,
    title: video.snippet?.title || snippet.title || 'Latest upload',
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail: thumb || '',
    publishedAt: video.snippet?.publishedAt || snippet.publishedAt || '',
    duration,
    viewCount: Number.isFinite(viewCount) ? viewCount : 0,
    channelId,
  };
};

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      respond(res, 405, { error: 'Method not allowed' });
      return;
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      respond(res, 500, { error: 'Missing YOUTUBE_API_KEY' });
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    const channelId = url.searchParams.get('channelId') || '';
    const handle = url.searchParams.get('handle') || '';
    const username = url.searchParams.get('channelUser') || '';

    const resolvedChannelId = await resolveChannelId({ apiKey, handle, username, channelId });
    if (!resolvedChannelId) {
      respond(res, 400, { error: 'Could not resolve channelId' });
      return;
    }

    const video = await getLatestVideo({ apiKey, channelId: resolvedChannelId });
    if (!video) {
      respond(res, 404, { error: 'No video found' });
      return;
    }

    respond(res, 200, { ...video, source: 'youtube-data-api' });
  } catch (error) {
    respond(res, 500, pick(error, ['message']));
  }
};import { sendJson, methodNotAllowed } from '../../lib/server/http.js';

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET', 'OPTIONS']);
    return;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: 'YOUTUBE_API_KEY is not configured' });
    return;
  }

  const { searchParams } = new URL(req.url, 'http://localhost');
  const rawChannelId = (searchParams.get('channelId') || '').trim();
  const rawHandle =
    (searchParams.get('handle') || '').trim() ||
    (searchParams.get('channelHandle') || '').trim() ||
    (searchParams.get('channelUser') || '').trim();

  if (!rawChannelId && !rawHandle) {
    sendJson(res, 400, { error: 'Provide channelId or handle' });
    return;
  }

  const cacheKey = rawChannelId || rawHandle.toLowerCase();
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
    sendJson(res, 200, { source: 'cache', ...cached.payload });
    return;
  }

  const channelId = rawChannelId || (await resolveChannelId(rawHandle, apiKey));
  if (!channelId) {
    sendJson(res, 404, { error: 'Channel not found' });
    return;
  }

  const latestVideo = await fetchLatestVideo(channelId, apiKey);
  if (!latestVideo) {
    sendJson(res, 404, { error: 'No videos found for this channel' });
    return;
  }

  const payload = { channelId, ...latestVideo };
  cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, payload });
  res.setHeader('Cache-Control', 'public, max-age=120, stale-while-revalidate=60');
  sendJson(res, 200, payload);
}

async function resolveChannelId(handle, apiKey) {
  if (!handle) return '';
  const normalized = handle.startsWith('@') ? handle : `@${handle}`;
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'id');
  url.searchParams.set('type', 'channel');
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('q', normalized);
  url.searchParams.set('key', apiKey);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return '';
    }
    const json = await response.json();
    const channelId = json?.items?.[0]?.id?.channelId || '';
    return channelId || '';
  } catch (error) {
    return '';
  }
}

async function fetchLatestVideo(channelId, apiKey) {
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('channelId', channelId);
  searchUrl.searchParams.set('order', 'date');
  searchUrl.searchParams.set('maxResults', '1');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('key', apiKey);

  try {
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      return null;
    }
    const searchJson = await searchResponse.json();
    const item = searchJson?.items?.[0];
    const videoId = item?.id?.videoId;
    const snippet = item?.snippet || {};
    if (!videoId) {
      const fallback = await fetchLatestViaFeed(channelId);
      if (fallback) return fallback;
      return null;
    }

    const details = await fetchVideoDetails(videoId, apiKey);
    const durationSeconds = details?.durationSeconds ?? null;
    const viewCount = details?.viewCount ?? null;
    const thumbnail = pickBestThumbnail(snippet?.thumbnails) || details?.thumbnail || null;

    return {
      videoId,
      title: snippet?.title || details?.title || 'Latest upload',
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail,
      publishedAt: snippet?.publishedAt || details?.publishedAt || null,
      durationSeconds,
      viewCount,
    };
  } catch (error) {
    const fallback = await fetchLatestViaFeed(channelId);
    if (fallback) return fallback;
    return null;
  }
}

async function fetchLatestViaFeed(channelId) {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  try {
    const res = await fetch(feedUrl, { headers: { Accept: 'application/atom+xml' } });
    if (!res.ok) {
      return null;
    }
    const text = await res.text();
    const videoId = text.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] || '';
    const title = text.match(/<title>([^<]+)<\/title>/)?.[1] || 'Latest upload';
    const publishedAt = text.match(/<published>([^<]+)<\/published>/)?.[1] || null;
    if (!videoId) {
      return null;
    }
    const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    return {
      videoId,
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail,
      publishedAt,
      durationSeconds: null,
      viewCount: null,
    };
  } catch (error) {
    return null;
  }
}

async function fetchVideoDetails(videoId, apiKey) {
  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  videosUrl.searchParams.set('part', 'snippet,contentDetails,statistics');
  videosUrl.searchParams.set('id', videoId);
  videosUrl.searchParams.set('key', apiKey);

  try {
    const response = await fetch(videosUrl);
    if (!response.ok) {
      return null;
    }
    const json = await response.json();
    const item = json?.items?.[0];
    if (!item) {
      return null;
    }
    const durationSeconds = parseIsoDuration(item?.contentDetails?.duration);
    const viewCount = Number.parseInt(item?.statistics?.viewCount ?? '', 10);
    const thumbnail = pickBestThumbnail(item?.snippet?.thumbnails);
    return {
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
      viewCount: Number.isFinite(viewCount) && viewCount >= 0 ? viewCount : null,
      publishedAt: item?.snippet?.publishedAt || null,
      title: item?.snippet?.title || null,
      thumbnail,
    };
  } catch (error) {
    return null;
  }
}

function parseIsoDuration(value) {
  if (!value || typeof value !== 'string' || !value.startsWith('PT')) {
    return Number.NaN;
  }
  const isoPattern = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const [, hoursRaw, minutesRaw, secondsRaw] = isoPattern.exec(value) || [];
  const hours = Number.parseInt(hoursRaw ?? '0', 10) || 0;
  const minutes = Number.parseInt(minutesRaw ?? '0', 10) || 0;
  const seconds = Number.parseInt(secondsRaw ?? '0', 10) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

function pickBestThumbnail(thumbnails) {
  if (!thumbnails || typeof thumbnails !== 'object') {
    return null;
  }
  return (
    thumbnails.maxres?.url ||
    thumbnails.standard?.url ||
    thumbnails.high?.url ||
    thumbnails.medium?.url ||
    thumbnails.default?.url ||
    null
  );
}