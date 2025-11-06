const ver = "Version 0.9.0 Public Beta";
const COMMENTS_API_URL = '/api/comments';
const COMMENTS_STORAGE_KEY = 'coolman-comments';
const ANALYTICS_MODULE_URL = 'https://unpkg.com/@vercel/analytics/dist/analytics.mjs';
const blogViewerState = {
	modal: null,
	overlay: null,
	closeButton: null,
	contentHost: null,
	commentList: null,
	commentStatus: null,
	commentEmpty: null,
	commentForm: null,
	submitButton: null,
	activeSlug: null,
	activeTrigger: null,
	focusable: [],
	currentComments: [],
};

document.addEventListener('DOMContentLoaded', () => {
	applyInitialTheme();
	setupThemeToggle();
	fadeInPage();
	applySiteVersion();
	enableContactForm();
	enhanceSocialButtons();
	initNavGradient();
	initBlogViewer();
	injectAnalytics();
});

const THEME_STORAGE_KEY = 'coolman-theme';

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
		button.addEventListener('mouseenter', () => button.classList.add('tilt'));
		button.addEventListener('mouseleave', () => button.classList.remove('tilt'));
		if (label) {
			button.setAttribute('aria-label', label);
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

	let pendingEvent = null;
	let animationFrame = null;
	let resetTimeoutId = null;

	const updateGradient = () => {
		animationFrame = null;
		if (!pendingEvent) {
			return;
		}

		const rect = navLinks.getBoundingClientRect();
		if (!rect.width || !rect.height) {
			return;
		}

		const { clientX, clientY } = pendingEvent;
		const relativeX = (clientX - rect.left) / rect.width;
		const relativeY = (clientY - rect.top) / rect.height;
		const clampedX = Math.min(Math.max(relativeX, 0), 1);
		const clampedY = Math.min(Math.max(relativeY, 0), 1);
		const globalXRatio = clientX / window.innerWidth;
		const globalYRatio = clientY / window.innerHeight;
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

	const scheduleGradientUpdate = (event) => {
		if (resetTimeoutId) {
			clearTimeout(resetTimeoutId);
			resetTimeoutId = null;
		}
		pendingEvent = event;
		if (!animationFrame) {
			animationFrame = requestAnimationFrame(updateGradient);
		}
	};

	window.addEventListener('pointermove', scheduleGradientUpdate, { passive: true });

	window.addEventListener('resize', () => {
		if (pendingEvent && !animationFrame) {
			animationFrame = requestAnimationFrame(updateGradient);
		}
	});

	window.addEventListener('pointerout', (event) => {
		if (event.relatedTarget === null) {
			pendingEvent = null;
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
				animationFrame = null;
			}
			resetTimeoutId = window.setTimeout(() => {
				setStaticNavGlow();
				resetTimeoutId = null;
			}, 140);
		}
	});

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			pendingEvent = null;
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
				animationFrame = null;
			}
			if (resetTimeoutId) {
				clearTimeout(resetTimeoutId);
				resetTimeoutId = null;
			}
			setStaticNavGlow();
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
		const payload = Object.fromEntries(formData.entries());

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
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
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
	document.documentElement.dataset.siteVersion = ver;
	document.body.dataset.siteVersion = ver;
	const targets = document.querySelectorAll('[data-site-version]');
	targets.forEach((element) => {
		element.textContent = ver;
		if (element.tagName === 'A') {
			element.setAttribute('title', ver);
			element.setAttribute('aria-label', `Website version ${ver}`);
		}
	});
}

function initBlogViewer() {
	const modal = document.getElementById('blogModal');
	if (!modal) {
		return;
	}

	const triggers = document.querySelectorAll('[data-blog-open]');
	if (!triggers.length) {
		return;
	}

	blogViewerState.modal = modal;
	blogViewerState.overlay = modal.querySelector('[data-modal-overlay]');
	blogViewerState.closeButton = modal.querySelector('[data-modal-close]');
	blogViewerState.contentHost = modal.querySelector('[data-modal-content]');
	blogViewerState.commentList = modal.querySelector('[data-comment-list]');
	blogViewerState.commentStatus = modal.querySelector('[data-comment-status]');
	blogViewerState.commentEmpty = modal.querySelector('[data-comment-empty]');
	blogViewerState.commentForm = modal.querySelector('[data-comment-form]');
	blogViewerState.submitButton = blogViewerState.commentForm?.querySelector('button[type="submit"]') ?? null;

	triggers.forEach((trigger) => {
		trigger.addEventListener('click', (event) => {
			event.preventDefault();
			openBlogModal(trigger);
		});
	});

	blogViewerState.overlay?.addEventListener('click', () => {
		closeBlogModal();
	});

	blogViewerState.closeButton?.addEventListener('click', () => {
		closeBlogModal();
	});

	modal.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			closeBlogModal();
		} else if (event.key === 'Tab') {
			maintainModalFocus(event);
		}
	});

	if (blogViewerState.commentForm) {
		blogViewerState.commentForm.addEventListener('submit', handleCommentSubmit);
	}
}

function openBlogModal(trigger) {
	const slug = trigger.getAttribute('data-blog-open');
	if (!slug) {
		return;
	}

	const template = document.getElementById(`blog-template-${slug}`);
	if (!template) {
		const fallback = trigger.getAttribute('href');
		if (fallback) {
			window.location.href = fallback;
		}
		return;
	}

	blogViewerState.activeSlug = slug;
	blogViewerState.activeTrigger = trigger;
	const hasLegacyComments = Boolean(
		blogViewerState.commentForm || blogViewerState.commentList || blogViewerState.commentStatus,
	);

	if (blogViewerState.contentHost) {
		blogViewerState.contentHost.innerHTML = '';
		blogViewerState.contentHost.appendChild(template.content.cloneNode(true));
	}

	const heading = blogViewerState.contentHost?.querySelector('h1');
	const dialog = blogViewerState.modal?.querySelector('.blog-modal__dialog');
	if (heading && dialog) {
		if (!heading.id) {
			heading.id = `blog-modal-heading-${slug}`;
		}
		dialog.setAttribute('aria-labelledby', heading.id);
	} else {
		dialog?.removeAttribute('aria-labelledby');
	}

	if (blogViewerState.commentForm) {
		blogViewerState.commentForm.reset();
		blogViewerState.commentForm.dataset.slug = slug;
	}

	blogViewerState.modal?.classList.add('is-open');
	blogViewerState.modal?.setAttribute('aria-hidden', 'false');
	document.body.classList.add('modal-open');

	refreshModalFocusable();
	blogViewerState.closeButton?.focus({ preventScroll: true });

	if (hasLegacyComments) {
		setCommentStatus('Loading comments…', 'loading');
		loadComments(slug);
	}
}

function closeBlogModal() {
	if (!blogViewerState.modal?.classList.contains('is-open')) {
		return;
	}

	blogViewerState.modal.classList.remove('is-open');
	blogViewerState.modal.setAttribute('aria-hidden', 'true');
	document.body.classList.remove('modal-open');

	if (blogViewerState.contentHost) {
		blogViewerState.contentHost.innerHTML = '';
	}

	blogViewerState.activeSlug = null;
	refreshModalFocusable();
	setCommentStatus('Powered by your messages ✨');

	if (blogViewerState.activeTrigger) {
		blogViewerState.activeTrigger.focus();
		blogViewerState.activeTrigger = null;
	}
}

function refreshModalFocusable() {
	if (!blogViewerState.modal) {
		blogViewerState.focusable = [];
		return;
	}

	blogViewerState.focusable = Array.from(
		blogViewerState.modal.querySelectorAll(
			'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
		),
	);
}

function maintainModalFocus(event) {
	if (!blogViewerState.modal?.classList.contains('is-open')) {
		return;
	}

	const focusables = blogViewerState.focusable;
	if (!focusables.length) {
		return;
	}

	const first = focusables[0];
	const last = focusables[focusables.length - 1];
	const activeElement = document.activeElement;

	if (event.shiftKey) {
		if (activeElement === first) {
			last.focus();
			event.preventDefault();
		}
	} else if (activeElement === last) {
		first.focus();
		event.preventDefault();
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

	if (!blogViewerState.currentComments.length) {
		toggleCommentEmpty(true);
		return;
	}

	toggleCommentEmpty(false);

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

	statusElement.textContent = message;
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

function formatRelativeTime(timestamp) {
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) {
		return 'just now';
	}

	const now = Date.now();
	const diffMs = date.getTime() - now;
	const diffMinutes = diffMs / 60000;

	const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
	const thresholds = [
		{ unit: 'year', value: 525600 },
		{ unit: 'month', value: 43200 },
		{ unit: 'week', value: 10080 },
		{ unit: 'day', value: 1440 },
		{ unit: 'hour', value: 60 },
		{ unit: 'minute', value: 1 },
	];

	for (const threshold of thresholds) {
		if (Math.abs(diffMinutes) >= threshold.value || threshold.unit === 'minute') {
			const delta = Math.round(diffMinutes / threshold.value);
			return formatter.format(delta, threshold.unit);
		}
	}

	return date.toLocaleString();
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
