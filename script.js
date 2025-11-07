const ver = "Version 0.9.51 Public Beta";
const COMMENTS_API_URL = '/api/comments';
const COMMENTS_STORAGE_KEY = 'coolman-comments';
const ANALYTICS_MODULE_URL = 'https://unpkg.com/@vercel/analytics/dist/analytics.mjs';
const blogViewerState = {
	container: null,
	closeButton: null,
	readerTitle: null,
	contentHost: null,
	commentList: null,
	commentStatus: null,
	commentEmpty: null,
	commentForm: null,
	submitButton: null,
	activeSlug: null,
	activeTrigger: null,
	defaultStatusMessage: '',
	currentComments: [],
	shareFeedbackTimer: null,
};

const CHANNEL_ID_CACHE = new Map();

document.addEventListener('DOMContentLoaded', () => {
	applyInitialTheme();
	setupThemeToggle();
	fadeInPage();
	applySiteVersion();
	enableContactForm();
	enhanceSocialButtons();
	initNavGradient();
	initBlogViewer();
	initLatestUploadCard();
	initShareButtons();
	injectAnalytics();
});

const THEME_STORAGE_KEY = 'coolman-theme';

function applyInitialTheme() {
	const storedTheme = getStoredTheme();
	const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)')?.matches ?? false;
	const initialTheme = storedTheme ?? (prefersLight ? 'light' : 'dark');

	applyTheme(initialTheme, { persist: Boolean(storedTheme) });

	if (!storedTheme && window.matchMedia) {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
		const handleChange = (event) => {
			if (!getStoredTheme()) {
				applyTheme(event.matches ? 'light' : 'dark', { persist: false });
			}
		};

		if (mediaQuery.addEventListener) {
			mediaQuery.addEventListener('change', handleChange);
		} else if (mediaQuery.addListener) {
			mediaQuery.addListener(handleChange);
		}
	}
}

function setupThemeToggle() {
	const toggle = document.querySelector('.theme-toggle');
	if (!toggle) {
		return;
	}

	toggle.addEventListener('click', () => {
		const nextTheme = document.body.classList.contains('theme-light') ? 'dark' : 'light';
		applyTheme(nextTheme);
	});
}

function applyTheme(theme, options = { persist: true }) {
	const body = document.body;
	if (!body) {
		return;
	}

	const isLight = theme === 'light';
	body.classList.toggle('theme-light', isLight);
	body.dataset.theme = theme;

	updateToggleState(theme);

	if (options.persist) {
		setStoredTheme(theme);
	}
}

function updateToggleState(theme) {
	const toggle = document.querySelector('.theme-toggle');
	if (!toggle) {
		return;
	}

	const icon = toggle.querySelector('.toggle-icon');
	const label = toggle.querySelector('.toggle-text');
	const isLight = theme === 'light';
	const nextThemeName = isLight ? 'Dark mode' : 'Light mode';

	if (icon) {
		icon.textContent = isLight ? '☀️' : '🌙';
	}

	if (label) {
		label.textContent = nextThemeName;
	}

	toggle.setAttribute('aria-label', `Switch to ${nextThemeName.toLowerCase()}`);
	toggle.setAttribute('aria-pressed', isLight ? 'false' : 'true');
}

function getStoredTheme() {
	try {
		const stored = localStorage.getItem(THEME_STORAGE_KEY);
		return stored === 'light' || stored === 'dark' ? stored : null;
	} catch (error) {
		return null;
	}
}

function setStoredTheme(theme) {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, theme);
	} catch (error) {
		// Ignore storage errors (private mode, etc.)
	}
}

function fadeInPage() {
	const body = document.body;
	if (!body) {
		return;
	}

	body.style.opacity = '0';
	requestAnimationFrame(() => {
		body.style.transition = 'opacity 0.5s ease-in';
		body.style.opacity = '1';
	});
}

function enhanceSocialButtons() {
	const socialButtons = document.querySelectorAll('.social-button');
	socialButtons.forEach((button) => {
		const label = inferSocialLabel(button);
		if (label) {
			button.setAttribute('aria-label', label);
			button.dataset.label = label;
			button.dataset.tooltip = label;
			if (!button.getAttribute('title')) {
				button.setAttribute('title', label);
			}
		}
	});
}

function inferSocialLabel(button) {
	const labelElement = button.querySelector('.social-label');
	const explicit = labelElement?.textContent?.trim() || button.dataset.label?.trim();
	if (explicit) {
		return explicit;
	}

	const imageAlt = button.querySelector('img')?.alt?.trim();
	if (imageAlt) {
		return imageAlt;
	}

	const href = button.getAttribute('href')?.toLowerCase() ?? '';
	if (href.includes('github')) {
		return 'GitHub';
	}
	if (href.includes('youtube') || href.includes('youtu.be')) {
		return 'YouTube';
	}
	if (href.includes('discord')) {
		return 'Discord';
	}
	if (href.includes('roblox')) {
		return 'Roblox';
	}
	if (href) {
		return href.replace(/^https?:\/\//, '').split('/')[0];
	}

	return '';
}

function initNavGradient() {
	const navLinks = document.querySelector('.nav-links');
	if (!navLinks) {
		return;
	}

	const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
	const setStaticNavGlow = () => {
		navLinks.style.setProperty('--nav-glow-x', '50%');
		navLinks.style.setProperty('--nav-glow-y', '50%');
		navLinks.style.setProperty('--nav-glow-strength', '42%');
		navLinks.style.setProperty('--nav-glow-opacity', prefersReducedMotion ? '0.12' : '0.28');
		navLinks.style.setProperty('--nav-glow-color-1', 'hsla(330, 88%, 60%, 0.36)');
		navLinks.style.setProperty('--nav-glow-color-2', 'hsla(250, 84%, 58%, 0.24)');
	};

	setStaticNavGlow();

	const hasFinePointer = window.matchMedia?.('(pointer: fine)').matches ?? true;
	if (prefersReducedMotion || !hasFinePointer) {
		return;
	}

	let lastPoint = null;
	let frameId = null;

	const updateFromPoint = (point) => {
		frameId = null;
		if (!point) {
			return;
		}

		const rect = navLinks.getBoundingClientRect();
		if (!rect.width || !rect.height) {
			return;
		}

		const relativeX = (point.clientX - rect.left) / rect.width;
		const relativeY = (point.clientY - rect.top) / rect.height;
		const clampedX = Math.min(Math.max(relativeX, 0), 1);
		const clampedY = Math.min(Math.max(relativeY, 0), 1);
		const globalXRatio = point.clientX / window.innerWidth;
		const globalYRatio = point.clientY / window.innerHeight;
		const hue = 260 + globalXRatio * 140;
		const secondaryHue = (hue + 60) % 360;
		const distanceFromCenter = Math.min(Math.hypot(clampedX - 0.5, clampedY - 0.5) * 2, 1);
		const strength = 32 + (1 - distanceFromCenter) * 48;
		const opacity = 0.22 + (1 - globalYRatio) * 0.5;

		navLinks.style.setProperty('--nav-glow-x', `${(clampedX * 100).toFixed(2)}%`);
		navLinks.style.setProperty('--nav-glow-y', `${(clampedY * 100).toFixed(2)}%`);
		navLinks.style.setProperty('--nav-glow-strength', `${strength.toFixed(1)}%`);
		navLinks.style.setProperty('--nav-glow-opacity', Math.min(opacity, 0.85).toFixed(2));
		navLinks.style.setProperty(
			'--nav-glow-color-1',
			`hsla(${hue.toFixed(1)}, 88%, ${58 + (1 - globalYRatio) * 12}%, ${Math.min(opacity + 0.12, 0.9).toFixed(2)})`,
		);
		navLinks.style.setProperty(
			'--nav-glow-color-2',
			`hsla(${secondaryHue.toFixed(1)}, 82%, ${52 + clampedY * 14}%, ${Math.min(opacity * 0.7 + 0.08, 0.78).toFixed(2)})`,
		);
	};

	const queueUpdate = (event) => {
		lastPoint = { clientX: event.clientX, clientY: event.clientY };
		if (!frameId) {
			frameId = requestAnimationFrame(() => updateFromPoint(lastPoint));
		}
	};

	const resetGlow = () => {
		lastPoint = null;
		if (frameId) {
			cancelAnimationFrame(frameId);
			frameId = null;
		}
		setStaticNavGlow();
	};

	navLinks.addEventListener('pointerenter', queueUpdate, { passive: true });
	navLinks.addEventListener('pointermove', queueUpdate, { passive: true });
	navLinks.addEventListener('pointerleave', resetGlow);
	navLinks.addEventListener('pointercancel', resetGlow);

	window.addEventListener('resize', () => {
		if (lastPoint) {
			updateFromPoint(lastPoint);
		}
	});

	window.addEventListener('blur', resetGlow);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			resetGlow();
		}
	});
}

function enableContactForm() {
	const contactForm = document.getElementById('contactForm');
	if (!contactForm) {
		return;
	}

	const statusElement = document.getElementById('formStatus');
	const submitButton = contactForm.querySelector('button[type="submit"]');
	const endpoint = contactForm.getAttribute('action');

	if (statusElement) {
		statusElement.setAttribute('role', 'status');
		statusElement.setAttribute('aria-live', 'polite');
	}

	if (!submitButton) {
		return;
	}

	contactForm.addEventListener('submit', async (event) => {
		event.preventDefault();

		if (!endpoint) {
			return;
		}

		const formData = new FormData(contactForm);

		submitButton.disabled = true;
		submitButton.textContent = 'Sending...';
		if (statusElement) {
			statusElement.textContent = '';
			statusElement.classList.remove('success', 'error');
		}

		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
				},
				body: formData,
			});

			if (response.ok) {
				if (statusElement) {
					statusElement.textContent = "Message sent successfully! I'll get back to you soon.";
					statusElement.classList.add('success');
				}
				contactForm.reset();
			} else {
				const data = await response.json().catch(() => null);
				const errorMessage = data?.errors?.[0]?.message || 'Something went wrong. Please try again later.';
				if (statusElement) {
					statusElement.textContent = errorMessage;
					statusElement.classList.add('error');
				}
			}
		} catch (error) {
			if (statusElement) {
				statusElement.textContent = 'Network error. Please check your connection and try again.';
				statusElement.classList.add('error');
			}
		} finally {
			submitButton.disabled = false;
			submitButton.textContent = 'Send Message';
		}
	});
}

function applySiteVersion() {
	const versionMatch = ver.match(/^Version\s+([^\s]+)(?:\s+(.+))?$/i);
	const versionNumber = versionMatch?.[1] ?? '';
	const versionTypeRaw = versionMatch?.[2]?.trim() ?? '';
	const versionLabel = [versionNumber, versionTypeRaw].filter(Boolean).join(' ');

	document.querySelectorAll('[data-site-version-link]').forEach((link) => {
		const fallbackText = link.textContent?.trim();
		if (!fallbackText) {
			link.textContent = 'Version';
		}
		const ariaLabel = versionLabel
			? `Open GitHub repository for website version ${versionLabel}`
			: 'Open the website GitHub repository';
		link.setAttribute('title', ariaLabel);
		link.setAttribute('aria-label', ariaLabel);
	});

	document.querySelectorAll('[data-site-version-number]').forEach((node) => {
		if (versionNumber) {
			node.textContent = ` ${versionNumber}`;
			node.hidden = false;
			node.removeAttribute('hidden');
		} else {
			node.textContent = '';
			node.hidden = true;
			node.setAttribute('hidden', 'hidden');
		}
	});

	document.querySelectorAll('[data-site-version-type]').forEach((node) => {
		if (versionTypeRaw) {
			node.textContent = ` (${versionTypeRaw})`;
			node.hidden = false;
			node.removeAttribute('hidden');
		} else {
			node.textContent = '';
			node.hidden = true;
			node.setAttribute('hidden', 'hidden');
		}
	});
}

function initBlogViewer() {
	const container = document.querySelector('[data-blog-reader]');
	if (!container) {
		return;
	}

	const triggers = document.querySelectorAll('[data-blog-open]');
	if (!triggers.length) {
		return;
	}

	blogViewerState.container = container;
	blogViewerState.closeButton = container.querySelector('[data-reader-close]');
	blogViewerState.readerTitle = container.querySelector('[data-reader-title]');
	blogViewerState.contentHost = container.querySelector('[data-modal-content]');
	blogViewerState.commentList = container.querySelector('[data-comment-list]');
	blogViewerState.commentStatus = container.querySelector('[data-comment-status]');
	blogViewerState.commentEmpty = container.querySelector('[data-comment-empty]');
	blogViewerState.commentForm = container.querySelector('[data-comment-form]');
	blogViewerState.submitButton = blogViewerState.commentForm?.querySelector('button[type="submit"]') ?? null;
	blogViewerState.defaultStatusMessage = blogViewerState.commentStatus?.dataset.defaultMessage ?? '';

	triggers.forEach((trigger) => {
		trigger.addEventListener('click', (event) => {
			event.preventDefault();
			openBlogModal(trigger);
		});
		trigger.style.cursor = 'pointer';
	});

	blogViewerState.closeButton?.addEventListener('click', () => {
		closeBlogModal();
	});

	container.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			closeBlogModal();
		}
	});

	if (blogViewerState.commentForm) {
		blogViewerState.commentForm.addEventListener('submit', handleCommentSubmit);
	}
}

async function initLatestUploadCard() {
	const card = document.querySelector('[data-latest-video]');
	if (!card) {
		return;
	}

	const channelIdAttr = card.getAttribute('data-channel-id')?.trim() || '';
	const channelUserRaw = card.getAttribute('data-channel-user')?.trim() || '';
	const { handle: normalizedHandle, legacyUser } = parseChannelUserInput(channelUserRaw);
	let resolvedChannelId = channelIdAttr;
	let channelUrl = computeChannelUrl(resolvedChannelId, normalizedHandle);
	const updateChannelUrl = () => {
		channelUrl = computeChannelUrl(resolvedChannelId, normalizedHandle);
		return channelUrl;
	};
	updateChannelUrl();

	const titleEl = card.querySelector('[data-video-title]');
	const thumbEl = card.querySelector('[data-video-thumb-slot]');
	const linkEl = card.querySelector('[data-video-link]');
	const publishedEl = card.querySelector('[data-video-published]');
	const durationEl = card.querySelector('[data-video-duration]');

	const markError = (message) => {
		card.classList.add('now-playing--error');
		thumbEl?.classList.remove('now-playing__thumb--skeleton');
		if (thumbEl) {
			thumbEl.style.removeProperty('background-image');
			thumbEl.style.removeProperty('background-size');
			thumbEl.style.removeProperty('background-position');
		}
		if (titleEl) {
			titleEl.textContent = message;
		}
		if (publishedEl) {
			publishedEl.hidden = true;
			publishedEl.textContent = '';
		}
		if (durationEl) {
			durationEl.hidden = true;
			durationEl.textContent = '';
		}
		if (linkEl) {
			linkEl.href = channelUrl;
		}
		};

		if (!resolvedChannelId && !legacyUser && !normalizedHandle) {
			markError('Latest video coming soon — check out the full channel!');
			return;
		}

	const buildChannelFeedUrl = (id) => `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(id)}`;
	const buildUserFeedUrl = (user) => `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(user)}`;

	const candidateFeeds = [];
	if (resolvedChannelId) {
		candidateFeeds.push({ type: 'channel_id', channelId: resolvedChannelId, url: buildChannelFeedUrl(resolvedChannelId) });
	}
	if (legacyUser) {
		candidateFeeds.push({ type: 'user', channelUser: legacyUser, url: buildUserFeedUrl(legacyUser) });
	}

	let feedText = null;
	let lastFeedError = null;
	const attemptFeed = async (candidate) => {
		try {
			return await fetchFeedWithFallback(candidate.url);
		} catch (error) {
			lastFeedError = error;
			console.info('YouTube feed attempt failed', { url: candidate.url, reason: error?.message });
			return null;
		}
	};

	for (const candidate of candidateFeeds) {
		const fetched = await attemptFeed(candidate);
		if (fetched) {
			if (candidate.type === 'channel_id') {
				resolvedChannelId = candidate.channelId;
				updateChannelUrl();
			}
			feedText = fetched;
			break;
		}
	}

	const resolutionIdentifier = normalizedHandle || channelUserRaw;
	if (!feedText && resolutionIdentifier && !resolvedChannelId) {
		const derivedChannelId = await resolveChannelId(resolutionIdentifier);
		if (derivedChannelId) {
			resolvedChannelId = derivedChannelId;
			updateChannelUrl();
			const derivedFeed = await attemptFeed({
				type: 'channel_id',
				channelId: derivedChannelId,
				url: buildChannelFeedUrl(derivedChannelId),
			});
			if (derivedFeed) {
				feedText = derivedFeed;
			}
		}
	}

	if (!feedText) {
		if (lastFeedError) {
			console.error('Failed to load latest YouTube upload', lastFeedError);
		} else {
			console.error('Failed to load latest YouTube upload: no feed could be retrieved');
		}
		markError('Unable to fetch the latest video right now. Watch more on YouTube.');
		return;
	}

	try {
		const parser = new DOMParser();
		const doc = parser.parseFromString(feedText, 'application/xml');
		if (doc.querySelector('parsererror')) {
			throw new Error('Unable to parse YouTube feed');
		}
		const entry = doc.querySelector('entry');
		if (!entry) {
			markError('No uploads yet. Stay tuned!');
			return;
		}

		const videoId = entry.getElementsByTagName('yt:videoId')[0]?.textContent?.trim();
		const title = entry.getElementsByTagName('title')[0]?.textContent?.trim() ?? 'Latest upload';
		const linkNode = Array.from(entry.getElementsByTagName('link')).find((node) =>
			node.getAttribute('rel') === 'alternate'
		);
		const link = linkNode?.getAttribute('href') ?? entry.getElementsByTagName('link')[0]?.getAttribute('href') ??
			(videoId ? `https://www.youtube.com/watch?v=${videoId}` : channelUrl);
		const published = entry.getElementsByTagName('published')[0]?.textContent ?? '';
		const thumbnail = entry.getElementsByTagName('media:thumbnail')[0]?.getAttribute('url') ??
			(videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);
		const durationNode = entry.getElementsByTagName('yt:duration')[0] ?? entry.querySelector('yt\\:duration');
		const durationSecondsRaw = durationNode?.getAttribute('seconds') ?? durationNode?.textContent;
		const durationSeconds = parseDurationSeconds(durationSecondsRaw);

		card.classList.remove('now-playing--error');
		if (titleEl) {
			titleEl.textContent = title;
		}
		if (thumbEl) {
			thumbEl.classList.remove('now-playing__thumb--skeleton');
			if (thumbnail) {
				thumbEl.style.backgroundImage = `url("${thumbnail}")`;
				thumbEl.style.backgroundSize = 'cover';
				thumbEl.style.backgroundPosition = 'center';
			} else {
				thumbEl.style.removeProperty('background-image');
				thumbEl.style.removeProperty('background-size');
				thumbEl.style.removeProperty('background-position');
			}
		}
		if (linkEl) {
			linkEl.href = link;
		}
		if (publishedEl && published) {
			const relative = formatRelativeTime(published);
			if (relative) {
				publishedEl.hidden = false;
				publishedEl.textContent = relative;
				const publishedDate = new Date(published);
				if (!Number.isNaN(publishedDate.getTime())) {
					publishedEl.dateTime = publishedDate.toISOString();
				}
			} else {
				publishedEl.hidden = true;
				publishedEl.textContent = '';
			}
		} else if (publishedEl) {
			publishedEl.hidden = true;
			publishedEl.textContent = '';
		}
		if (durationEl && Number.isFinite(durationSeconds) && durationSeconds > 0) {
			const durationLabel = formatDurationLabel(Number(durationSeconds));
			if (durationLabel) {
				durationEl.hidden = false;
				durationEl.textContent = durationLabel;
			} else {
				durationEl.hidden = true;
				durationEl.textContent = '';
			}
		} else if (durationEl) {
			durationEl.hidden = true;
			durationEl.textContent = '';
		}
	} catch (error) {
		console.error('Failed to load latest YouTube upload', error);
		markError('Unable to fetch the latest video right now. Watch more on YouTube.');
	}
}

async function fetchFeedWithFallback(url, accept = 'application/atom+xml') {
	try {
		const response = await fetch(url, { headers: { Accept: accept } });
		if (response.ok) {
			return response.text();
		}
	} catch (error) {
		// fall through to proxy
	}

	const proxiedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
	const response = await fetch(proxiedUrl, { headers: { Accept: accept } });
	if (!response.ok) {
		throw new Error(`Fallback request failed with status ${response.status}`);
	}
	return response.text();
}

function parseChannelUserInput(input) {
	const trimmed = input?.trim();
	if (!trimmed) {
		return { handle: '', legacyUser: '' };
	}

	const urlPattern = /youtube\.com\/(?:@|channel\/|c\/|user\/)?([\w.-]+)/i;
	const urlMatch = trimmed.match(urlPattern);
	const baseWithDecorators = urlMatch?.[1] ?? trimmed;
	const base = baseWithDecorators.split(/[?#]/)[0].replace(/\/+$/, '');
	const handle = normalizeChannelHandle(base);
	const legacyUser = base
		.replace(/^@+/, '')
		.replace(/^(?:channel\/|c\/|user\/)/i, '')
		.split('/')[0];

	return { handle, legacyUser };
}

function normalizeChannelHandle(value) {
	const trimmed = value?.trim();
	if (!trimmed) {
		return '';
	}

	if (/^https?:\/\//i.test(trimmed)) {
		const match = trimmed.match(/youtube\.com\/(@?[\w.-]+)/i);
		if (match?.[1]) {
			return normalizeChannelHandle(match[1]);
		}
	}

	const sanitized = trimmed.split(/[?#]/)[0].replace(/\/+$/, '');
	const withoutPathPrefixes = sanitized
		.replace(/^@+/, '')
		.replace(/^(?:channel\/)*/i, '')
		.replace(/^(?:c\/)*/i, '')
		.replace(/^(?:user\/)*/i, '');
	const stripped = withoutPathPrefixes.replace(/^@+/, '');
	if (!stripped) {
		return '';
	}

	const primarySegment = stripped.split('/')[0];
	if (!primarySegment) {
		return '';
	}

	return `@${primarySegment}`;
}

function computeChannelUrl(channelId, handle) {
	if (handle) {
		return `https://www.youtube.com/${handle}`;
	}
	if (channelId) {
		return `https://www.youtube.com/channel/${channelId}`;
	}
	return 'https://www.youtube.com';
}

async function resolveChannelId(channelUser) {
	const { handle, legacyUser } = parseChannelUserInput(channelUser);
	if (!handle && !legacyUser) {
		return null;
	}

	if (handle && CHANNEL_ID_CACHE.has(handle)) {
		return CHANNEL_ID_CACHE.get(handle);
	}

	if (legacyUser && CHANNEL_ID_CACHE.has(legacyUser)) {
		return CHANNEL_ID_CACHE.get(legacyUser);
	}

	const acceptHeader = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8';
	const candidateUrls = [];
	if (handle) {
		candidateUrls.push(`https://www.youtube.com/${handle}/about`, `https://www.youtube.com/${handle}`);
	}
	if (legacyUser) {
		candidateUrls.push(
			`https://www.youtube.com/user/${legacyUser}/about`,
			`https://www.youtube.com/user/${legacyUser}`,
			`https://www.youtube.com/c/${legacyUser}/about`,
			`https://www.youtube.com/c/${legacyUser}`,
			`https://www.youtube.com/${legacyUser}/about`,
			`https://www.youtube.com/${legacyUser}`,
		);
	}

	for (const url of candidateUrls) {
		try {
			const html = await fetchFeedWithFallback(url, acceptHeader);
			const match = html.match(/"channelId":"(UC[0-9A-Za-z_-]{21}[0-9A-Za-z_-])"/);
			const externalMatch = match ?? html.match(/"externalId":"(UC[0-9A-Za-z_-]{21}[0-9A-Za-z_-])"/);
			const channelId = externalMatch?.[1];
			if (channelId) {
				if (handle) {
					CHANNEL_ID_CACHE.set(handle, channelId);
				}
				if (legacyUser) {
					CHANNEL_ID_CACHE.set(legacyUser, channelId);
				}
				return channelId;
			}
		} catch (error) {
			console.info('Channel ID resolution attempt failed', { url, reason: error?.message });
		}
	}

	if (handle) {
		CHANNEL_ID_CACHE.set(handle, null);
	}
	if (legacyUser) {
		CHANNEL_ID_CACHE.set(legacyUser, null);
	}
	return null;
}

function formatRelativeTime(timestamp) {
	if (!timestamp) {
		return '';
	}

	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) {
		return '';
	}

	const now = new Date();
	const diffMs = date.getTime() - now.getTime();
	const diffSeconds = Math.round(diffMs / 1000);
	const absSeconds = Math.abs(diffSeconds);
	const formatter = typeof Intl?.RelativeTimeFormat === 'function'
		? new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
		: null;
	if (absSeconds < 30) {
		return 'just now';
	}
	const ranges = [
		{ limit: 60, divisor: 1, unit: 'second' },
		{ limit: 3600, divisor: 60, unit: 'minute' },
		{ limit: 86400, divisor: 3600, unit: 'hour' },
		{ limit: 604800, divisor: 86400, unit: 'day' },
		{ limit: 2629800, divisor: 604800, unit: 'week' },
		{ limit: 31557600, divisor: 2629800, unit: 'month' },
	];

	for (const { limit, divisor, unit } of ranges) {
		if (absSeconds < limit) {
			const value = Math.round(diffSeconds / divisor);
			return formatter ? formatter.format(value, unit) : describeRelativeFallback(value, unit);
		}
	}

	const years = Math.round(diffSeconds / 31557600);
	return formatter ? formatter.format(years, 'year') : describeRelativeFallback(years, 'year');
}

function describeRelativeFallback(value, unit) {
	const absolute = Math.abs(value);
	if (absolute === 0) {
		return 'just now';
	}
	const suffix = absolute === 1 ? unit : `${unit}s`;
	return value <= 0 ? `${absolute} ${suffix} ago` : `in ${absolute} ${suffix}`;
}

function parseDurationSeconds(value) {
	if (value == null) {
		return Number.NaN;
	}

	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : Number.NaN;
	}

	const trimmed = String(value).trim();
	if (!trimmed) {
		return Number.NaN;
	}

	const numeric = Number(trimmed);
	if (Number.isFinite(numeric)) {
		return numeric;
	}

	if (!trimmed.startsWith('PT')) {
		return Number.NaN;
	}

	const isoBody = trimmed.slice(2);
	const isoPattern = /(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
	const [, hoursRaw, minutesRaw, secondsRaw] = isoPattern.exec(isoBody) || [];
	const hours = Number(hoursRaw || 0);
	const minutes = Number(minutesRaw || 0);
	const seconds = Number(secondsRaw || 0);

	return (hours * 3600) + (minutes * 60) + seconds;
}

function formatDurationLabel(seconds) {
	if (!Number.isFinite(seconds) || seconds <= 0) {
		return '';
	}

	const totalSeconds = Math.floor(seconds);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const secs = totalSeconds % 60;

	const parts = [];
	if (hours > 0) {
		parts.push(String(hours));
		parts.push(String(minutes).padStart(2, '0'));
	} else {
		parts.push(String(minutes));
	}
	parts.push(String(secs).padStart(2, '0'));

	return parts.join(':');
}

function openBlogModal(trigger) {
	const slug = trigger.getAttribute('data-blog-open');
	const template = document.getElementById(`blog-template-${slug}`);
	if (!template) {
		return;
	}

	blogViewerState.activeSlug = slug;
	blogViewerState.activeTrigger = trigger;
	const hasLegacyComments = Boolean(
		blogViewerState.commentForm || blogViewerState.commentList || blogViewerState.commentStatus,
	);

	if (blogViewerState.contentHost) {
		blogViewerState.contentHost.innerHTML = '';
		const articleFragment = template.content.cloneNode(true);
		blogViewerState.contentHost.appendChild(articleFragment);
	}

	const shareButton = blogViewerState.contentHost?.querySelector('[data-article-share]');
	setupShareButton(shareButton, slug);

	const heading = blogViewerState.contentHost?.querySelector('h1');
	if (heading) {
		if (!heading.id) {
			heading.id = `blog-reader-heading-${slug}`;
		}
		if (!heading.hasAttribute('tabindex')) {
			heading.setAttribute('tabindex', '-1');
		}
	}

	if (blogViewerState.readerTitle) {
		blogViewerState.readerTitle.textContent = heading?.textContent?.trim() || 'Selected Post';
	}

	if (blogViewerState.commentForm) {
		blogViewerState.commentForm.reset();
		blogViewerState.commentForm.dataset.slug = slug;
	}

	blogViewerState.container?.classList.add('is-open');
	blogViewerState.container?.removeAttribute('hidden');
	blogViewerState.container?.setAttribute('aria-expanded', 'true');
	blogViewerState.container?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	if (heading) {
		heading.focus({ preventScroll: true });
	}

	if (hasLegacyComments) {
		renderComments([]);
		setCommentStatus('Loading comments…', 'loading');
		loadComments(slug);
	}
}

function closeBlogModal() {
	if (!blogViewerState.container?.classList.contains('is-open')) {
		return;
	}

	blogViewerState.container.classList.remove('is-open');
	blogViewerState.container.setAttribute('hidden', 'hidden');
	blogViewerState.container.removeAttribute('aria-expanded');

	if (blogViewerState.contentHost) {
		blogViewerState.contentHost.innerHTML = '';
	}

	blogViewerState.activeSlug = null;
	blogViewerState.currentComments = [];
	toggleCommentEmpty(true);
	setCommentStatus(blogViewerState.defaultStatusMessage || 'Powered by Commento');

	if (blogViewerState.activeTrigger) {
		blogViewerState.activeTrigger.focus();
		blogViewerState.activeTrigger = null;
	}
}

function initShareButtons() {
	const shareButtons = document.querySelectorAll('[data-article-share]');
	shareButtons.forEach((button) => {
		const slugAttr = button.getAttribute('data-share-slug') || '';
		setupShareButton(button, slugAttr);
	});
}

function setupShareButton(button, slugFromContext = '') {
	if (!button || button.dataset.shareBound === 'true') {
		return;
	}

	const defaultLabel = button.textContent?.trim() || 'Share';
	button.dataset.shareDefault = defaultLabel;
	button.dataset.shareBound = 'true';
	button.setAttribute('type', button.getAttribute('type') || 'button');

	button.addEventListener('click', async () => {
		const explicitUrl = button.getAttribute('data-share-url') || '';
		const shareSlug = button.getAttribute('data-share-slug') || slugFromContext;
		const shareUrl = explicitUrl || resolveShareUrl(shareSlug);
		const successLabel = button.getAttribute('data-share-success') || 'Link copied!';
		const errorLabel = button.getAttribute('data-share-error') || 'Copy failed';
		const labelTarget = button.querySelector('[data-share-label]') || button;

		try {
			await copyTextToClipboard(shareUrl);
			updateShareLabel(button, labelTarget, successLabel);
		} catch (error) {
			updateShareLabel(button, labelTarget, errorLabel);
		}
	});
}

async function copyTextToClipboard(text) {
	if (!text) {
		throw new Error('Nothing to copy');
	}

	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}

	const textarea = document.createElement('textarea');
	textarea.value = text;
	textarea.setAttribute('readonly', '');
	textarea.style.position = 'fixed';
	textarea.style.opacity = '0';
	textarea.style.pointerEvents = 'none';
	document.body.appendChild(textarea);
	textarea.focus();
	textarea.select();

	let successful = false;
	try {
		successful = document.execCommand('copy');
	} finally {
		document.body.removeChild(textarea);
	}

	if (!successful) {
		throw new Error('Fallback copy command failed');
	}
}

function updateShareLabel(button, target, message) {
	const defaultLabel = button.dataset.shareDefault || 'Share';
	target.textContent = message;
	clearTimeout(button._shareResetTimer);
	button._shareResetTimer = window.setTimeout(() => {
		target.textContent = defaultLabel;
	}, 2200);
}

function resolveShareUrl(slug) {
	const hasSlug = Boolean(slug);
	try {
		const base = new URL('blog.html', window.location.href);
		base.hash = hasSlug ? slug : '';
		return base.href;
	} catch (error) {
		if (hasSlug) {
			return `blog.html#${slug}`;
		}
		return window.location?.href || '';
	}
}


async function loadComments(slug) {
	const fallback = readLocalComments(slug);

	try {
		const response = await fetch(`${COMMENTS_API_URL}?slug=${encodeURIComponent(slug)}`, {
			method: 'GET',
			headers: { Accept: 'application/json' },
		});

		if (!response.ok) {
			throw new Error(`Request failed with status ${response.status}`);
		}

		const payload = await response.json().catch(() => null);
		const comments = normalizeComments(payload?.comments);
		renderComments(comments);
		writeLocalComments(slug, comments);
		if (comments.length) {
			setCommentStatus(`${comments.length} comment${comments.length === 1 ? '' : 's'}`, 'success');
		} else {
			setCommentStatus('No comments yet. Be the first to share your thoughts.', 'idle');
		}
	} catch (error) {
		renderComments(fallback);
		if (fallback.length) {
			setCommentStatus('Showing comments saved on this device. Connect the comments API to sync.', 'warning');
		} else {
			setCommentStatus('Comments will appear here once the API is configured.', 'warning');
		}
	}
}

function renderComments(comments = []) {
	if (!blogViewerState.commentList) {
		return;
	}

	blogViewerState.commentList.innerHTML = '';
	blogViewerState.currentComments = Array.isArray(comments) ? [...comments] : [];

	const hasComments = blogViewerState.currentComments.length > 0;
	blogViewerState.commentList.hidden = !hasComments;
	toggleCommentEmpty(!hasComments);

	if (!hasComments) {
		return;
	}

	blogViewerState.currentComments
		.sort((a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0))
		.forEach((comment) => {
			const item = document.createElement('li');
			item.className = 'comment-item';
			const createdAt = comment.createdAt || comment.timestamp || new Date().toISOString();
			item.innerHTML = `
				<div class="comment-item__meta">
					<span class="comment-item__author">${escapeHtml(comment.author ?? 'Anonymous')}</span>
					<time class="comment-item__timestamp" datetime="${escapeHtml(createdAt)}">${formatRelativeTime(createdAt)}</time>
				</div>
				<p class="comment-item__message">${formatCommentBody(comment.message ?? '')}</p>
			`;
			blogViewerState.commentList?.appendChild(item);
		});
}

function toggleCommentEmpty(show) {
	if (!blogViewerState.commentEmpty) {
		return;
	}

	blogViewerState.commentEmpty.hidden = !show;
}

function setCommentStatus(message, tone = 'idle') {
	const statusElement = blogViewerState.commentStatus;
	if (!statusElement) {
		return;
	}

	const text = message || blogViewerState.defaultStatusMessage || '';
	statusElement.textContent = text;
	statusElement.className = 'comments-status';
	if (tone && tone !== 'idle') {
		statusElement.classList.add(`comments-status--${tone}`);
	}
}

async function handleCommentSubmit(event) {
	event.preventDefault();

	if (!blogViewerState.commentForm || !blogViewerState.activeSlug) {
		return;
	}

	const formData = new FormData(blogViewerState.commentForm);
	const author = formData.get('commentName')?.toString().trim() ?? '';
	const message = formData.get('commentMessage')?.toString().trim() ?? '';

	if (!message) {
		setCommentStatus('Please share a message before posting.', 'error');
		return;
	}

	const commentDraft = {
		id: generateCommentId(),
		slug: blogViewerState.activeSlug,
		author: author || 'Anonymous',
		message,
		createdAt: new Date().toISOString(),
	};

	setCommentFormBusy(true);

	try {
		const response = await fetch(COMMENTS_API_URL, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(commentDraft),
		});

		if (!response.ok) {
			throw new Error(`Request failed with status ${response.status}`);
		}

		const payload = await response.json().catch(() => null);
		const savedComment = normalizeComments([payload?.comment ?? commentDraft])[0] ?? commentDraft;
		appendComment(savedComment);
		writeLocalComment(blogViewerState.activeSlug, savedComment);
		blogViewerState.commentForm.reset();
		setCommentStatus('Comment posted! Thanks for joining the discussion.', 'success');
	} catch (error) {
		appendComment(commentDraft);
		writeLocalComment(blogViewerState.activeSlug, commentDraft);
		setCommentStatus('Comment saved locally. Connect the comments API to sync automatically.', 'warning');
	} finally {
		setCommentFormBusy(false);
	}
}

function appendComment(comment) {
	const existing = blogViewerState.currentComments ?? [];
	const comments = [...existing.filter((entry) => entry.id !== comment.id), comment];
	renderComments(comments);
}

function setCommentFormBusy(isBusy) {
	if (!blogViewerState.commentForm || !blogViewerState.submitButton) {
		return;
	}

	blogViewerState.submitButton.disabled = isBusy;
	blogViewerState.submitButton.textContent = isBusy ? 'Posting…' : 'Post Comment';
}

function normalizeComments(maybeComments) {
	if (!Array.isArray(maybeComments)) {
		return [];
	}

	return maybeComments
		.map((comment) => ({
			id: comment?.id ?? generateCommentId(),
			author: comment?.author?.toString().trim() || 'Anonymous',
			message: comment?.message?.toString().trim() || '',
			createdAt: comment?.createdAt ?? comment?.timestamp ?? new Date().toISOString(),
		}))
		.filter((comment) => comment.message.length > 0);
}

function escapeHtml(value) {
	return (value ?? '')
		.toString()
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function formatCommentBody(text) {
	return escapeHtml(text).replace(/\n/g, '<br>');
}

function readLocalCommentsMap() {
	try {
		const stored = localStorage.getItem(COMMENTS_STORAGE_KEY);
		return stored ? JSON.parse(stored) : {};
	} catch (error) {
		return {};
	}
}

function writeLocalCommentsMap(map) {
	try {
		localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(map));
	} catch (error) {
		// Ignore persistence issues (private browsing, etc.)
	}
}

function readLocalComments(slug) {
	const map = readLocalCommentsMap();
	return normalizeComments(map?.[slug] ?? []);
}

function writeLocalComments(slug, comments) {
	const map = readLocalCommentsMap();
	map[slug] = comments;
	writeLocalCommentsMap(map);
}

function writeLocalComment(slug, comment) {
	const map = readLocalCommentsMap();
	const existing = Array.isArray(map[slug]) ? map[slug] : [];
	map[slug] = [...existing.filter((entry) => entry.id !== comment.id), comment];
	writeLocalCommentsMap(map);
}

function generateCommentId() {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}

	return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function injectAnalytics() {
	if (window.__coolmanAnalyticsLoaded) {
		return;
	}

	const load = async () => {
		try {
			const module = await import(ANALYTICS_MODULE_URL);
			if (module?.inject) {
				module.inject();
				window.__coolmanAnalyticsLoaded = true;
			}
		} catch (error) {
			console.info('Vercel Analytics unavailable:', error);
		}
	};

	if ('requestIdleCallback' in window) {
		window.requestIdleCallback(load, { timeout: 2000 });
	} else {
		setTimeout(load, 0);
	}
}
