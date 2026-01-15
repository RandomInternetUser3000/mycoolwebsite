---
slug: building-my-website-using-gpt5-codex
title: Building my Website using GPT-5 Codex (and some brains)
tag: Featured
date: 2025-12-18
dateDisplay: December 18, 2025
updated: 2026-1-13
readingTime: 13 minute read
summary: I created this entire website with a mix of GitHub Copilot, GPT-5 Codex, and my own stubbornness. Here is how the prototypes evolved into the current release.
cardHighlights:
  - How I overcame the worst bugs.
  - The first commit, the setbacks, and the wins.
  - My road to the official release of the website
cardCta: Read the blog! (wow!)
featured: true
standalone: true
shareBase: blog/index.html
secondaryActionLabel: View Source
secondaryActionUrl: https://github.com/COOLmanYT/mycoolwebsite
---
It took several months of "hard" work, but I made it. I have officially finished coding my website (for the main part). And now, here is my journey for you.

## My First Commit
The first commit began when I saw my friend with his awesome and cool website. It was also directly connected to his discord as well, and I loved the animation when hovering over a button. I started learning some basic HTML and CSS, and made a very, *very* basic website consisting of just 1 page asking you to subscribe. 

## My First Pull Request
I left the website for a bit, then I came back after learning some more code. My first pull request was actually just trying to make the button using HTML instead of JS, but all it did was add a href inside of a button. Sounds stupid, right? Because it was.

## Everything In Between
After 50 commits and me getting a 30 day free trial of Copilot Pro, the website started coming along. The nice gradient background was relaxing, the dark/light mode button got rid of the need of a dark mode extension and I got a working interactive nav bar! The blog was barebones and only with placeholders, and the gallery was (and still is) just placeholders that the AI got from some place on the internet.

But I was still in Beta. There were more things that I wanted to add, I wanted to change, I wanted to get rid of. The website looked and felt complete, but I knew there was more to add

## Feature Mania
I wanted a contact form, so I used Formspree to hold the backend. I wanted comments on my blog, I used Commento to hold the backend for that. I wanted social link buttons to expand and say what platform they are from... that kinda broke my website for a bit. Slowly, the additions got more crazy. Then came...

## The Biggest Pull Request
I had an idea in my head. There were times where I wanted to update my website, but I didn't have my laptop with me. I didn't trust a Copilot that I can't pick the model of, so I had a bold idea.

> I should make **an admin panel**

And so began the grueling task of making one. And a secure one it had to be. I needed to make sure it was only me and my approved members who could access the page, so I thought on how to control that. Aha! Github API! I could connect the website to a GitHub App that does OAuth and verifies my account so I can access the website. Github was also the best option here, as my website code is stored on Github. I was considering Google, Microsoft, etc., but it seemed too complicated. So with Github I went.

I also wanted to incorporate RSS into my website as well as a Discord webhook for my discord server (that I'm going to announce in my next YouTube video officially) to ping everyone when I have a new blog post. I mean, I could make a YouTube video instead, but with the admin panel, I could just post without having to make a YouTube video and go through editing and all that *boring* crap.

After a few hours of coding (and asking ChatGPT to code for me), I had done it. I had implemented everything I wanted, along with a countdown to a release. And **I had done it. I had finished my website** (mostly). I went ahead and created a branch, converted it into a pull request, and added it to main. 

My website still had a few issues, but they were resolved later.

## What Now?
I won't give up on this website. There will be things I want to add and some of those are impossible on this static website. Maybe one day, I'll change this website from Vercel to another. Maybe I'll buy the domain coolmanyt.com to make it official. (spoiler: I did) Who knows? But right now, it's just going to get better from here.
