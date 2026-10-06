/**
 * Startup failure screen (no Vue: the app never mounted). Explains what
 * likely happened and what to try, instead of leaving a blank page.
 */
export function renderBootError(
  container: HTMLElement,
  error: unknown,
  reload: () => void = () => window.location.reload(),
): void {
  const detail = error instanceof Error ? error.message : String(error)

  const panel = document.createElement('section')
  panel.className = 'boot-error'
  panel.setAttribute('role', 'alert')

  const title = document.createElement('h1')
  title.textContent = 'Mini Tanda could not start'

  const cause = document.createElement('p')
  cause.textContent =
    'Your data is stored in this browser, and the browser did not let the app open it. ' +
    'This happens in private or incognito windows, when storage is full, or when site data is blocked.'

  const steps = document.createElement('ul')
  for (const step of [
    'Reload the page. If you are in a private window, open Mini Tanda in a normal one.',
    'Free up storage space on this device, then reload.',
    'Once it opens again, use Settings → Export data to keep a backup.',
    'Clearing this site’s data in the browser settings resets the app, but deletes everything not exported.',
  ]) {
    const item = document.createElement('li')
    item.textContent = step
    steps.append(item)
  }

  const technical = document.createElement('p')
  technical.className = 'boot-error-detail'
  technical.textContent = `Details: ${detail}`

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Reload'
  button.addEventListener('click', () => reload())

  panel.append(title, cause, steps, technical, button)
  container.replaceChildren(panel)
  button.focus()
}
