const ver = "Version 0.8.18 Public Beta"

document.addEventListener('DOMContentLoaded', () => {
	applyInitialTheme();
	setupThemeToggle();
	fadeInPage();
	enableContactForm();
	updatever();
	syncSocialButtonLabels();
	enhanceSocialButtons();
	setupNavHoverGlow();
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
	const socialButtons = document.querySelectorAll('.social-links .social-button');
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

	if (!endpoint || !submitButton) {
		return;
	}

	const handleSubmit = async (event) => {
		event.preventDefault();

		const formData = new FormData(contactForm);
		const urlEncoded = new URLSearchParams();
		formData.forEach((value, key) => {
			urlEncoded.append(key, String(value));
		});

		const resetStatus = () => {
			submitButton.disabled = false;
			submitButton.textContent = 'Send Message';
		};

		const fallbackSubmit = () => {
			resetStatus();
			contactForm.removeEventListener('submit', handleSubmit);
			contactForm.submit();
		};

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
					'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				},
				body: urlEncoded.toString(),
			});

			if (response.ok) {
				if (statusElement) {
					statusElement.textContent = "Message sent successfully! I'll get back to you soon.";
					statusElement.classList.add('success');
				}
				contactForm.reset();
			} else {
				const data = await response.json().catch(() => null);
				const errorList = Array.isArray(data?.errors)
					? data.errors.map((item) => item?.message).filter(Boolean)
					: [];
				const errorMessage = errorList.join('\n') || data?.message || 'Something went wrong. Please try again later.';
				if (statusElement) {
					statusElement.textContent = errorMessage;
					statusElement.classList.add('error');
				}
				if (response.status >= 500) {
					fallbackSubmit();
					return;
				}
			}
		} catch (error) {
			if (statusElement) {
				statusElement.textContent = 'Network error. Please check your connection and try again.';
				statusElement.classList.add('error');
			}
			fallbackSubmit();
			return;
		} finally {
			resetStatus();
		}
	};

	contactForm.addEventListener('submit', handleSubmit);
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
function syncSocialButtonLabels() {
	const buttons = document.querySelectorAll('.social-links .social-button');
	buttons.forEach((btn) => {
		const explicitLabel = btn.dataset.label;
		const imgAlt = btn.querySelector('img')?.alt?.trim();
		const fallback = (() => {
			const href = (btn.getAttribute('href') || '').toLowerCase();
			if (/github/.test(href)) return 'GitHub';
			if (/youtube|youtu\.be/.test(href)) return 'YouTube';
			if (/discord/.test(href)) return 'Discord';
			if (/roblox/.test(href)) return 'Roblox';
			return imgAlt || 'External link';
		})();

		const label = explicitLabel || fallback;
		btn.setAttribute('aria-label', label);
	});
}

function setupNavHoverGlow() {
	const navBars = document.querySelectorAll('.nav-links');
	navBars.forEach((nav) => {
		nav.addEventListener('pointermove', (event) => {
			const rect = nav.getBoundingClientRect();
			const x = ((event.clientX - rect.left) / rect.width) * 100;
			const y = ((event.clientY - rect.top) / rect.height) * 100;
			nav.style.setProperty('--nav-hover-x', `${x}%`);
			nav.style.setProperty('--nav-hover-y', `${y}%`);
		});
		nav.addEventListener('pointerleave', () => {
			nav.style.removeProperty('--nav-hover-x');
			nav.style.removeProperty('--nav-hover-y');
		});
	});
}
