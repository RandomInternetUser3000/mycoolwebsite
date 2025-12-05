---
slug: building-my-website-using-gpt5-codex
title: Building my Website using GPT-5 Codex (and some brains)
tag: Featured
date: 2025-10-19
dateDisplay: October 19, 2025
updated: 2025-10-24
readingTime: 7 minute read
summary: I created this entire website with a mix of GitHub Copilot, GPT-5 Codex, and my own stubbornness. Here is how the prototypes evolved into the current release candidate.
cardHighlights:
  - How I overcame the worst bugs.
  - The first commit, the setbacks, and the wins.
  - What still needs to launch before release.
cardCta: Read the blog!
featured: true
standalone: false
shareBase: blog/index.html
secondaryActionLabel: View Source
secondaryActionUrl: https://github.com/RandomInternetUser3000/mycoolwebsite
---
When I first prototyped combat for my Roblox project, the goal was simple: hit detection that *felt* right. Months later the codebase was a spaghetti bowl of remote events, server-side guesses, and duct-tape cooldowns. The rewrite replaces every piece of that foundation with something intentional.

## What Was Holding the Old System Back

- Server-side damage checks that felt laggy for high-ping players.
- Animations and damage timing competing for control of the same state.
- Cooldowns that grew more brittle every time I added a new weapon.

Instead of patching each bug, I listed the sensations I wanted players to feel—snappy confirms, punishable misses, and readable blocks. Anything that did not support those outcomes went on the chopping block.

## The New Foundation

The rewrite centers around modular abilities. Each ability defines its own hit windows, stamina taxes, and visual effects, then plugs into a shared state machine. That gives me granular control and cleaner testing.

> The biggest win was separating animation pacing from damage timing. Once those two systems stopped fighting each other, every combo suddenly clicked.

On top of that, I built dashboards that track hit accuracy, block success, and combo drops per session. Data beats vibes when you are balancing PvP.

## What Comes Next

Two features are still in the lab: directional dodges and weapon-specific perks. Directional dodges need bespoke camera easing, and perks require UI updates so players actually notice them. Expect more updates once those hit testing.
