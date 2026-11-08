// resolves once what's under `root` has stopped building itself (no node added or taken away for three frames running),
// or after MAX_MS whatever it's doing: a view mounting its boxes or rows a few a frame
const MAX_MS = 1600;

export function whenSettled (root: Element): Promise<void> {
  return new Promise((resolve) => {
    let quiet = 0;
    let frame = 0;
    const observer = new MutationObserver(() => {
      quiet = 0;
    });
    const done = () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, MAX_MS);
    const tick = () => {
      quiet++;
      if (quiet >= 3) {
        done();
      } else {
        frame = window.requestAnimationFrame(tick);
      }
    };
    observer.observe(root, { childList: true, subtree: true });
    frame = window.requestAnimationFrame(tick);
  });
}
