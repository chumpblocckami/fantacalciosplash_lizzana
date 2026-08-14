/**
 * The smallest stand-in for a browser that the render components need.
 *
 * js/components/table.js, scoreboard.js and chart.js all work the same way: they build an
 * HTML string, assign it to an element's innerHTML, and then look up a few elements by id to
 * fill in or wire up. Nothing here parses HTML -- querySelector hands back a fresh stub and
 * remembers it -- which is enough to drive the components and, more to the point, to read
 * back the exact markup they produced.
 */

/** An element that records what was written to it. */
class StubElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.innerHTML = '';
    this.textContent = '';
    this.id = '';
    this.href = '';
    this.download = '';
    this.disabled = false;
    this.dataset = {};
    this.style = {};
    this.children = [];
    this.listeners = {};
    this.selectors = new Map();
    this._classes = new Set();

    // classList and className are two views of the same set, as they are in a browser:
    // components here set className as a template string and then toggle classes on it.
    this.classList = {
      add: (...names) => names.forEach(name => this._classes.add(name)),
      remove: (...names) => names.forEach(name => this._classes.delete(name)),
      contains: name => this._classes.has(name),
      toggle: (name, force) => {
        if (force === true) {
          this._classes.add(name);
          return true;
        }
        if (force === false) {
          this._classes.delete(name);
          return false;
        }
        if (this._classes.delete(name)) return false;
        this._classes.add(name);
        return true;
      },
    };
  }

  get className() {
    return [...this._classes].join(' ');
  }

  set className(value) {
    this._classes = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  /** Return a stable stub for a selector, creating it the first time it is asked for. */
  querySelector(selector) {
    if (!this.selectors.has(selector)) this.selectors.set(selector, new StubElement());
    return this.selectors.get(selector);
  }

  /** Nothing is parsed, so there are never any matches to iterate. */
  querySelectorAll() {
    return [];
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter(c => c !== child);
  }

  remove() {}

  addEventListener(event, handler) {
    (this.listeners[event] ??= []).push(handler);
  }

  /** Invoke the handlers registered for an event, as a click or an input would. */
  dispatch(event, payload = {}) {
    for (const handler of this.listeners[event] ?? []) handler({ target: this, ...payload });
  }

  /** Everything this element and its lookups ever rendered, concatenated. */
  get renderedHtml() {
    return [this.innerHTML, ...[...this.selectors.values()].map(el => el.renderedHtml)].join('\n');
  }
}

/** Create a detached element to render into. */
export function element(tagName) {
  return new StubElement(tagName);
}

/**
 * Install a minimal `document` global, for components that call createElement.
 *
 * @returns {Function} Call to restore whatever was there before
 */
export function installDocument() {
  const previous = globalThis.document;
  globalThis.document = {
    createElement: tagName => new StubElement(tagName),
    addEventListener: () => {},
  };
  return () => { globalThis.document = previous; };
}
