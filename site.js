const frames = {
  start: {
    file: "align-start.webp",
    step: 0,
    alt: "Three unaligned pink blocks and a ruler sit between two grippers.",
    description: "At step 0, three blocks sit in front of the ruler before the robot moves.",
  },
  push: {
    file: "align-push.webp",
    step: 81,
    alt: "The robot uses a ruler to push three pink blocks into a line.",
    description: "At step 81, the robot uses a ruler to push three blocks into alignment.",
  },
  finish: {
    file: "align-finish.webp",
    step: 135,
    alt: "Three pink blocks sit in a line as the robot returns to its initial pose.",
    description: "At step 135, the benchmark reports task success and a score of 100.",
  },
};

const frameImage = document.querySelector("#run-frame");
const frameDirectory = new URL(".", frameImage.src);
const cameraLabel = document.querySelector("#camera-label");
const frameNote = document.querySelector("#run-note");
const frameControls = document.querySelector(".run-steps");
const frameButtons = [...frameControls.querySelectorAll("button")];

frameControls.hidden = false;
for (const button of frameButtons) {
  button.addEventListener("click", () => {
    const frame = frames[button.dataset.frame];
    frameImage.src = new URL(frame.file, frameDirectory).href;
    frameImage.alt = frame.alt;
    cameraLabel.textContent = `Head camera · Step ${frame.step}`;
    frameNote.textContent = frame.description;

    for (const frameButton of frameButtons) {
      frameButton.setAttribute("aria-pressed", String(frameButton === button));
    }
  });
}

const copyButton = document.querySelector("[data-copy]");
const copyStatus = document.querySelector("#copy-status");
const source = document.getElementById(copyButton.dataset.copy);
let copyReset;

copyButton.hidden = false;
copyButton.addEventListener("click", async () => {
  clearTimeout(copyReset);

  try {
    await navigator.clipboard.writeText(source.textContent);
    copyButton.textContent = "Copied";
    copyStatus.textContent = "Commands copied to the clipboard.";
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(source);
    selection.removeAllRanges();
    selection.addRange(range);
    copyButton.textContent = "Text selected";
    copyStatus.textContent = "Use the browser's copy command to copy the selected text.";
  }

  copyReset = setTimeout(() => {
    copyButton.textContent = "Copy commands";
    copyStatus.textContent = "";
  }, 2500);
});

const contents = document.querySelector(".contents");
const contentsLinks = [...contents.querySelectorAll("a")];
const sections = contentsLinks.map((link) => document.querySelector(link.hash));
const sidebarLayout = window.matchMedia("(min-width: 980px)");
const contentsDisclosure = contents.closest(".project-toc");

if (contentsDisclosure) {
  const desktopContents = window.matchMedia("(min-width: 1080px)");
  const summary = contentsDisclosure.querySelector("summary");
  const setContentsLayout = () => { contentsDisclosure.open = desktopContents.matches; };

  desktopContents.addEventListener("change", setContentsLayout);
  setContentsLayout();

  contents.addEventListener("click", (event) => {
    if (!desktopContents.matches && event.target.closest("a")) contentsDisclosure.open = false;
  });
  contentsDisclosure.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !desktopContents.matches && contentsDisclosure.open) {
      contentsDisclosure.open = false;
      summary.focus();
    }
  });
}

function updateContents() {
  const scrollPadding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
  const readingLine = contentsDisclosure
    ? scrollPadding + 22
    : sidebarLayout.matches ? 140 : contents.getBoundingClientRect().bottom + 22;
  let current = 0;

  // A short final section may never reach the reading line.
  if (document.documentElement.scrollHeight - window.scrollY - window.innerHeight < 4) {
    current = sections.length - 1;
  } else {
    for (const [index, section] of sections.entries()) {
      if (section.getBoundingClientRect().top > readingLine) break;
      current = index;
    }
  }

  for (const [index, link] of contentsLinks.entries()) {
    if (index === current) {
      link.setAttribute("aria-current", "location");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

let pendingContentsUpdate = false;
function scheduleContentsUpdate() {
  if (pendingContentsUpdate) return;
  pendingContentsUpdate = true;
  requestAnimationFrame(() => {
    pendingContentsUpdate = false;
    updateContents();
  });
}

window.addEventListener("scroll", scheduleContentsUpdate, { passive: true });
window.addEventListener("resize", scheduleContentsUpdate);
window.addEventListener("load", scheduleContentsUpdate);
updateContents();
