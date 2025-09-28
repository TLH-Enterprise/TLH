document.addEventListener("DOMContentLoaded", function () {
  const navbar = document.querySelector(".navbar") as HTMLElement;
  const navToggle = document.getElementById("navToggle") as HTMLButtonElement;
  const navMenu = document.getElementById("navMenu") as HTMLElement;
  const navLinks = document.querySelectorAll(
    ".nav-link"
  ) as NodeListOf<HTMLAnchorElement>;

  if (!navbar || !navToggle || !navMenu) return;

  // Handle mobile menu toggle
  navToggle.addEventListener("click", function () {
    navToggle.classList.toggle("active");
    navMenu.classList.toggle("active");
  });

  // Handle smooth scrolling for navigation links
  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      const targetId = this.getAttribute("href");
      const targetElement = document.querySelector(targetId!) as HTMLElement;

      if (targetElement) {
        const offsetTop = targetElement.offsetTop - 100; // Account for floating navbar
        window.scrollTo({
          top: offsetTop,
          behavior: "smooth",
        });
      }

      // Close mobile menu if open
      navToggle.classList.remove("active");
      navMenu.classList.remove("active");
    });
  });

  // Handle active link highlighting
  window.addEventListener("scroll", function () {
    const sections = document.querySelectorAll(
      "section[id]"
    ) as NodeListOf<HTMLElement>;
    const scrollPos = window.scrollY + 150;

    sections.forEach((section) => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute("id");

      if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
        navLinks.forEach((link) => {
          link.classList.remove("active");
          if (link.getAttribute("href") === `#${sectionId}`) {
            link.classList.add("active");
          }
        });
      }
    });
  });
});
