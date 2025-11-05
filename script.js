const ver = "Version 0.8.16 Public Beta"

document.addEventListener('DOMContentLoaded', () => {
	applyInitialTheme();
	setupThemeToggle();
	fadeInPage();
	enableContactForm();
	enhanceSocialButtons();
    updatever();
    addSocialTooltips();
});

const THEME_STORAGE_KEY = 'coolman-theme';

function applyInitialTheme() {
	const storedTheme = getStoredTheme();
	const theme = storedTheme ?? 'dark';
	applyTheme(theme, { persist: false });
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
		button.addEventListener('mouseenter', () => button.classList.add('tilt'));
		button.addEventListener('mouseleave', () => button.classList.remove('tilt'));
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
				headers: { Accept: 'application/json' },
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

function updatever() {
	const el = document.getElementById('github-repo');
	if (!el) return; // nothing to update on this page
	// Use textContent to avoid interpreting HTML and preserve the anchor href
	el.textContent = ver;
}

/**
 * Ensure social links show the platform name on hover.
 * Uses the nested <img alt="..."> when available, otherwise infers from the href.
 */
function addSocialTooltips() {
	const buttons = document.querySelectorAll('.social-button');
	buttons.forEach((btn) => {
		// Don't override an explicit title the author may have set
		if (btn.getAttribute('title')) return;

		const img = btn.querySelector('img');
		let label = img && img.alt ? img.alt.trim() : '';

		if (!label) {
			const href = (btn.getAttribute('href') || '').toLowerCase();
			if (/github/.test(href)) label = 'GitHub';
			else if (/youtube|youtu\.be/.test(href)) label = 'YouTube';
			else if (/discord/.test(href)) label = 'Discord';
			else if (/roblox/.test(href)) label = 'Roblox';
			else if (href) label = href.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
			else label = 'External link';
		}

		// Remove native title to avoid browser tooltip; we'll show an animated label instead
		if (btn.hasAttribute('title')) btn.removeAttribute('title');
		btn.setAttribute('aria-label', label);

		// Create or update a visible label element that will animate on hover
		let span = btn.querySelector('.social-label');
		if (!span) {
			span = document.createElement('span');
			span.className = 'social-label';
			btn.appendChild(span);
		}
		span.textContent = label;
	});
}
