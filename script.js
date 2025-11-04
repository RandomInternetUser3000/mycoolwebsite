document.addEventListener('DOMContentLoaded', () => {
	fadeInPage();
	enableContactForm();
	enableForum();
	enhanceSocialButtons();
});

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
			statusElement.className = '';
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

function enableForum() {
	const forumForm = document.getElementById('forumForm');
	const forumList = document.getElementById('forumList');

	if (!forumForm || !forumList) {
		return;
	}

	const storageKey = 'coolman-forum-posts';
	let posts = [];

	try {
		const stored = localStorage.getItem(storageKey);
		if (stored) {
			posts = JSON.parse(stored);
		}
	} catch (error) {
		posts = [];
	}

	renderPosts(posts, forumList);

	forumForm.addEventListener('submit', (event) => {
		event.preventDefault();

		const nameInput = document.getElementById('forumName');
		const topicInput = document.getElementById('forumTopic');
		const messageInput = document.getElementById('forumMessage');

		if (!nameInput || !topicInput || !messageInput) {
			return;
		}

		const name = nameInput.value.trim();
		const topic = topicInput.value.trim();
		const message = messageInput.value.trim();

		if (!name || !topic || !message) {
			return;
		}

		const post = {
			id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
			name,
			topic,
			message,
			createdAt: new Date().toISOString(),
			replies: [],
		};

		posts.unshift(post);
		savePosts(storageKey, posts);
		renderPosts(posts, forumList);
		forumForm.reset();
	});

	forumList.addEventListener('click', (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}

		if (target.classList.contains('reply-button')) {
			const postId = target.dataset.postId;
			if (!postId) {
				return;
			}

			const reply = window.prompt('Reply as COOLmanYT:');
			if (!reply || !reply.trim()) {
				return;
			}

			const post = posts.find((item) => item.id === postId);
			if (!post) {
				return;
			}

			post.replies = post.replies || [];
			post.replies.push({
				id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
				author: 'COOLmanYT',
				message: reply.trim(),
				createdAt: new Date().toISOString(),
			});

			savePosts(storageKey, posts);
			renderPosts(posts, forumList);
		}
	});
}

function renderPosts(posts, container) {
	if (!posts.length) {
		container.innerHTML = '<div class="forum-empty">No posts yet. Be the first to start a conversation!</div>';
		return;
	}

	const fragment = document.createDocumentFragment();

	posts.forEach((post) => {
		const article = document.createElement('article');
		article.className = 'forum-post';

		const header = document.createElement('header');
		const title = document.createElement('strong');
		title.textContent = `${post.topic}`;

		const meta = document.createElement('time');
		meta.dateTime = post.createdAt;
		meta.textContent = formatDate(post.createdAt);

		const respondButton = document.createElement('button');
		respondButton.type = 'button';
		respondButton.className = 'reply-button';
		respondButton.dataset.postId = post.id;
		respondButton.textContent = 'Respond';

		header.append(title, meta, respondButton);

		const authorLine = document.createElement('p');
		authorLine.innerHTML = `<strong>${sanitize(post.name)}</strong> wrote:`;
		const message = document.createElement('p');
		message.textContent = post.message;

		article.append(header, authorLine, message);

		if (post.replies && post.replies.length) {
			const repliesContainer = document.createElement('div');
			repliesContainer.className = 'forum-replies';

			post.replies.forEach((reply) => {
				const replyBlock = document.createElement('div');
				replyBlock.className = 'forum-reply';

				const replyMeta = document.createElement('span');
				replyMeta.className = 'reply-meta';
				replyMeta.textContent = `Reply by ${reply.author} · ${formatDate(reply.createdAt)}`;

				const replyMessage = document.createElement('p');
				replyMessage.textContent = reply.message;

				replyBlock.append(replyMeta, replyMessage);
				repliesContainer.appendChild(replyBlock);
			});

			article.appendChild(repliesContainer);
		}

		fragment.appendChild(article);
	});

	container.innerHTML = '';
	container.appendChild(fragment);
}

function savePosts(storageKey, posts) {
	try {
		const trimmedPosts = posts.slice(0, 50);
		localStorage.setItem(storageKey, JSON.stringify(trimmedPosts));
	} catch (error) {
		// ignore storage errors
	}
}

function formatDate(isoString) {
	const date = new Date(isoString);
	if (Number.isNaN(date.getTime())) {
		return '';
	}

	return date.toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function sanitize(value) {
	const temp = document.createElement('div');
	temp.textContent = value;
	return temp.innerHTML;
}


