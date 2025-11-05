const ver = "Version 0.8.16fix Public Beta"

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
	const MAX_ERROR_TEXT_LENGTH = 200;

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
				// Try to parse error response
				let errorMessage = 'Something went wrong. Please try again later.';
				let parsedMessage = false;
				
				// Clone response to allow multiple reads of the body
				const responseClone = response.clone();
				
				try {
					const data = await response.json();
					if (data?.errors?.[0]?.message) {
						errorMessage = data.errors[0].message;
						parsedMessage = true;
					} else if (data?.error) {
						errorMessage = data.error;
						parsedMessage = true;
					} else if (data?.message) {
						errorMessage = data.message;
						parsedMessage = true;
					}
				} catch (parseError) {
					// If JSON parsing fails, try to get text response from cloned response
					try {
						const text = await responseClone.text();
						// Limit text length to avoid displaying large HTML error pages
						if (text && text.length <= MAX_ERROR_TEXT_LENGTH) {
							errorMessage = text;
							parsedMessage = true;
						}
					} catch (textError) {
						// Keep default error message
					}
				}
				
				// Add status-specific messages only if no meaningful message was parsed
				if (!parsedMessage) {
					if (response.status === 400) {
						errorMessage = 'Please check that all fields are filled correctly.';
					} else if (response.status === 403) {
						errorMessage = 'Form submission blocked. Please contact the site owner.';
					} else if (response.status === 404) {
						errorMessage = 'Form endpoint not found. Please contact the site owner.';
					} else if (response.status >= 500) {
						errorMessage = 'Server error. Please try again later.';
					}
				}
				
				if (statusElement) {
					statusElement.textContent = errorMessage;
					statusElement.classList.add('error');
				}
				
				// Log error for debugging (excluding endpoint to avoid exposing sensitive info)
				console.error('Form submission failed:', {
					status: response.status,
					statusText: response.statusText
				});
			}
		} catch (error) {
			if (statusElement) {
				statusElement.textContent = 'Network error. Please check your connection and try again.';
				statusElement.classList.add('error');
			}
			console.error('Form submission error:', error);
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

		// Ensure the image is wrapped in a fixed-size circular wrapper so the icon stays centered.
		if (img) {
			let iconWrapper = btn.querySelector('.social-icon');
			if (!iconWrapper) {
				iconWrapper = document.createElement('span');
				iconWrapper.className = 'social-icon';
				// Move the image into the wrapper
				btn.insertBefore(iconWrapper, img);
				iconWrapper.appendChild(img);
			}
		}

		// Determine label from alt text or href
		let label = '';
		if (img && img.alt) label = img.alt.trim();
		if (!label) {
			const href = (btn.getAttribute('href') || '').toLowerCase();
			if (/github/.test(href)) label = 'GitHub';
			else if (/youtube|youtu\.be/.test(href)) label = 'YouTube';
			else if (/discord/.test(href)) label = 'Discord';
			else if (/roblox/.test(href)) label = 'Roblox';
			else if (href) label = href.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
			else label = 'External link';
		}

		// Remove native title to avoid browser tooltip; keep aria-label for accessibility
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
