(function () {
  const template = document.createElement("template");
  template.innerHTML = `
    <style>
      :host {
        display: block;
        color: #1f2933;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        border: 1px solid #d8e8e5;
        border-radius: 8px;
        overflow: hidden;
        background: #ffffff;
        box-shadow: 0 16px 36px rgba(17, 65, 61, 0.12);
      }
      .head {
        display: grid;
        grid-template-columns: 1fr 82px;
        gap: 12px;
        align-items: center;
        padding: 16px;
        background: #0b5f5a;
        color: white;
      }
      h2, h3, p { margin: 0; letter-spacing: 0; }
      h2 { font-size: 18px; line-height: 1.2; }
      p { color: #63717a; line-height: 1.45; font-size: 13px; }
      .head p { color: rgba(255,255,255,.78); margin-top: 6px; }
      .ring {
        width: 82px;
        aspect-ratio: 1;
        border-radius: 50%;
        display: grid;
        place-items: center;
        position: relative;
        background: conic-gradient(#ffb020 calc(var(--score) * 1%), rgba(255,255,255,.18) 0);
      }
      .ring::before {
        content: "";
        position: absolute;
        inset: 8px;
        border-radius: inherit;
        background: #0b5f5a;
      }
      .ring strong, .ring span { position: relative; display: block; text-align: center; }
      .ring strong { font-size: 24px; line-height: 1; }
      .ring span { color: rgba(255,255,255,.72); font-size: 10px; font-weight: 800; }
      .body { padding: 14px; display: grid; gap: 10px; }
      .tag {
        width: fit-content;
        padding: 5px 8px;
        border-radius: 999px;
        background: #e6f6f3;
        color: #0b5f5a;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
      }
      .nudge {
        border: 1px solid #d8e8e5;
        border-radius: 8px;
        padding: 12px;
        background: #f7fbfa;
      }
      .nudge h3 { font-size: 15px; margin: 8px 0 6px; }
      .actions { display: flex; gap: 8px; }
      button {
        min-height: 38px;
        border: 1px solid #d8e8e5;
        border-radius: 8px;
        padding: 0 12px;
        background: white;
        color: #0b5f5a;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }
      button.primary {
        border-color: #10847e;
        background: #10847e;
        color: white;
      }
      .safety {
        color: #6d4a00;
        background: #fff8ea;
        border: 1px solid #ffe1ae;
        border-radius: 8px;
        padding: 10px;
        font-size: 12px;
      }
    </style>
    <article class="card">
      <section class="head">
        <div>
          <h2>Jyotish Arogya</h2>
          <p class="subtitle">Loading health intelligence...</p>
        </div>
        <div class="ring" style="--score:0"><div><strong>--</strong><span>HVI</span></div></div>
      </section>
      <section class="body"></section>
    </article>
  `;

  class JyotishArogyaElement extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this.shadowRoot.append(template.content.cloneNode(true));
    }

    connectedCallback() {
      this.load();
    }

    get apiBase() {
      return this.getAttribute("api-base") || "";
    }

    get userId() {
      return this.getAttribute("user-id") || "demo";
    }

    async load() {
      try {
        const response = await fetch(`${this.apiBase}/api/dashboard?userId=${encodeURIComponent(this.userId)}`);
        if (!response.ok) throw new Error("Dashboard unavailable");
        this.data = await response.json();
        this.render();
      } catch (error) {
        this.shadowRoot.querySelector(".body").innerHTML = `<p>Could not load Jyotish Arogya. Check the API base URL.</p>`;
      }
    }

    render() {
      const { hvi, nudge, dasha, transits } = this.data;
      this.shadowRoot.querySelector(".subtitle").textContent = `${hvi.label} signal · ${nudge.scheduledFor} nudge`;
      this.shadowRoot.querySelector(".ring").style.setProperty("--score", hvi.score);
      this.shadowRoot.querySelector(".ring strong").textContent = hvi.score;
      this.shadowRoot.querySelector(".body").innerHTML = `
        <div class="nudge">
          <span class="tag">${nudge.planet} · ${nudge.intensity}</span>
          <h3>${escapeHTML(nudge.title)}</h3>
          <p>${escapeHTML(nudge.action)}</p>
        </div>
        <p><strong>DRS ${dasha.score}:</strong> ${escapeHTML(dasha.label)}</p>
        <p><strong>Transit:</strong> ${escapeHTML(transits[0].title)}</p>
        <div class="actions">
          <button class="primary" type="button">Mark done</button>
          <button type="button">Open report</button>
        </div>
        <div class="safety">${escapeHTML(nudge.safetyNote)}</div>
      `;
      this.shadowRoot.querySelector(".primary").addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("jyotish:nudge-complete", {
          bubbles: true,
          composed: true,
          detail: { userId: this.userId, nudgeId: nudge.id }
        }));
        this.shadowRoot.querySelector(".primary").textContent = "Done";
      });
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  if (!customElements.get("jyotish-arogya-app")) {
    customElements.define("jyotish-arogya-app", JyotishArogyaElement);
  }

  window.JyotishArogya = {
    version: "0.1.0",
    mount(target, options = {}) {
      const host = typeof target === "string" ? document.querySelector(target) : target;
      if (!host) throw new Error("Jyotish Arogya mount target not found");
      const element = document.createElement("jyotish-arogya-app");
      if (options.userId) element.setAttribute("user-id", options.userId);
      if (options.apiBase) element.setAttribute("api-base", options.apiBase);
      if (options.compact) element.setAttribute("compact", "true");
      host.replaceChildren(element);
      return element;
    }
  };
})();
