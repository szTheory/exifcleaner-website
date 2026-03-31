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
		initSmoothScroll();
	});
})();
