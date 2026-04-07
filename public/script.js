(function () {
  const nav = document.querySelector(".nav");
  const toggle = document.querySelector(".menu-toggle");

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
      });
    });
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!reduceMotion) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { rootMargin: "0px 0px -48px 0px", threshold: 0.08 }
    );

    document.querySelectorAll(".reveal, .feature-card").forEach(function (el) {
      observer.observe(el);
    });
  } else {
    document.querySelectorAll(".reveal, .feature-card").forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  var form = document.querySelector(".cta-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var btn = form.querySelector("button[type='submit']");
      if (!input || !btn) return;
      var email = (input.value || "").trim();
      if (!email) {
        input.focus();
        return;
      }
      var original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "You're on the list";
      input.value = "";
      window.setTimeout(function () {
        btn.disabled = false;
        btn.textContent = original;
      }, 2200);
    });
  }
})();
