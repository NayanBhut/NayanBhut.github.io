/* Nayan Bhut — site behaviour. No dependencies. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  /* ----------------------------------------------------------------------
     Sticky header: hairline once the page moves
     ---------------------------------------------------------------------- */
  var header = document.querySelector('[data-header]');
  var ticking = false;

  function onScrollHeader() {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    ticking = false;
  }

  window.addEventListener(
    'scroll',
    function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(onScrollHeader);
      }
    },
    { passive: true }
  );
  onScrollHeader();

  /* ----------------------------------------------------------------------
     Theme: system by default, explicit choice remembered
     ---------------------------------------------------------------------- */
  var themeToggle = document.querySelector('[data-theme-toggle]');

  function effectiveTheme() {
    var explicit = root.getAttribute('data-theme');
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return darkQuery.matches ? 'dark' : 'light';
  }

  function syncThemeLabel() {
    if (!themeToggle) return;
    var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
    var label = 'Switch to ' + next + ' theme';
    themeToggle.setAttribute('aria-label', label);
    themeToggle.setAttribute('title', label);
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem('theme', next);
      } catch (e) {}
      syncThemeLabel();
    });
  }

  if (darkQuery.addEventListener) {
    darkQuery.addEventListener('change', syncThemeLabel);
  } else if (darkQuery.addListener) {
    darkQuery.addListener(syncThemeLabel);
  }

  window.addEventListener('storage', function (event) {
    if (event.key !== 'theme') return;
    if (event.newValue === 'light' || event.newValue === 'dark') {
      root.setAttribute('data-theme', event.newValue);
    } else {
      root.removeAttribute('data-theme');
    }
    syncThemeLabel();
  });

  syncThemeLabel();

  /* ----------------------------------------------------------------------
     Mobile menu: a small panel, never a full-screen layer
     ---------------------------------------------------------------------- */
  var navToggle = document.querySelector('[data-nav-toggle]');
  var mobileNav = document.querySelector('[data-mobile-nav]');

  function setMenu(open) {
    if (!navToggle || !mobileNav) return;
    mobileNav.hidden = !open;
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', function () {
      setMenu(mobileNav.hidden);
    });

    mobileNav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !mobileNav.hidden) {
        setMenu(false);
        navToggle.focus();
      }
    });

    document.addEventListener('click', function (event) {
      if (mobileNav.hidden) return;
      if (event.target.closest('[data-header]')) return;
      setMenu(false);
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 960) setMenu(false);
    });
  }

  /* ----------------------------------------------------------------------
     Reveal on scroll. Space is always reserved; nothing reflows.
     ---------------------------------------------------------------------- */
  var revealItems = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));

  function revealAll() {
    revealItems.forEach(function (el) {
      el.classList.add('is-in');
    });
  }

  if (revealItems.length) {
    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      revealAll();
    } else {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-in');
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -6% 0px', threshold: 0 }
      );

      revealItems.forEach(function (el) {
        observer.observe(el);
      });

      /* Safety net: if the observer never fires (odd embedded browser),
         content becomes visible rather than staying hidden. */
      window.setTimeout(revealAll, 4000);
    }
  }

  /* ----------------------------------------------------------------------
     Scroll spy for the section menu
     ---------------------------------------------------------------------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
  var spyLinks = navLinks.filter(function (link) {
    return link.hash && link.hash.length > 1 && document.querySelector(link.hash);
  });

  if (spyLinks.length) {
    var spyTicking = false;

    function updateSpy() {
      var offset = (header ? header.offsetHeight : 64) + 140;
      var current = null;

      spyLinks.forEach(function (link) {
        var section = document.querySelector(link.hash);
        if (section && section.getBoundingClientRect().top + window.scrollY - offset <= window.scrollY) {
          current = link;
        }
      });

      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        var contactLink = spyLinks.filter(function (link) {
          return link.hash === '#contact';
        })[0];
        if (contactLink) current = contactLink;
      }

      spyLinks.forEach(function (link) {
        link.classList.toggle('is-active', link === current);
      });
      spyTicking = false;
    }

    window.addEventListener(
      'scroll',
      function () {
        if (!spyTicking) {
          spyTicking = true;
          window.requestAnimationFrame(updateSpy);
        }
      },
      { passive: true }
    );
    updateSpy();
  }

  /* ----------------------------------------------------------------------
     Copy email
     ---------------------------------------------------------------------- */
  var copyButtons = Array.prototype.slice.call(document.querySelectorAll('[data-copy]'));

  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  copyButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var text = button.getAttribute('data-copy') || '';
      var status = document.querySelector('[data-copy-status]');
      var copyIcon = button.querySelector('[data-copy-icon]');
      var doneIcon = button.querySelector('[data-copy-done]');

      function finish(ok) {
        if (status) {
          status.textContent = ok ? 'Copied to clipboard' : 'Copy failed — select the address above';
        }
        if (copyIcon && doneIcon) {
          copyIcon.hidden = ok;
          doneIcon.hidden = !ok;
          window.setTimeout(function () {
            copyIcon.hidden = false;
            doneIcon.hidden = true;
            if (status) status.textContent = '';
          }, 2500);
        }
      }

      if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(
          function () {
            finish(true);
          },
          function () {
            finish(legacyCopy(text));
          }
        );
      } else {
        finish(legacyCopy(text));
      }
    });
  });
})();
