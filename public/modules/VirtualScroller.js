export class VirtualScroller {
  constructor(container, options = {}) {
    this.container = container;
    this.items = [];
    this.renderedItems = new Map();
    this.itemHeight = options.itemHeight || 60;
    this.bufferSize = options.bufferSize || 10;
    this.maxDOM = options.maxDOM || 50;
    this.scrollTop = 0;
    this.containerHeight = 0;
    this.totalHeight = 0;
    this.isScrolling = false;
    this.scrollTimeout = null;
    this.renderCallback = options.renderItem || null;
    this.lastRange = { start: 0, end: 0 };

    this.spacerTop = document.createElement("div");
    this.spacerTop.className = "vs-spacer-top";
    this.spacerBottom = document.createElement("div");
    this.spacerBottom.className = "vs-spacer-bottom";
    this.content = document.createElement("div");
    this.content.className = "vs-content";

    this.init();
  }

  init() {
    this.container.innerHTML = "";
    this.container.style.overflow = "auto";
    this.container.style.position = "relative";
    this.container.appendChild(this.spacerTop);
    this.container.appendChild(this.content);
    this.container.appendChild(this.spacerBottom);

    this.container.addEventListener("scroll", () => {
      this.scrollTop = this.container.scrollTop;
      if (!this.isScrolling) {
        this.isScrolling = true;
        requestAnimationFrame(() => this.render());
      }
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        this.isScrolling = false;
      }, 150);
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.containerHeight = this.container.clientHeight;
      this.render();
    });
    this.resizeObserver.observe(this.container);

    this.containerHeight = this.container.clientHeight;
    console.log("[VirtualScroller] Initialized");
  }

  setItems(items) {
    this.items = items;
    this.totalHeight = items.length * this.itemHeight;
    this.render();
  }

  addItem(item) {
    this.items.push(item);
    this.totalHeight = this.items.length * this.itemHeight;
    this.render();
    this.scrollToBottom();
  }

  getVisibleRange() {
    const start = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const end = Math.min(this.items.length, start + visibleCount + this.bufferSize * 2);
    return { start, end };
  }

  render() {
    const { start, end } = this.getVisibleRange();

    if (start === this.lastRange.start && end === this.lastRange.end) {
      this.isScrolling = false;
      return;
    }

    this.lastRange = { start, end };

    this.spacerTop.style.height = (start * this.itemHeight) + "px";
    this.spacerBottom.style.height = ((this.items.length - end) * this.itemHeight) + "px";

    const fragment = document.createDocumentFragment();
    const toRender = this.items.slice(start, end);

    this.content.innerHTML = "";

    toRender.forEach((item, i) => {
      const index = start + i;
      let el = this.renderedItems.get(index);

      if (!el && this.renderCallback) {
        el = this.renderCallback(item, index);
        el.style.height = this.itemHeight + "px";
        this.renderedItems.set(index, el);
      }

      if (el) fragment.appendChild(el);
    });

    this.content.appendChild(fragment);

    for (const [key] of this.renderedItems) {
      if (key < start - this.bufferSize || key > end + this.bufferSize) {
        this.renderedItems.delete(key);
      }
    }

    this.isScrolling = false;
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      this.container.scrollTop = this.totalHeight;
    });
  }

  scrollToTop() {
    this.container.scrollTop = 0;
  }

  scrollToItem(index) {
    this.container.scrollTop = index * this.itemHeight;
  }

  getStats() {
    return {
      totalItems: this.items.length,
      renderedDOM: this.content.children.length,
      cacheSize: this.renderedItems.size,
      memoryEstimate: Math.round(this.renderedItems.size * 2) + "KB"
    };
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.renderedItems.clear();
    this.items = [];
    this.container.innerHTML = "";
  }
}

export default VirtualScroller;
