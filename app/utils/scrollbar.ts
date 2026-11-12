// CSS px a scrollbar takes from layout (Windows, macOS set to always show them), 0 for overlay ones; --scrollbar-size
let size = 0;

export function scrollbarSize (): number {
  return size;
}

export function measureScrollbar (): number {
  const probe = document.createElement('div');
  probe.className = 'scrollbar-probe';
  document.documentElement.appendChild(probe);
  size = probe.offsetWidth - probe.clientWidth;
  probe.remove();
  document.documentElement.style.setProperty('--scrollbar-size', `${size}px`);
  return size;
}
