// ExifCleaner website — main.js
// Tasteful dynamic moments per D-04: restraint, not a tech demo

(function () {
	"use strict";

	var prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;

	// ─── Scroll Reveal (IntersectionObserver) ───────────────────────
	function initScrollReveals() {
		var elements = document.querySelectorAll("[data-reveal]");
		if (!elements.length) return;

		if (prefersReducedMotion) {
			elements.forEach(function (el) {
				el.classList.add("revealed");
			});
			return;
		}

		var observer = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) {
						entry.target.classList.add("revealed");
						observer.unobserve(entry.target);
					}
				});
			},
			{ threshold: 0.1 }
		);

		elements.forEach(function (el) {
			observer.observe(el);
		});
	}

	// ─── Hero Screenshot Tilt Effect ────────────────────────────────
	function initTiltEffect() {
		var tiltEl = document.querySelector("[data-tilt]");
		if (!tiltEl || prefersReducedMotion) return;

		tiltEl.addEventListener("mousemove", function (e) {
			var rect = tiltEl.getBoundingClientRect();
			var x = (e.clientX - rect.left) / rect.width - 0.5;
			var y = (e.clientY - rect.top) / rect.height - 0.5;
			tiltEl.style.transform =
				"perspective(1000px) rotateY(" +
				(x * 5) +
				"deg) rotateX(" +
				(-y * 5) +
				"deg)";
		});

		tiltEl.addEventListener("mouseleave", function () {
			tiltEl.style.transform =
				"perspective(1000px) rotateY(0deg) rotateX(0deg)";
		});
	}

	// ─── Metadata Dissolve Animation ────────────────────────────────
	function initMetadataDissolve() {
		var dissolveEl = document.querySelector(".dissolve-text");
		if (!dissolveEl) return;

		// The dissolve-text contains multiple spans with metadata text.
		// Wrap each character in its own span for individual animation.
		var childSpans = dissolveEl.querySelectorAll("span");
		var fragment = document.createDocumentFragment();

		childSpans.forEach(function (span) {
			var text = span.textContent || "";
			for (var i = 0; i < text.length; i++) {
				var charSpan = document.createElement("span");
				charSpan.textContent = text[i] === " " ? "\u00A0" : text[i];
				if (!prefersReducedMotion) {
					charSpan.style.transitionDelay = (Math.random() * 0.5) + "s";
				}
				fragment.appendChild(charSpan);
			}
		});

		dissolveEl.innerHTML = "";
		dissolveEl.appendChild(fragment);

		// Trigger dissolve when element enters viewport
		var observer = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) {
						// Wait a moment for the user to read, then dissolve
						setTimeout(function () {
							dissolveEl.classList.add("dissolving");
						}, 1500);
						observer.unobserve(entry.target);
					}
				});
			},
			{ threshold: 0.5 }
		);

		observer.observe(dissolveEl);
	}

	// ─── Mobile Nav Toggle ──────────────────────────────────────────
	function initMobileNav() {
		var hamburger = document.querySelector(".nav__hamburger");
		var links = document.querySelector(".nav__links");
		if (!hamburger || !links) return;

		hamburger.addEventListener("click", function () {
			links.classList.toggle("nav__links--open");
			var expanded = hamburger.getAttribute("aria-expanded") === "true";
			hamburger.setAttribute("aria-expanded", String(!expanded));
		});

		// Close menu when a link is clicked
		links.querySelectorAll("a").forEach(function (link) {
			link.addEventListener("click", function () {
				links.classList.remove("nav__links--open");
				hamburger.setAttribute("aria-expanded", "false");
			});
		});
	}

	// ─── Appearance Switch ──────────────────────────────────────────
	//
	// The head script already applied the theme before first paint, and CSS draws the
	// checked segment off [data-theme]. This owns only the parts CSS cannot: persistence,
	// keyboard behaviour, ARIA state, and keeping <picture> in step.
	var THEME_KEY = "exifcleaner-theme";
	var THEME_ORDER = ["light", "system", "dark"];

	function storedTheme() {
		try {
			var t = localStorage.getItem(THEME_KEY);
			return t === "light" || t === "dark" ? t : "system";
		} catch (e) {
			return "system";
		}
	}

	function systemPrefersDark() {
		return window.matchMedia("(prefers-color-scheme: dark)").matches;
	}

	function resolvedTheme() {
		var choice = storedTheme();
		if (choice !== "system") return choice;
		return systemPrefersDark() ? "dark" : "light";
	}

	// <picture> keys off the media query, not off [data-theme], so an explicit choice that
	// disagrees with the OS would otherwise still serve the wrong screenshot. Rewriting the
	// source's media makes it always- or never-matching; <picture> re-evaluates on mutation.
	function syncPictures(theme) {
		var sources = document.querySelectorAll("[data-theme-src-dark]");
		for (var i = 0; i < sources.length; i++) {
			sources[i].media = theme === "dark" ? "all" : "not all";
		}
	}

	function initThemeSwitch() {
		var group = document.querySelector(".theme-switch");
		if (!group) return;

		var opts = Array.prototype.slice.call(
			group.querySelectorAll(".theme-switch__opt"),
		);

		function apply(choice, moveFocus) {
			if (choice === "system") {
				document.documentElement.removeAttribute("data-theme");
			} else {
				document.documentElement.setAttribute("data-theme", choice);
			}
			try {
				// Store the three-valued *intent*, never the resolved theme. Writing "dark"
				// when the user picked Auto silently converts a system-follow into a
				// permanent lock the next time their OS switches.
				if (choice === "system") localStorage.removeItem(THEME_KEY);
				else localStorage.setItem(THEME_KEY, choice);
			} catch (e) {}

			opts.forEach(function (opt) {
				var checked = opt.getAttribute("data-theme-value") === choice;
				opt.setAttribute("aria-checked", String(checked));
				opt.tabIndex = checked ? 0 : -1;
				if (checked && moveFocus) opt.focus();
			});

			syncPictures(resolvedTheme());
		}

		opts.forEach(function (opt) {
			opt.addEventListener("click", function () {
				apply(opt.getAttribute("data-theme-value"), false);
			});

			opt.addEventListener("keydown", function (e) {
				var current = THEME_ORDER.indexOf(storedTheme());
				var next = -1;
				if (e.key === "ArrowRight" || e.key === "ArrowDown") {
					next = (current + 1) % THEME_ORDER.length;
				} else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
					next = (current - 1 + THEME_ORDER.length) % THEME_ORDER.length;
				} else if (e.key === "Home") {
					next = 0;
				} else if (e.key === "End") {
					next = THEME_ORDER.length - 1;
				}
				if (next === -1) return;
				e.preventDefault();
				// Arrow keys select on focus, per the APG radiogroup pattern -- and focus
				// must actually move, or the ring is stranded on a segment that just became
				// tabindex="-1" and visibly desyncs from the checked state.
				apply(THEME_ORDER[next], true);
			});
		});

		// While the choice is "system" the page tracks the OS through color-scheme with no
		// JS at all -- but <picture> still needs telling, since its media query and the
		// rewritten media attribute are not the same thing.
		var media = window.matchMedia("(prefers-color-scheme: dark)");
		var onSystemChange = function () {
			if (storedTheme() === "system") syncPictures(resolvedTheme());
		};
		if (media.addEventListener) media.addEventListener("change", onSystemChange);
		else if (media.addListener) media.addListener(onSystemChange);

		// Reconcile ARIA with what the head script already painted.
		var choice = storedTheme();
		opts.forEach(function (opt) {
			var checked = opt.getAttribute("data-theme-value") === choice;
			opt.setAttribute("aria-checked", String(checked));
			opt.tabIndex = checked ? 0 : -1;
		});
		syncPictures(resolvedTheme());

		// Enable the indicator transition only after the first paint has committed. A single
		// rAF fires before style commit in some engines and you get the slide-in anyway.
		requestAnimationFrame(function () {
			requestAnimationFrame(function () {
				document.documentElement.classList.add("theme-ready");
			});
		});
	}

	// ─── Smooth Scroll with Nav Offset ──────────────────────────────
	function initSmoothScroll() {
		document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
			anchor.addEventListener("click", function (e) {
				var targetId = this.getAttribute("href");
				if (!targetId || targetId === "#") return;

				var target = document.querySelector(targetId);
				if (!target) return;

				e.preventDefault();
				var nav = document.querySelector(".nav");
				var offset = nav ? nav.offsetHeight : 0;
				var top =
					target.getBoundingClientRect().top + window.pageYOffset - offset;
				window.scrollTo({
					top: top,
					behavior: prefersReducedMotion ? "auto" : "smooth",
				});
			});
		});
	}

	// ─── Initialize Everything ──────────────────────────────────────
	document.addEventListener("DOMContentLoaded", function () {
		initScrollReveals();
		initTiltEffect();
		initMetadataDissolve();
		initMobileNav();
		initThemeSwitch();
		initSmoothScroll();
	});
})();
