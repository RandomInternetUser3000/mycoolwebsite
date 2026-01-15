import { sendJson, methodNotAllowed } from '../../lib/server/http.js';

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const PIPED_BASES = [
	'https://piped.video/api/v1/channel/',
	'https://piped.mha.fi/api/v1/channel/',
];

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

	const latestVideo = await getLatestVideo({ channelId, handle: rawHandle, apiKey });
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

	if (!apiKey) {
		const fallbackId = await resolveChannelIdFromPiped(normalized);
		return fallbackId || '';
	}

	const url = new URL('https://www.googleapis.com/youtube/v3/search');
	url.searchParams.set('part', 'id');
	url.searchParams.set('type', 'channel');
	url.searchParams.set('maxResults', '1');
	url.searchParams.set('q', normalized);
	url.searchParams.set('key', apiKey);

	try {
		const response = await fetch(url);
		if (!response.ok) {
			return await resolveChannelIdFromPiped(normalized);
		}
		const json = await response.json();
		const channelId = json?.items?.[0]?.id?.channelId || '';
		return channelId || (await resolveChannelIdFromPiped(normalized)) || '';
	} catch (error) {
		return await resolveChannelIdFromPiped(normalized);
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
			return await fetchLatestViaFeed(channelId);
		}
		const searchJson = await searchResponse.json();
		const item = searchJson?.items?.[0];
		const videoId = item?.id?.videoId;
		const snippet = item?.snippet || {};
		if (!videoId) {
			return await fetchLatestViaFeed(channelId);
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
		return await fetchLatestViaFeed(channelId);
	}
}

async function fetchLatestFromPiped(identifier) {
	const cleaned = (identifier || '').trim();
	if (!cleaned) return null;
	for (const base of PIPED_BASES) {
		const sanitizedBase = base.endsWith('/') ? base : `${base}/`;
		const url = `${sanitizedBase}${encodeURIComponent(cleaned)}`;
		try {
			const response = await fetch(url, { headers: { Accept: 'application/json' } });
			if (!response.ok) continue;
			const payload = await response.json().catch(() => null);
			if (!payload) continue;
			const streams = Array.isArray(payload.latestStreams)
				? payload.latestStreams
				: Array.isArray(payload.relatedStreams)
					? payload.relatedStreams
					: Array.isArray(payload.streams)
						? payload.streams
						: Array.isArray(payload.videos)
							? payload.videos
							: [];
			const best = streams
				.map((entry) => {
					if (!entry?.title) return null;
					const published = entry.uploaded ?? entry.uploadedDate ?? entry.published ?? entry.publishedDate ?? entry.createdAt;
					const publishedAt = published ? new Date(published).toISOString() : null;
					const videoId = entry.url || entry.videoId || entry.id;
					const thumbnail = entry.thumbnail || entry.thumbnailUrl || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);
					return {
						title: entry.title,
						videoId,
						thumbnail,
						publishedAt,
						url: videoId ? (String(videoId).startsWith('http') ? videoId : `https://www.youtube.com/watch?v=${videoId}`) : null,
						viewCount: entry.views ?? entry.viewCount ?? null,
						durationSeconds: entry.duration ?? entry.lengthSeconds ?? null,
					};
				})
				.filter(Boolean)
				.sort((a, b) => (Date.parse(b.publishedAt || 0) || 0) - (Date.parse(a.publishedAt || 0) || 0))[0];
			if (best) {
				return {
					channelId: payload.id || payload.channelId || payload.channel_id || null,
					...best,
				};
			}
		} catch (error) {
			// ignore and try next base
		}
	}
	return null;
}

async function resolveChannelIdFromPiped(handle) {
	const result = await fetchLatestFromPiped(handle);
	return result?.channelId || null;
}

async function getLatestVideo({ channelId, handle, apiKey }) {
	const apiEnabled = Boolean(apiKey);
	if (apiEnabled) {
		const viaApi = await fetchLatestVideo(channelId, apiKey);
		if (viaApi) {
			return viaApi;
		}
	}

	const viaPiped = await fetchLatestFromPiped(channelId || handle);
	if (viaPiped?.videoId) {
		return {
			videoId: viaPiped.videoId,
			title: viaPiped.title,
			url: viaPiped.url,
			thumbnail: viaPiped.thumbnail,
			publishedAt: viaPiped.publishedAt,
			durationSeconds: viaPiped.durationSeconds,
			viewCount: viaPiped.viewCount,
		};
	}

	const viaFeed = await fetchLatestViaFeed(channelId);
	return viaFeed;
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