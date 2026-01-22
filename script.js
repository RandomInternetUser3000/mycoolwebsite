const ver = "Version 1.0.26";
const COMMENTS_API_URL = '/api/comments';
const COMMENTS_STORAGE_KEY = 'coolman-comments';
const DEFAULT_SITE_SETTINGS = {
	releaseCountdownTarget: '2025-12-05T22:00:00Z',
	bannerEnabled: false,
	bannerText: '🎉 Website Release!',
	bannerLink: 'https://github.com/COOLmanYT/mycoolwebsite',
	bannerButtonText: 'Open Source Repo',
	countdownEnabled: false, //you can make the countdown a comment if this fails
	countdownHeading: 'Release Countdown',
	countdownNote: '',
};
const SITE_SETTINGS_PATH = '/api/admin/site-settings';
let siteSettings = { ...DEFAULT_SITE_SETTINGS };
const ANALYTICS_MODULE_URL = 'https://v.vercel-scripts.com/v1/script.js';
const VERCEL_ANALYTICS_MODULE_ESM = 'https://unpkg.com/@vercel/analytics@latest/dist/analytics.mjs';
const MAILERLITE_ACCOUNT_ID = '2039610';
let mailerLiteQueued = false;
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

const projectViewerState = {
	container: null,
	closeButton: null,
	title: null,
	contentHost: null,
	shareButton: null,
	activeSlug: null,
	activeTrigger: null,
};

let cachedAuthState = null;
let authStatePromise = null;

function setAuthStateCache(state) {
	cachedAuthState = state;
	window.coolmanAuthState = state;
	try {
		document.dispatchEvent(new CustomEvent('coolmanyt:auth-state', { detail: state }));
	} catch (error) {
		console.warn('Auth event dispatch failed', error);
	}
}

async function fetchSessionState() {
	try {
		const res = await fetch('/api/session', { headers: { Accept: 'application/json' } });
		if (!res.ok) {
			throw new Error(`Session request failed (${res.status})`);
		}
		const data = await res.json();
		const login = data?.user?.login || '';
		const allowlist = Array.isArray(data?.allowlist) ? data.allowlist : [];
		const allowlisted = Boolean(data?.authenticated && login && allowlist.includes(login));
		return {
			authenticated: Boolean(data?.authenticated),
			allowlisted,
			hasSessionCookie: Boolean(data?.hasSessionCookie),
			login,
			avatarUrl: data?.user?.avatarUrl || '',
			allowlistSource: data?.allowlistSource || '',
			error: null,
		};
	} catch (error) {
		const message = error?.message || 'Session lookup failed';
		return {
			authenticated: false,
			allowlisted: false,
			hasSessionCookie: false,
			login: '',
			avatarUrl: '',
			allowlistSource: '',
			error: message,
		};
	}
}

async function getAuthState(options = {}) {
	if (!options.force && cachedAuthState) {
		return cachedAuthState;
	}
	if (!options.force && authStatePromise) {
		return authStatePromise;
	}
	authStatePromise = fetchSessionState();
	const state = await authStatePromise;
	authStatePromise = null;
	setAuthStateCache(state);
	return state;
}

function resolveAuthIcon(state) {
	const icons = {
		success: '/images/github-success.png',
		warning: '/images/github-warning.png',
		cookie: '/images/github-cookie.png',
		signin: '/images/github-signin.png',
		error: '/images/github-error.png',
	};

	if (!state) {
		return { src: icons.signin, label: 'Sign in with GitHub' };
	}
	if (state.error) {
		return { src: icons.error, label: state.error };
	}
	if (state.authenticated && state.allowlisted) {
		return { src: icons.success, label: 'Signed in with GitHub (allowlisted).' };
	}
	if (state.authenticated && !state.allowlisted) {
		return { src: icons.warning, label: 'Signed in with GitHub but not on the allowlist.' };
	}
	if (!state.authenticated && state.hasSessionCookie) {
		return { src: icons.cookie, label: 'GitHub session cookie detected. Sign in to continue.' };
	}
	return { src: icons.signin, label: 'Sign in with GitHub' };
}

function renderHeaderAuthIndicator(state) {
	const headerBar = document.querySelector('.header-bar');
	if (!headerBar) {
		return;
	}

	if (!state?.authenticated) {
		const existing = headerBar.querySelector('[data-auth-indicator]');
		if (existing) {
			existing.remove();
		}
		return;
	}

	let indicator = headerBar.querySelector('[data-auth-indicator]');
	if (!indicator) {
		indicator = document.createElement('div');
		indicator.className = 'auth-indicator';
		indicator.setAttribute('data-auth-indicator', 'true');
		indicator.setAttribute('role', 'status');
		indicator.setAttribute('aria-live', 'polite');
		indicator.innerHTML = `
			<img data-auth-icon alt="" aria-hidden="false">
			<button type="button" class="button button--ghost button--tiny auth-signout" data-auth-signout hidden>Sign out</button>
		`;
		const logo = headerBar.querySelector('.site-logo');
		if (logo) {
			headerBar.insertBefore(indicator, logo);
		} else {
			headerBar.appendChild(indicator);
		}
	}

	const iconEl = indicator.querySelector('[data-auth-icon]');
	const signOutBtn = indicator.querySelector('[data-auth-signout]');
	const icon = resolveAuthIcon(state);
	if (iconEl) {
		iconEl.src = icon.src;
		iconEl.alt = icon.label;
		iconEl.title = icon.label;
		iconEl.setAttribute('aria-label', icon.label);
		iconEl.hidden = false;
	}
	if (signOutBtn) {
		signOutBtn.hidden = !state?.authenticated;
		if (!signOutBtn.dataset.bound) {
			signOutBtn.addEventListener('click', handleGlobalSignOut);
			signOutBtn.dataset.bound = 'true';
		}
	}
}

function renderContactAuthBadge(state) {
	const heading = document.querySelector('.contact-section h2');
	if (!heading) {
		return;
	}
	const shouldShow = Boolean(state?.authenticated);
	let badge = heading.querySelector('[data-contact-auth-badge]');
	if (!shouldShow) {
		if (badge) {
			badge.remove();
		}
		return;
	}
	if (!badge) {
		badge = document.createElement('img');
		badge.setAttribute('data-contact-auth-badge', 'true');
		badge.className = 'contact-auth-badge';
		heading.appendChild(badge);
	}
	const icon = resolveAuthIcon(state || { authenticated: false });
	badge.src = icon.src;
	badge.alt = icon.label || 'Signed in with GitHub';
	badge.title = icon.label || 'Signed in with GitHub';
	badge.hidden = false;
}

async function handleGlobalSignOut(event) {
	if (event) {
		event.preventDefault();
	}
	try {
		await fetch('/api/auth/logout', { method: 'POST' });
	} catch (error) {
		console.warn('Logout failed', error);
	} finally {
		window.location.reload();
	}
}

async function initAuthIndicators(initialState = null) {
	const state = initialState || (await getAuthState().catch(() => null));
	renderHeaderAuthIndicator(state);
	renderContactAuthBadge(state);
}

document.addEventListener('coolmanyt:auth-state', (event) => {
	renderHeaderAuthIndicator(event.detail);
	renderContactAuthBadge(event.detail);
});

enforceHtmlExtensionRedirect();

const CHANNEL_ID_CACHE = new Map();

const THEME_STORAGE_KEY = 'coolman-theme';

document.addEventListener('DOMContentLoaded', async () => {
	applyInitialTheme();
	setupThemeToggle();
	fadeInPage();
	applySiteVersion();
	const authState = await getAuthState().catch((error) => {
		console.warn('Auth state unavailable', error);
		return cachedAuthState;
	});
	initAuthIndicators(authState);
	enableContactForm(authState);
	enhanceSocialButtons();
	decorateExternalLinks();
	enableHorizontalScrollNav();
	initNavGradient();
	initSubscribeGlow();
	prepareTopBanner();
	initLazySections();
	initLazyMailerLite();
	initLatestBlogCard();

	if (document.querySelector('[data-project-open]')) {
		initProjectViewer();
	}
	if (document.querySelector('[data-blog-open]')) {
		initBlogViewer();
	}

	await hydrateSiteSettings();
	applyTopBannerSettings();
	initReleaseCountdown();
	// Latest video loads when its section is visible.
	initShareButtons();
	injectAnalytics();
});

function initLazySections() {
	const observer = new IntersectionObserver((entries, obs) => {
		entries.forEach((entry) => {
			if (!entry.isIntersecting) return;
			const target = entry.target;
			if ('lazySpotify' in target.dataset) {
				mountSpotifyEmbed(target);
				obs.unobserve(target);
			}
			if ('latestVideo' in target.dataset) {
				initLatestUploadCard();
				obs.unobserve(target);
			}
		});
	}, { rootMargin: '150px 0px 150px 0px', threshold: 0.1 });

	const spotifyHost = document.querySelector('[data-lazy-spotify]');
	if (spotifyHost) {
		observer.observe(spotifyHost);
		const button = spotifyHost.querySelector('[data-spotify-load]');
		if (button) {
			button.addEventListener('click', () => {
				mountSpotifyEmbed(spotifyHost);
				observer.unobserve(spotifyHost);
			});
		}
	}

	const latestVideoSection = document.querySelector('[data-latest-video]');
	if (latestVideoSection) {
		observer.observe(latestVideoSection);
	}
}

function queueMailerLite() {
	if (mailerLiteQueued) {
		return;
	}
	mailerLiteQueued = true;
	(function (w, d, e, u, f, l, n) {
		w[f] = w[f] || function () {
			(w[f].q = w[f].q || []).push(arguments);
		};
		l = d.createElement(e);
		l.async = 1;
		l.src = u;
		n = d.getElementsByTagName(e)[0];
		n.parentNode.insertBefore(l, n);
	})(window, document, 'script', 'https://assets.mailerlite.com/js/universal.js', 'ml');

	if (typeof window.ml === 'function') {
		window.ml('account', MAILERLITE_ACCOUNT_ID);
	}
}

function initLazyMailerLite() {
	const embeds = document.querySelectorAll('.ml-embedded');
	if (!embeds.length) {
		return;
	}

	const loadMailerLite = () => queueMailerLite();

	if ('IntersectionObserver' in window) {
		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) return;
				loadMailerLite();
				observer.disconnect();
			});
		}, { rootMargin: '200px 0px' });
		embeds.forEach((embed) => observer.observe(embed));
		return;
	}

	loadMailerLite();
}

function mountSpotifyEmbed(container) {
	if (!container || container.dataset.spotifyMounted === 'true') {
		return;
	}
	const src = container.getAttribute('data-spotify-src');
	if (!src) {
		return;
	}
	const iframe = document.createElement('iframe');
	iframe.title = 'Spotify playlist: Deep Focus by COOLmanYT';
	iframe.style.borderRadius = '12px';
	iframe.src = src;
	iframe.width = '100%';
	iframe.height = '480';
	iframe.frameBorder = '0';
	iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
	iframe.loading = 'lazy';
	container.replaceChildren(iframe);
	container.dataset.spotifyMounted = 'true';
}

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

function enforceHtmlExtensionRedirect() {
	try {
		const path = window.location.pathname;
		if (path === '/' || path.endsWith('.html')) {
			return;
		}
		const lastSegment = path.split('/').filter(Boolean).pop() || '';
		const hasExtension = lastSegment.includes('.');
		const endsWithSlash = path.endsWith('/');
		if (hasExtension || endsWithSlash) {
			return;
		}
		const target = `${path}.html${window.location.search}${window.location.hash}`;
		window.location.replace(target);
	} catch (error) {
		console.warn('HTML extension redirect failed', error);
	}
}

async function hydrateSiteSettings() {
	try {
		const res = await fetch(`${SITE_SETTINGS_PATH}?ts=${Date.now()}`);
		if (!res.ok) {
			throw new Error(`Site settings fetch failed (${res.status})`);
		}
		const payload = await res.json();
		const data = payload?.data ?? payload;
		if (data && typeof data === 'object') {
			siteSettings = { ...DEFAULT_SITE_SETTINGS, ...data };
		}
	} catch (error) {
		console.warn('Falling back to default site settings', error);
		siteSettings = { ...DEFAULT_SITE_SETTINGS };
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

function enableHorizontalScrollNav() {
	const navWrappers = document.querySelectorAll('.nav-wrapper');
	if (!navWrappers.length) {
		return;
	}

	navWrappers.forEach((wrapper) => {
		if (wrapper.dataset.horizontalScrollBound === 'true') {
			return;
		}

		const handleWheel = (event) => {
			const hasOverflow = wrapper.scrollWidth > wrapper.clientWidth + 1;
			if (!hasOverflow) {
				return;
			}

			const verticalIntent = Math.abs(event.deltaY) >= Math.abs(event.deltaX);
			if (!verticalIntent) {
				return;
			}

			event.preventDefault();
			const scrollAmount = event.deltaY;
			wrapper.scrollBy({ left: scrollAmount, behavior: 'auto' });
		};

		wrapper.addEventListener('wheel', handleWheel, { passive: false });
		wrapper.dataset.horizontalScrollBound = 'true';
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

async function enableContactForm(initialAuthState) {
	const contactForm = document.getElementById('contactForm');
	if (!contactForm) {
		return;
	}

	const statusElement = document.getElementById('formStatus');
	const successElement = document.getElementById('formSuccess');
	const cooldownElement = document.getElementById('formCooldown');
	const ageCheckbox = document.getElementById('over13');
	const consentCheckbox = document.getElementById('dataConsent');
	const submitButton = contactForm.querySelector('button[type="submit"]');
	const redirectInput = contactForm.querySelector('input[name="_redirect"]');
	const endpoint = contactForm.getAttribute('action');

	if (statusElement) {
		statusElement.setAttribute('role', 'status');
		statusElement.setAttribute('aria-live', 'polite');
	}

	if (!submitButton) {
		return;
	}

	let allowlistBypass = Boolean(initialAuthState?.authenticated && initialAuthState?.allowlisted);
	let authState = initialAuthState || null;
	const resolveAllowlistBypass = async () => {
		if (allowlistBypass) return allowlistBypass;
		authState = authState || (await getAuthState().catch(() => null));
		allowlistBypass = Boolean(authState?.authenticated && authState?.allowlisted);
		return allowlistBypass;
	};

	await resolveAllowlistBypass();
	if (allowlistBypass) {
		if (contactForm.hidden) {
			contactForm.hidden = false;
		}
		if (cooldownElement) {
			cooldownElement.hidden = true;
			cooldownElement.textContent = '';
		}
	}

	const getCooldownInfo = () => {
		const entry = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith('form_sent='));
		if (!entry) return null;
		const value = entry.split('=')[1];
		const expiresAt = Number(value);
		if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
			return { expiresAt };
		}
		return null;
	};

	const formatCooldownMessage = (expiresAt) => {
		const remainingMs = expiresAt - Date.now();
		const remainingHours = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60)));
		const detectedZone = Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || '';
		const fallbackZone = 'Australia/Sydney'; // AEDT/AEST fallback per request
		const finalZone = detectedZone || fallbackZone;
		const formatOptions = {
			timeZone: finalZone,
			dateStyle: 'short',
			timeStyle: 'medium',
			timeZoneName: 'short',
		};
		let formatted = '';
		try {
			formatted = new Intl.DateTimeFormat('en-AU', formatOptions).format(new Date(expiresAt));
		} catch (error) {
			formatted = new Date(expiresAt).toLocaleString('en-GB', { timeZone: 'UTC', timeZoneName: 'short' });
		}
		return `You can send another message in about ${remainingHours} hour${remainingHours === 1 ? '' : 's'} (after ${formatted}).`;
	};

	const setCooldown = () => {
		const expiresAt = Date.now() + 86_400_000;
		document.cookie = `form_sent=${expiresAt}; max-age=86400; path=/; SameSite=Lax`;
		return expiresAt;
	};

	const showCooldownState = (info) => {
		if (allowlistBypass) {
			return;
		}
		contactForm.hidden = true;
		if (cooldownElement) {
			cooldownElement.textContent = info?.expiresAt ? formatCooldownMessage(info.expiresAt) : 'You can only send one message per day. Please try again later.';
			cooldownElement.hidden = false;
		}
	};

	const initialCooldown = getCooldownInfo();
	if (initialCooldown && !allowlistBypass) {
		showCooldownState(initialCooldown);
		return;
	}

	const clearMessages = () => {
		if (statusElement) {
			statusElement.textContent = '';
			statusElement.classList.remove('success', 'error');
			statusElement.hidden = true;
		}
		if (successElement) {
			successElement.hidden = true;
		}
		if (cooldownElement && allowlistBypass) {
			cooldownElement.hidden = true;
		}
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		clearMessages();

		const fallbackToNativeSubmit = (notice = 'Opening Formspree to complete the CAPTCHA…') => {
			if (statusElement) {
				statusElement.textContent = notice;
				statusElement.classList.remove('success', 'error');
				statusElement.hidden = false;
			}
			submitButton.disabled = false;
			submitButton.textContent = 'Send Message';
			contactForm.removeEventListener('submit', handleSubmit);
			if (!allowlistBypass) {
				setCooldown();
			}
			window.setTimeout(() => contactForm.submit(), 10);
		};

		if (!ageCheckbox?.checked) {
			window.alert("To comply with privacy laws, I can't collect data from users under 13. Please ask a parent to send this message for you!");
			return;
		}

		if (consentCheckbox && !consentCheckbox.checked) {
			if (statusElement) {
				statusElement.textContent = 'Please provide consent to use this info to reply.';
				statusElement.classList.add('error');
				statusElement.hidden = false;
			}
			return;
		}

		if (!endpoint) {
			return;
		}

		const formData = new FormData(contactForm);

		submitButton.disabled = true;
		submitButton.textContent = 'Sending...';
		if (statusElement) {
			statusElement.textContent = '';
			statusElement.classList.remove('success', 'error');
			statusElement.hidden = true;
		}

		try {
			formData.append('_subject', 'Website contact form');
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
				},
				body: formData,
			});

			if (response.ok) {
				const redirectUrl = redirectInput?.value?.trim() || '';
				let expiresAt = null;
				if (!allowlistBypass) {
					expiresAt = setCooldown();
				}
				if (redirectUrl) {
					window.location.assign(redirectUrl);
					return;
				}
				if (successElement) {
					successElement.hidden = false;
					if (allowlistBypass) {
						successElement.textContent = 'Message sent! You are allowlisted, so no cooldown applies.';
					}
				}
				if (statusElement) {
					statusElement.textContent = '';
					statusElement.classList.remove('error');
					statusElement.hidden = true;
				}
				contactForm.reset();
				if (!allowlistBypass) {
					showCooldownState({ expiresAt });
				} else {
					submitButton.disabled = false;
					submitButton.textContent = 'Send Message';
				}
				return;
			}

			const data = await response.json().catch(() => null);
			const serverError = data?.errors?.[0]?.message;
			const errorMessage = serverError || `Something went wrong (status ${response.status}). Please try again later.`;
			const shouldFallback = response.status === 403 || response.status === 422 || response.type === 'opaqueredirect';
			if (shouldFallback) {
				fallbackToNativeSubmit('Opening Formspree to complete verification…');
				return;
			}
			if (statusElement) {
				statusElement.textContent = errorMessage;
				statusElement.classList.add('error');
				statusElement.hidden = false;
			}
			submitButton.disabled = false;
			submitButton.textContent = 'Send Message';
		} catch (error) {
			console.warn('Contact form fetch failed', error);
			if (statusElement) {
				statusElement.textContent = 'Network error. Please try again later.';
				statusElement.classList.add('error');
				statusElement.hidden = false;
			}
			submitButton.disabled = false;
			submitButton.textContent = 'Send Message';
		}
	};

	contactForm.addEventListener('submit', handleSubmit);
}

function ensureMaterialSymbols() {
	if (document.querySelector('link[data-material-symbols]')) {
		return;
	}
	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href =
		'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=arrow_outward,open_in_new';
	link.setAttribute('data-material-symbols', 'true');
	document.head.appendChild(link);
}

function decorateExternalLinks() {
	ensureMaterialSymbols();
	const anchors = Array.from(document.querySelectorAll('a[href]'));
	anchors.forEach((anchor) => {
		if (anchor.dataset.noExternalIcon === 'true') {
			return;
		}

		if (anchor.closest('.site-footer') || anchor.closest('.social-links')) {
			return;
		}

		const href = anchor.getAttribute('href');
		if (!href || href.startsWith('#')) {
			return;
		}

		let url;
		try {
			url = new URL(href, window.location.href);
		} catch (error) {
			return;
		}

		const isMail = href.startsWith('mailto:');
		const isTel = href.startsWith('tel:');
		const isSameOrigin = url.origin === window.location.origin;
		if (!isMail && !isTel && isSameOrigin) {
			return;
		}

		if (anchor.querySelector('.external-icon')) {
			return;
		}

		const opensNew = anchor.target === '_blank';
		const icon = document.createElement('span');
		icon.className = 'material-symbols-outlined external-icon';
		icon.textContent = opensNew || isMail || isTel ? 'open_in_new' : 'arrow_outward';
		icon.setAttribute('aria-hidden', 'true');
		anchor.appendChild(icon);

		if (!anchor.getAttribute('aria-label')) {
			const labelText = anchor.textContent?.trim();
			if (labelText) {
				const descriptor = opensNew || isMail || isTel ? 'opens in a new tab or app' : 'opens an external site';
				anchor.setAttribute('aria-label', `${labelText} (${descriptor})`);
			}
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

function initProjectViewer() {
	const container = document.querySelector('[data-project-viewer]');
	if (!container) {
		return;
	}

	const triggers = document.querySelectorAll('[data-project-open]');
	if (!triggers.length) {
		return;
	}

	projectViewerState.container = container;
	projectViewerState.closeButton = container.querySelector('[data-project-close]');
	projectViewerState.title = container.querySelector('[data-project-title]');
	projectViewerState.contentHost = container.querySelector('[data-project-content]');
	projectViewerState.shareButton = container.querySelector('[data-project-toolbar-share]');

	triggers.forEach((trigger) => {
		trigger.setAttribute('aria-haspopup', 'dialog');
		trigger.setAttribute('aria-expanded', 'false');
		trigger.style.cursor = trigger.style.cursor || 'pointer';
		trigger.addEventListener('click', (event) => {
			if (event.defaultPrevented) {
				return;
			}
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
				return;
			}
			event.preventDefault();
			openProjectViewer(trigger);
		});
	});

	projectViewerState.closeButton?.addEventListener('click', () => {
		closeProjectViewer();
	});

	container.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			closeProjectViewer();
		}
	});

	projectViewerState.contentHost?.addEventListener('click', (event) => {
		const closestClose = event.target.closest('[data-project-close-inline]');
		if (closestClose) {
			event.preventDefault();
			closeProjectViewer();
		}
	});

	const applyHashState = () => {
		const hashSlug = window.location.hash?.replace(/^#/, '') ?? '';
		if (!hashSlug) {
			if (projectViewerState.activeSlug) {
				closeProjectViewer({ skipHashReset: true });
			}
			return;
		}

		const hashTrigger = document.querySelector(`[data-project-open="${hashSlug}"]`);
		const templateExists = Boolean(document.getElementById(`project-template-${hashSlug}`));
		if (hashTrigger && templateExists) {
			openProjectViewer(hashTrigger, { skipHashUpdate: true });
		} else if (projectViewerState.activeSlug) {
			closeProjectViewer({ skipHashReset: true });
		}
	};

	window.addEventListener('hashchange', applyHashState);

	applyHashState();
}

function openProjectViewer(trigger, options = {}) {
	const slug = trigger.getAttribute('data-project-open');
	if (!slug || projectViewerState.activeSlug === slug) {
		return;
	}

	const template = document.getElementById(`project-template-${slug}`);
	if (!template) {
		return;
	}

	const previousTrigger = projectViewerState.activeTrigger;
	projectViewerState.activeSlug = slug;
	projectViewerState.activeTrigger = trigger;
	if (previousTrigger && previousTrigger !== trigger) {
		previousTrigger.setAttribute('aria-expanded', 'false');
	}

	if (projectViewerState.contentHost) {
		projectViewerState.contentHost.innerHTML = '';
		const fragment = template.content.cloneNode(true);
		projectViewerState.contentHost.appendChild(fragment);
	}

	const article = projectViewerState.contentHost?.querySelector('.project-detail');
	if (article && !article.id) {
		article.id = slug;
	}

	const heading = article?.querySelector('h1');
	if (heading) {
		if (!heading.id) {
			heading.id = `${slug}-heading`;
		}
		if (!heading.hasAttribute('tabindex')) {
			heading.setAttribute('tabindex', '-1');
		}
	}

	if (projectViewerState.title) {
		projectViewerState.title.textContent = heading?.textContent?.trim() || 'Selected Project';
	}

	if (projectViewerState.shareButton) {
		const toolbarShare = projectViewerState.shareButton;
		const shareBase = toolbarShare.getAttribute('data-share-base') || 'projects.html';
		const shareUrl = resolveShareUrl(slug, shareBase);
		toolbarShare.setAttribute('data-share-base', shareBase);
		toolbarShare.setAttribute('data-share-slug', slug);
		toolbarShare.setAttribute('data-share-url', shareUrl);
		window.clearTimeout(toolbarShare._shareResetTimer);
		const shareLabelTarget = toolbarShare.querySelector('[data-share-label]');
		const defaultLabel = toolbarShare.dataset.shareDefault || shareLabelTarget?.textContent?.trim() || 'Share';
		if (!toolbarShare.dataset.shareDefault) {
			toolbarShare.dataset.shareDefault = defaultLabel;
		}
		if (shareLabelTarget) {
			shareLabelTarget.textContent = defaultLabel;
		} else {
			toolbarShare.textContent = defaultLabel;
		}
		if (toolbarShare.dataset.shareBound === 'true') {
			// Already bound from a previous open; nothing further.
		} else {
			setupShareButton(toolbarShare, slug, shareBase);
		}
	}

	const shareButtons = projectViewerState.contentHost?.querySelectorAll('[data-article-share]') ?? [];
	shareButtons.forEach((button) => setupShareButton(button, slug, 'projects.html'));

	projectViewerState.container?.classList.add('is-open');
	projectViewerState.container?.removeAttribute('hidden');
	projectViewerState.container?.removeAttribute('aria-hidden');
	projectViewerState.container?.setAttribute('aria-expanded', 'true');
	projectViewerState.container?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	trigger.setAttribute('aria-expanded', 'true');

	const { skipHashUpdate = false } = options;
	if (!skipHashUpdate) {
		const url = `${window.location.pathname}#${slug}`;
		if (history.replaceState) {
			history.replaceState(null, '', url);
		} else {
			window.location.hash = slug;
		}
	}

	const focusTarget = heading || projectViewerState.title;
	focusTarget?.focus({ preventScroll: true });
}

function closeProjectViewer(options = {}) {
	const container = projectViewerState.container;
	if (!container?.classList.contains('is-open')) {
		return;
	}

	container.classList.remove('is-open');
	container.setAttribute('hidden', 'hidden');
	container.setAttribute('aria-hidden', 'true');
	container.removeAttribute('aria-expanded');

	if (projectViewerState.contentHost) {
		projectViewerState.contentHost.innerHTML = '';
	}

	if (projectViewerState.title) {
		projectViewerState.title.textContent = 'Selected Project';
	}

	if (projectViewerState.shareButton) {
		const toolbarShare = projectViewerState.shareButton;
		window.clearTimeout(toolbarShare._shareResetTimer);
		const labelTarget = toolbarShare.querySelector('[data-share-label]');
		const defaultLabel = toolbarShare.dataset.shareDefault || 'Share';
		if (labelTarget) {
			labelTarget.textContent = defaultLabel;
		} else {
			toolbarShare.textContent = defaultLabel;
		}
		toolbarShare.removeAttribute('data-share-slug');
		toolbarShare.removeAttribute('data-share-url');
	}

	if (projectViewerState.activeTrigger) {
		projectViewerState.activeTrigger.setAttribute('aria-expanded', 'false');
	}

	const focusReturnTarget = projectViewerState.activeTrigger;
	projectViewerState.activeSlug = null;
	projectViewerState.activeTrigger = null;

	const { skipHashReset = false } = options;
	if (!skipHashReset) {
		if (history.replaceState) {
			history.replaceState(null, '', window.location.pathname + window.location.search);
		} else if (window.location.hash) {
			window.location.hash = '';
		}
	}

	focusReturnTarget?.focus({ preventScroll: true });
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

function initSubscribeGlow() {
	const buttons = document.querySelectorAll('.button--subscribe');
	if (!buttons.length) {
		return;
	}

	const updateGlow = (button, event) => {
		const rect = button.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * 100;
		const y = ((event.clientY - rect.top) / rect.height) * 100;
		button.style.setProperty('--sub-glow-x', `${x}%`);
		button.style.setProperty('--sub-glow-y', `${y}%`);
		button.style.setProperty('--sub-glow-opacity', '0.42');
	};

	const resetGlow = (button) => {
		button.style.setProperty('--sub-glow-opacity', '0');
	};

	buttons.forEach((button) => {
		button.addEventListener('pointermove', (event) => updateGlow(button, event));
		button.addEventListener('pointerenter', (event) => updateGlow(button, event));
		button.addEventListener('pointerleave', () => resetGlow(button));
	});
}

function initReleaseCountdown() {
	const container = document.querySelector('[data-release-countdown]');
	if (!container) {
		return;
	}

	const labelTarget = container.querySelector('[data-countdown-label]');
	const timerTarget = container.querySelector('[data-countdown-timer]');
	const noteTarget = container.querySelector('[data-countdown-note]');
	const countdownLinks = document.querySelectorAll('a[href$="#release-countdown"], a[href*="index.html#release-countdown"]');
	if (!timerTarget) {
		return;
	}

	const setCountdownHidden = () => {
		container.hidden = true;
		container.setAttribute('aria-hidden', 'true');
		countdownLinks.forEach((link) => {
			link.setAttribute('hidden', 'true');
			link.setAttribute('aria-hidden', 'true');
			link.setAttribute('tabindex', '-1');
		});
	};

	const setCountdownVisible = () => {
		container.hidden = false;
		container.removeAttribute('hidden');
		container.removeAttribute('aria-hidden');
		countdownLinks.forEach((link) => {
			link.removeAttribute('hidden');
			link.removeAttribute('aria-hidden');
			link.removeAttribute('tabindex');
		});
	};

	const countdownEnabled = siteSettings.countdownEnabled === true;
	if (!countdownEnabled) {
		setCountdownHidden();
		return;
	}

	setCountdownVisible();

	if (labelTarget && siteSettings.countdownHeading) {
		labelTarget.textContent = siteSettings.countdownHeading;
	}
	if (noteTarget) {
		if (siteSettings.countdownNote) {
			noteTarget.textContent = siteSettings.countdownNote;
			noteTarget.removeAttribute('hidden');
		} else {
			noteTarget.setAttribute('hidden', 'true');
		}
	}

	const releaseTarget = siteSettings.releaseCountdownTarget || DEFAULT_SITE_SETTINGS.releaseCountdownTarget;
	const releaseDate = new Date(releaseTarget);
	if (Number.isNaN(releaseDate.getTime())) {
		timerTarget.textContent = 'Countdown unavailable';
		return;
	}

	const formatTwoDigits = (value) => String(value).padStart(2, '0');
	const completeCountdown = () => {
		timerTarget.textContent = 'RELEASEEEEEEEEEEEEEEEE!!!';
		container.classList.add('release-countdown--complete');
	};

	let intervalId = null;
	const updateCountdown = () => {
		const now = new Date();
		const diffMs = releaseDate.getTime() - now.getTime();
		if (diffMs <= 0) {
			completeCountdown();
			if (intervalId !== null) {
				window.clearInterval(intervalId);
				intervalId = null;
			}
			return;
		}

		const totalSeconds = Math.floor(diffMs / 1000);
		const days = Math.floor(totalSeconds / 86400);
		const hours = Math.floor((totalSeconds % 86400) / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		timerTarget.textContent = `${days}d ${formatTwoDigits(hours)}h ${formatTwoDigits(minutes)}m ${formatTwoDigits(seconds)}s`;
	};

	updateCountdown();
	intervalId = window.setInterval(updateCountdown, 1000);
	const cleanup = () => {
		if (intervalId !== null) {
			window.clearInterval(intervalId);
			intervalId = null;
		}
	};
	window.addEventListener('beforeunload', cleanup, { once: true });
}

function applyTopBannerSettings() {
	const banners = document.querySelectorAll('.top-banner');
	const bannerDisabled = siteSettings.bannerEnabled === false;
	if (document.body) {
		document.body.classList.toggle('banner-disabled', bannerDisabled);
	}

	banners.forEach((banner) => {
		if (bannerDisabled) {
			banner.setAttribute('hidden', 'true');
			banner.setAttribute('aria-hidden', 'true');
			return;
		}

		banner.removeAttribute('hidden');
		banner.removeAttribute('aria-hidden');

		const textEl = banner.querySelector('span');
		if (textEl && siteSettings.bannerText) {
			textEl.textContent = siteSettings.bannerText;
		}

		const buttons = Array.from(banner.querySelectorAll('.banner-button'));
		const primary = buttons[0];
		if (buttons.length > 1) {
			buttons.slice(1).forEach((btn) => btn.remove());
		}
		const href = siteSettings.bannerLink || primary?.getAttribute('href') || '#';
		const label = siteSettings.bannerButtonText || primary?.textContent || 'Open Source Repo';
		if (primary) {
			primary.textContent = label;
			primary.setAttribute('href', href);
			primary.setAttribute('target', '_blank');
			primary.setAttribute('rel', 'noopener noreferrer');
		} else {
			const anchor = document.createElement('a');
			anchor.className = 'banner-button';
			anchor.textContent = label;
			anchor.href = href;
			anchor.target = '_blank';
			anchor.rel = 'noopener noreferrer';
			banner.appendChild(anchor);
		}

		banner.removeAttribute('data-banner-pending');
	});
}

function prepareTopBanner() {
	const banners = document.querySelectorAll('.top-banner');
	banners.forEach((banner) => {
		banner.dataset.bannerPending = 'true';
		banner.setAttribute('hidden', 'true');
		banner.setAttribute('aria-hidden', 'true');
	});
}

async function initLatestBlogCard() {
	const card = document.querySelector('[data-latest-blog]');
	if (!card) {
		return;
	}

	const titleEl = card.querySelector('[data-blog-title]');
	const summaryEl = card.querySelector('[data-blog-summary]');
	const dateEl = card.querySelector('[data-blog-date]');
	const readingEl = card.querySelector('[data-blog-reading]');
	const linkEl = card.querySelector('[data-blog-link]');

	const setFallback = (message) => {
		if (titleEl) titleEl.textContent = message;
		if (summaryEl) summaryEl.textContent = 'See all posts on the blog page.';
		if (dateEl) {
			dateEl.textContent = '';
			dateEl.hidden = true;
		}
		if (readingEl) {
			readingEl.textContent = '';
			readingEl.hidden = true;
		}
		if (linkEl) linkEl.href = 'blog/index.html';
	};

	const formatDate = (input) => {
		const parsed = new Date(input || '');
		if (Number.isNaN(parsed.getTime())) return '';
		return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	};

	try {
		const res = await fetch(`blog/.generated/blog-manifest.json?ts=${Date.now()}`);
		if (!res.ok) {
			throw new Error(`Manifest request failed (${res.status})`);
		}
		const payload = await res.json();
		const posts = Array.isArray(payload.posts) ? payload.posts : Array.isArray(payload) ? payload : [];
		const published = posts
			.filter((post) => (post.status || 'published').toLowerCase() === 'published')
			.sort((a, b) => new Date(b.datePublished || b.date || 0) - new Date(a.datePublished || a.date || 0));

		const latest = published[0];
		if (!latest) {
			throw new Error('No published posts found');
		}

		const slug = latest.slug || '';
		const summary = latest.summary || 'New story on the blog.';
		const reading = latest.readingMinutes ? `${latest.readingMinutes} min read` : '';
		const dateText = formatDate(latest.datePublished || latest.date);
		const href = slug ? `blog/${slug}.html` : 'blog/index.html';

		if (titleEl) titleEl.textContent = latest.title || slug || 'Latest blog post';
		if (summaryEl) summaryEl.textContent = summary;
		if (dateEl) {
			dateEl.textContent = dateText;
			dateEl.hidden = !dateText;
		}
		if (readingEl) {
			readingEl.textContent = reading;
			readingEl.hidden = !reading;
		}
		if (linkEl) linkEl.href = href;
	} catch (error) {
		console.warn('Latest blog card failed', error);
		setFallback('Could not load latest post');
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
	const statsEl = card.querySelector('[data-video-stats]');
	const durationEl = card.querySelector('[data-video-duration]');
	const feedValidator = (text) => /<entry[\s>]/i.test(text) || /<feed[\s>]/i.test(text);

	const parseNumericValue = (value) => {
		if (typeof value === 'number') {
			return Number.isFinite(value) ? value : Number.NaN;
		}
		if (typeof value === 'string') {
			const normalized = value.replace(/,/g, '').trim();
			if (!normalized) {
				return Number.NaN;
			}
			const numeric = Number(normalized);
			return Number.isFinite(numeric) ? numeric : Number.NaN;
		}
		return Number.NaN;
	};

	const normaliseToIsoString = (input) => {
		if (!input) {
			return '';
		}
		if (input instanceof Date) {
			return Number.isNaN(input.getTime()) ? '' : input.toISOString();
		}
		if (typeof input === 'number') {
			const milliseconds = input < 1e12 ? input * 1000 : input;
			const date = new Date(milliseconds);
			return Number.isNaN(date.getTime()) ? '' : date.toISOString();
		}
		if (typeof input === 'string') {
			const trimmed = input.trim();
			if (!trimmed) {
				return '';
			}
			const numeric = Number(trimmed);
			if (!Number.isNaN(numeric) && /^\d+$/.test(trimmed)) {
				const milliseconds = numeric < 1e12 ? numeric * 1000 : numeric;
				const numericDate = new Date(milliseconds);
				if (!Number.isNaN(numericDate.getTime())) {
					return numericDate.toISOString();
				}
			}
			const parsed = new Date(trimmed);
			return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
		}
		return '';
	};

	const extractVideoId = (input) => {
		const raw = input?.toString().trim();
		if (!raw) {
			return '';
		}
		if (/^[\w-]{11}$/.test(raw)) {
			return raw;
		}
		try {
			const url = raw.startsWith('http')
				? new URL(raw)
				: new URL(`https://www.youtube.com/${raw.replace(/^\/+/, '')}`);
			if (url.hostname.includes('youtu.be')) {
				return url.pathname.replace('/', '').trim();
			}
			if (url.pathname.startsWith('/embed/')) {
				return url.pathname.split('/embed/')[1]?.split(/[?&#/]/)[0] ?? '';
			}
			if (url.pathname.startsWith('/shorts/')) {
				return url.pathname.split('/shorts/')[1]?.split(/[?&#/]/)[0] ?? '';
			}
			const v = url.searchParams.get('v');
			return v ? v.trim() : '';
		} catch (error) {
			return '';
		}
	};

	const buildUploadsPlaylistId = (channelId) => (
		channelId?.startsWith('UC') ? `UU${channelId.slice(2)}` : ''
	);

	const mountEmbed = (embedUrl, title) => {
		if (!thumbEl || !embedUrl) {
			return false;
		}
		const iframe = document.createElement('iframe');
		iframe.className = 'now-playing__iframe';
		iframe.src = embedUrl;
		iframe.title = title || 'YouTube video player';
		iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
		iframe.allowFullscreen = true;

		thumbEl.classList.add('now-playing__thumb--embedded');
		thumbEl.classList.remove('now-playing__thumb--skeleton');
		thumbEl.style.removeProperty('background-image');
		thumbEl.style.removeProperty('background-size');
		thumbEl.style.removeProperty('background-position');
		thumbEl.replaceChildren(iframe);

		card.classList.add('now-playing--embedded');
		return true;
	};

	const mountVideoEmbed = (videoId, title) => {
		if (!videoId) {
			return false;
		}
		const embedUrl = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1&playsinline=1`;
		return mountEmbed(embedUrl, title || 'Latest YouTube video');
	};

	const mountUploadsEmbed = () => {
		const playlistId = buildUploadsPlaylistId(resolvedChannelId);
		if (!playlistId) {
			return false;
		}
		const embedUrl = `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlistId)}&rel=0&modestbranding=1&playsinline=1`;
		return mountEmbed(embedUrl, 'Latest uploads');
	};

	const markError = (message) => {
		card.classList.add('now-playing--error');
		const embedded = mountUploadsEmbed();
		if (!embedded) {
			thumbEl?.classList.remove('now-playing__thumb--skeleton');
			if (thumbEl) {
				thumbEl.style.removeProperty('background-image');
				thumbEl.style.removeProperty('background-size');
				thumbEl.style.removeProperty('background-position');
			}
		}
		if (titleEl) {
			titleEl.textContent = embedded
				? 'Latest upload is unavailable right now — here’s the channel playlist.'
				: message;
		}
		if (statsEl) {
			statsEl.hidden = true;
			statsEl.textContent = '';
		}
		if (durationEl) {
			durationEl.hidden = true;
			durationEl.textContent = '';
		}
		if (linkEl) {
			linkEl.href = channelUrl;
		}
		delete card.dataset.latestVideoPublished;
	};

	const applyVideoData = (videoPayload = {}) => {
		const {
			title,
			url,
			thumbnail,
			publishedAt,
			durationSeconds,
			viewCount,
			videoId,
		} = videoPayload;
		const safeTitle = title?.toString().trim() || 'Latest upload from COOLmanYT';
		const resolvedLink = (() => {
			if (!url) {
				return channelUrl;
			}
			try {
				return url.startsWith('http') ? url : new URL(url, 'https://www.youtube.com').href;
			} catch (error) {
				return channelUrl;
			}
		})();

		card.classList.remove('now-playing--error');
		if (titleEl) {
			titleEl.textContent = safeTitle;
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
			linkEl.href = resolvedLink;
		}

		const derivedVideoId = videoId || extractVideoId(resolvedLink);
		if (derivedVideoId) {
			mountVideoEmbed(derivedVideoId, safeTitle);
		} else {
			mountUploadsEmbed();
		}

		const publishedIso = normaliseToIsoString(publishedAt);
		if (publishedIso) {
			card.dataset.latestVideoPublished = publishedIso;
		} else {
			delete card.dataset.latestVideoPublished;
		}

		if (statsEl) {
			const viewsNumeric = parseNumericValue(viewCount);
			const relative = publishedIso ? formatRelativeTime(publishedIso) : '';
			const statsParts = [];
			if (Number.isFinite(viewsNumeric) && viewsNumeric >= 0) {
				statsParts.push(`${formatViewCount(viewsNumeric)} views`);
			}
			if (relative) {
				statsParts.push(relative);
			}
			if (statsParts.length) {
				statsEl.hidden = false;
				statsEl.textContent = statsParts.join(' · ');
			} else {
				statsEl.hidden = true;
				statsEl.textContent = '';
			}
		}

		if (durationEl) {
			let durationValue = parseNumericValue(durationSeconds);
			if (!Number.isFinite(durationValue) || durationValue <= 0) {
				const durationMillis = parseNumericValue(
					videoPayload.durationMilliseconds ??
					videoPayload.durationMs ??
					videoPayload.duration_ms ??
					videoPayload.lengthMilliseconds ??
					videoPayload.lengthMs ??
					videoPayload.length_ms,
				);
				if (Number.isFinite(durationMillis) && durationMillis > 0) {
					durationValue = durationMillis / 1000;
				}
			}
			if (Number.isFinite(durationValue) && durationValue > 0) {
				const durationLabel = formatDurationLabel(Math.round(durationValue));
				if (durationLabel) {
					durationEl.hidden = false;
					durationEl.textContent = durationLabel;
				} else {
					durationEl.hidden = true;
					durationEl.textContent = '';
				}
			} else {
				durationEl.hidden = true;
				durationEl.textContent = '';
			}
		}
	};

	const attemptApiLatest = async () => {
		const API_TIMEOUT_MS = 3500;
		const params = new URLSearchParams();
		if (resolvedChannelId) {
			params.set('channelId', resolvedChannelId);
		}
		if (normalizedHandle) {
			params.set('handle', normalizedHandle);
		} else if (channelUserRaw) {
			params.set('channelUser', channelUserRaw);
		}
		const query = params.toString();
		const endpoint = `/api/youtube/latest${query ? `?${query}` : ''}`;
		const controller = new AbortController();
		const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
		try {
			const response = await fetch(endpoint, {
				headers: { Accept: 'application/json' },
				cache: 'no-store',
				signal: controller.signal,
			});
			if (!response.ok) {
				return false;
			}
			const payload = await response.json().catch(() => null);
			if (!payload || !payload.videoId) {
				return false;
			}
			if (payload.channelId && !resolvedChannelId) {
				resolvedChannelId = payload.channelId;
				updateChannelUrl();
			}
			applyVideoData({
				title: payload.title,
				url: payload.url || (payload.videoId ? `https://www.youtube.com/watch?v=${payload.videoId}` : ''),
				thumbnail: payload.thumbnail,
				publishedAt: payload.publishedAt,
				durationSeconds: payload.durationSeconds,
				viewCount: payload.viewCount,
				videoId: payload.videoId,
			});
			return true;
		} catch (error) {
			return false;
		} finally {
			window.clearTimeout(timeoutId);
		}
	};

	if (!resolvedChannelId && !legacyUser && !normalizedHandle) {
		markError('Latest video coming soon — check out the full channel!');
		return;
	}

	if (await attemptApiLatest()) {
		return;
	}

	if (await attemptPipedLatest()) {
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
			return await fetchFeedWithFallback(candidate.url, 'application/atom+xml', feedValidator);
		} catch (error) {
			lastFeedError = error;
			console.info('YouTube feed attempt failed', { url: candidate.url, reason: error?.message });
			return null;
		}
	};

async function attemptPipedLatest() {
		const identifierPool = [];
		if (resolvedChannelId) {
			identifierPool.push(resolvedChannelId);
		}
		if (normalizedHandle) {
			identifierPool.push(normalizedHandle);
		}
		if (legacyUser) {
			identifierPool.push(legacyUser);
		}
		const uniqueIdentifiers = Array.from(new Set(identifierPool.filter(Boolean)));
		if (!uniqueIdentifiers.length) {
			return false;
		}

		const pipedBases = [
			'https://piped.video/api/v1/channel/',
			'https://piped.mha.fi/api/v1/channel/',
		];

		for (const identifier of uniqueIdentifiers) {
			const trimmedIdentifier = identifier.trim();
			if (!trimmedIdentifier) {
				continue;
			}
			const encodedIdentifier = encodeURIComponent(trimmedIdentifier);
			for (const base of pipedBases) {
				const sanitizedBase = base.endsWith('/') ? base : `${base}/`;
				const attemptUrl = `${sanitizedBase}${encodedIdentifier}`;
				try {
					const response = await fetch(attemptUrl, {
						headers: { Accept: 'application/json' },
						cache: 'no-store',
					});
					if (!response.ok) {
						continue;
					}
					const payload = await response.json().catch(() => null);
					if (!payload) {
						continue;
					}

					const pipedChannelId = payload.id || payload.channelId || payload.channel_id;
					if (pipedChannelId && !resolvedChannelId) {
						resolvedChannelId = pipedChannelId;
						updateChannelUrl();
					}

					const collections = [
						payload.latestStreams,
						payload.relatedStreams,
						payload.streams,
						payload.videos,
						payload.items,
						payload.uploads,
					];
					const streams = [];
					collections.forEach((collection) => {
						if (Array.isArray(collection)) {
							collection.forEach((entry) => streams.push(entry));
						}
					});

					const candidates = streams
						.map((entry) => {
							if (!entry || !entry.title) {
								return null;
							}
							const rawPublished =
								entry.uploaded ??
								entry.uploadedDate ??
								entry.published ??
								entry.publishedDate ??
								entry.uploadedAt ??
								entry.createdAt ??
								entry.timestamp ??
								entry.date ??
								entry.publishDate;
							const publishedIso = normaliseToIsoString(rawPublished);
							const publishedTimestamp = publishedIso ? Date.parse(publishedIso) : Number.NaN;
							let candidateDuration = parseNumericValue(
								entry.duration ??
								entry.lengthSeconds ??
								entry.length_seconds ??
								entry.durationSeconds,
							);
							if (!Number.isFinite(candidateDuration) || candidateDuration <= 0) {
								const candidateDurationMs = parseNumericValue(
									entry.durationMilliseconds ??
									entry.durationMs ??
									entry.duration_ms ??
									entry.lengthMilliseconds ??
									entry.lengthMs ??
									entry.length_ms,
								);
								if (Number.isFinite(candidateDurationMs) && candidateDurationMs > 0) {
									candidateDuration = candidateDurationMs / 1000;
								}
							}
							const candidateViews = parseNumericValue(
								entry.views ??
								entry.viewCount ??
								entry.watchers ??
								entry.view_count ??
								(entry.stats ? entry.stats.views : undefined),
							);
							const candidateThumbnail = entry.thumbnail || entry.thumbnailUrl || entry.thumbnailURL || null;
							const rawUrl = entry.url || entry.shortUrl || entry.watchUrl || '';
							let videoUrl = channelUrl;
							if (rawUrl) {
								if (rawUrl.startsWith('http')) {
									videoUrl = rawUrl;
								} else if (rawUrl.startsWith('/')) {
									videoUrl = `https://www.youtube.com${rawUrl}`;
								} else {
									videoUrl = `https://www.youtube.com/watch?v=${rawUrl}`;
								}
							}

							const candidateVideoId = entry.videoId || entry.id || extractVideoId(videoUrl);

							return {
								entry,
								title: entry.title,
								publishedIso,
								publishedTimestamp,
								videoUrl,
								videoId: candidateVideoId,
								thumbnail: candidateThumbnail,
								durationSeconds: candidateDuration,
								viewCount: candidateViews,
							};
						})
						.filter(Boolean)
						.sort((a, b) => {
							const aTs = Number.isFinite(a.publishedTimestamp) ? a.publishedTimestamp : -Infinity;
							const bTs = Number.isFinite(b.publishedTimestamp) ? b.publishedTimestamp : -Infinity;
							return bTs - aTs;
						});

					const best = candidates[0];
					if (!best) {
						continue;
					}

					applyVideoData({
						title: best.title,
						url: best.videoUrl,
						thumbnail: best.thumbnail,
						publishedAt: best.publishedIso || best.publishedTimestamp || '',
						durationSeconds: best.durationSeconds,
						viewCount: best.viewCount,
						videoId: best.videoId,
					});
					return true;
				} catch (error) {
					console.info('Piped latest video attempt failed', { url: attemptUrl, reason: error?.message });
				}
			}
		}

		return false;
	};

	if (await attemptPipedLatest()) {
		return;
	}

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
			if (await attemptPipedLatest()) {
				return;
			}
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
		const statsNode = entry.getElementsByTagName('yt:statistics')[0] ??
			entry.querySelector('yt\\:statistics') ??
			entry.getElementsByTagName('media:statistics')[0] ??
			entry.querySelector('media\\:statistics');
		const viewCountRaw = statsNode?.getAttribute('viewCount') ?? statsNode?.getAttribute('views');
		const viewCount = Number.parseInt(viewCountRaw ?? '', 10);

		applyVideoData({
			title,
			url: link,
			thumbnail,
			publishedAt: published,
			durationSeconds,
			viewCount,
			videoId,
		});
		return;
	} catch (error) {
		console.error('Failed to load latest YouTube upload', error);
	}

	markError('Unable to fetch the latest video right now. Watch more on YouTube.');
}

async function fetchFeedWithFallback(url, accept = 'application/atom+xml', validator = null) {
	const ensureHttpsWrapped = (rawUrl) => {
		if (/^https?:\/\//i.test(rawUrl)) {
			return rawUrl;
		}
		return `https://${rawUrl}`;
	};

	const attempts = [
		{
			label: 'allorigins',
			build: (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(ensureHttpsWrapped(target))}`,
		},
		{
			label: 'isomorphic-cors',
			build: (target) => `https://cors.isomorphic-git.org/${ensureHttpsWrapped(target)}`,
		},
		{
			label: 'r.jina.ai',
			build: (target) => `https://r.jina.ai/${ensureHttpsWrapped(target)}`,
		},
	];

	const isLocalHost = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname ?? '');
	if (isLocalHost) {
		attempts.unshift({ label: 'direct', build: (target) => target });
	}

	let lastError = null;
	for (const attempt of attempts) {
		const attemptUrl = attempt.build(url);
		try {
			const response = await fetch(attemptUrl, {
				headers: { Accept: accept },
				cache: 'no-store',
			});
			if (!response.ok) {
				lastError = new Error(`${attempt.label} responded with status ${response.status}`);
				continue;
			}
			const text = await response.text();
			if (validator && !validator(text)) {
				lastError = new Error(`${attempt.label} response failed validation`);
				continue;
			}
			return text;
		} catch (error) {
			lastError = error;
		}
	}

	throw lastError ?? new Error('All fetch attempts failed');
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

	const htmlValidator = (text) => /"channelId":"UC[0-9A-Za-z_-]{21}[0-9A-Za-z_-]"/.test(text) || /"externalId":"UC[0-9A-Za-z_-]{21}[0-9A-Za-z_-]"/.test(text);

	for (const url of candidateUrls) {
		try {
			const html = await fetchFeedWithFallback(url, acceptHeader, htmlValidator);
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

function formatViewCount(count) {
	if (!Number.isFinite(count) || count < 0) {
		return '';
	}

	const absolute = Math.floor(count);
	if (absolute < 1000) {
		return absolute.toLocaleString('en');
	}

	const units = [
		{ value: 1_000_000_000, suffix: 'B' },
		{ value: 1_000_000, suffix: 'M' },
		{ value: 1_000, suffix: 'K' },
	];

	for (const { value, suffix } of units) {
		if (absolute >= value) {
			const formatted = (absolute / value).toFixed(absolute >= value * 10 ? 0 : 1);
			return `${Number(formatted)}${suffix}`;
		}
	}

	return absolute.toLocaleString('en');
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
	setupShareButton(shareButton, slug, 'blog/index.html');

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
		if (button.hasAttribute('data-share-defer')) {
			return;
		}
		const slugAttr = button.getAttribute('data-share-slug') || '';
		const baseAttr = button.getAttribute('data-share-base') || '';
		setupShareButton(button, slugAttr, baseAttr);
	});
}

function setupShareButton(button, slugFromContext = '', baseFromContext = '') {
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
		const shareBase = button.getAttribute('data-share-base') || baseFromContext;
		const shareUrl = explicitUrl || resolveShareUrl(shareSlug, shareBase);
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


function resolveShareUrl(slug, baseOverride = '') {
	const hasSlug = Boolean(slug);
	try {
		const basePath = baseOverride || 'blog/index.html';
		const base = new URL(basePath, window.location.href);
		base.hash = hasSlug ? slug : '';
		return base.href;
	} catch (error) {
		const fallbackBase = baseOverride || 'blog/index.html';
		if (hasSlug) {
			const separator = fallbackBase.includes('#') ? '' : '#';
			return `${fallbackBase}${separator}${slug}`;
		}
		return fallbackBase || window.location?.href || '';
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
	if (window.__coolmanAnalyticsLoaded || document.querySelector('[data-analytics-script]')) {
		return;
	}

	const loadAnalytics = () => {
		const script = document.createElement('script');
		script.src = ANALYTICS_MODULE_URL;
		script.defer = true;
		script.dataset.analyticsScript = 'true';
		script.onload = () => {
			window.__coolmanAnalyticsLoaded = true;
		};
		script.onerror = () => {
			console.info('Vercel Web Analytics script failed to load (optional).');
		};
		document.head.appendChild(script);
	};

	if ('requestIdleCallback' in window) {
		window.requestIdleCallback(loadAnalytics, { timeout: 2000 });
	} else {
		setTimeout(loadAnalytics, 0);
	}
}
