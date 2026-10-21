// Site interactions: logo loader, sticky header, mobile drawer,
// scroll-reveal animations, active nav link and footer year.
(function() {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---------- scroll reveal ----------
    function startReveal() {
        var items = document.querySelectorAll("[data-reveal]");
        if (!("IntersectionObserver" in window)) {
            items.forEach(function(el) { el.classList.add("is-visible"); });
            return;
        }
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
        items.forEach(function(el) { observer.observe(el); });
    }

    // ---------- loader ----------
    // Keep the logo on screen briefly, then fade out once the page has loaded;
    // the hero animates in only after the loader is gone.
    var loader = document.getElementById("loader");
    var loaderDone = false;
    function hideLoader() {
        if (loaderDone) return;
        loaderDone = true;
        if (loader) loader.classList.add("is-hidden");
        startReveal();
    }
    if (loader) {
        var minVisible = reduceMotion ? 0 : 900;
        var onLoad = function() {
            setTimeout(hideLoader, Math.max(0, minVisible - performance.now()));
        };
        if (document.readyState === "complete") onLoad();
        else window.addEventListener("load", onLoad);
        setTimeout(hideLoader, 4000); // never let a slow image hold the page
    } else {
        hideLoader();
    }

    // ---------- header ----------
    var header = document.querySelector(".site-header");
    function onScroll() {
        header.classList.toggle("is-scrolled", window.scrollY > 16);
    }
    if (header) {
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
    }

    // ---------- mobile drawer ----------
    var drawer = document.getElementById("drawer");
    var backdrop = document.querySelector(".drawer-backdrop");
    var toggle = document.querySelector(".menu-toggle");

    function setDrawer(open) {
        drawer.classList.toggle("is-open", open);
        backdrop.classList.toggle("is-open", open);
        document.body.classList.toggle("no-scroll", open);
        toggle.setAttribute("aria-expanded", String(open));
        drawer.setAttribute("aria-hidden", String(!open));
        if (open) drawer.querySelector(".drawer-close").focus();
        else toggle.focus({ preventScroll: true });
    }

    if (drawer && backdrop && toggle) {
        toggle.addEventListener("click", function() { setDrawer(true); });
        document.querySelectorAll("[data-drawer-close]").forEach(function(el) {
            el.addEventListener("click", function() { setDrawer(false); });
        });
        drawer.querySelectorAll("a").forEach(function(link) {
            link.addEventListener("click", function() { setDrawer(false); });
        });
        document.addEventListener("keydown", function(e) {
            if (!drawer.classList.contains("is-open")) return;
            if (e.key === "Escape") return setDrawer(false);
            if (e.key !== "Tab") return;
            // keep keyboard focus inside the open drawer
            var focusable = drawer.querySelectorAll("a, button");
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        });
        window.matchMedia("(min-width: 992px)").addEventListener("change", function(e) {
            if (e.matches && drawer.classList.contains("is-open")) setDrawer(false);
        });
    }

    // ---------- active nav link ----------
    var navLinks = document.querySelectorAll(".main-nav a[href^='#']");
    if (navLinks.length && "IntersectionObserver" in window) {
        var linkFor = {};
        navLinks.forEach(function(link) {
            linkFor[link.getAttribute("href").slice(1)] = link;
        });
        var spy = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (!entry.isIntersecting) return;
                navLinks.forEach(function(link) { link.classList.remove("is-active"); });
                var active = linkFor[entry.target.id];
                if (active) active.classList.add("is-active");
            });
        }, { rootMargin: "-45% 0px -50% 0px" });
        document.querySelectorAll("main > section[id]").forEach(function(section) {
            spy.observe(section);
        });
    }

    // ---------- WhatsApp chat ----------
    var wa = document.querySelector("[data-wa]");
    if (wa) {
        var waButton = wa.querySelector(".wa-button");
        var waPanel = wa.querySelector(".wa-panel");
        var waLink = wa.querySelector("[data-wa-message]");
        waLink.href += "?text=" + encodeURIComponent(waLink.getAttribute("data-wa-message"));

        var setWa = function(open) {
            wa.classList.toggle("is-open", open);
            waButton.setAttribute("aria-expanded", String(open));
            waPanel.setAttribute("aria-hidden", String(!open));
            if (open) waLink.focus({ preventScroll: true });
        };

        waButton.addEventListener("click", function() {
            setWa(!wa.classList.contains("is-open"));
        });
        wa.querySelector("[data-wa-close]").addEventListener("click", function() {
            setWa(false);
            waButton.focus();
        });
        waLink.addEventListener("click", function() { setWa(false); });
        document.addEventListener("click", function(e) {
            if (wa.classList.contains("is-open") && !wa.contains(e.target)) setWa(false);
        });
        document.addEventListener("keydown", function(e) {
            if (e.key === "Escape" && wa.classList.contains("is-open")) {
                setWa(false);
                waButton.focus();
            }
        });
    }

    // ---------- footer year ----------
    document.querySelectorAll("[data-year]").forEach(function(el) {
        el.textContent = new Date().getFullYear();
    });
})();
