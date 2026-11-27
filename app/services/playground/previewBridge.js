// Injected at the top of every playground preview (see compileProject.mjs).
// The preview runs in a sandboxed iframe with an opaque origin, so the
// playground page can't look inside it. This script reports out instead,
// with postMessage:
//   console   console.* calls, uncaught errors and rejected promises
//   snapshot  a small outline of the page (title, h1s, task cards, input
//             values, a hash of the class attributes), sent
//             after every DOM change, used by the challenge checks
//   ready     the page has mounted
// and keeps the app working without real storage or navigation.
(function () {
  var BUILD = "__BUILD__";
  function post(msg) {
    msg.__tylixPlayground = true;
    msg.build = BUILD;
    try { parent.postMessage(msg, "*"); } catch (e) {}
  }

  // No storage in an opaque origin: give the app an in-memory one, so
  // code that uses localStorage still runs (it resets on every build).
  function memoryStorage() {
    var data = {};
    return {
      getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[String(k)] = String(v); },
      removeItem: function (k) { delete data[String(k)]; },
      clear: function () { data = {}; },
      key: function (i) { return Object.keys(data)[i] || null; },
      get length() { return Object.keys(data).length; }
    };
  }
  ["localStorage", "sessionStorage"].forEach(function (name) {
    try { window[name].getItem("x"); } catch (e) {
      try { Object.defineProperty(window, name, { value: memoryStorage(), configurable: true }); } catch (e2) {}
    }
  });

  function format(value, depth) {
    if (value instanceof Error) return value.name + ": " + value.message;
    if (typeof value === "string") return value;
    if (typeof value === "function") return "ƒ " + (value.name || "anonymous") + "()";
    if (typeof value === "undefined") return "undefined";
    if (value && typeof Node !== "undefined" && value instanceof Node) return "<" + String(value.nodeName).toLowerCase() + ">";
    try {
      var seen = [];
      var json = JSON.stringify(value, function (key, v) {
        if (v && typeof v === "object") {
          if (seen.indexOf(v) !== -1) return "[circular]";
          seen.push(v);
        }
        return v;
      }, depth ? 2 : 0);
      return json === undefined ? String(value) : json;
    } catch (e) {
      return String(value);
    }
  }

  ["log", "info", "warn", "error", "debug"].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      var parts = [];
      for (var i = 0; i < arguments.length; i++) parts.push(format(arguments[i]));
      var text = parts.join(" ");
      if (text.length > 4000) text = text.slice(0, 4000) + "…";
      post({ type: "console", level: level === "debug" ? "log" : level, text: text });
      if (original) original.apply(console, arguments);
    };
  });

  window.addEventListener("error", function (event) {
    var where = event.lineno ? " (generated code, line " + event.lineno + ")" : "";
    post({ type: "console", level: "error", text: "Uncaught " + (event.error ? format(event.error) : event.message) + where });
  });
  window.addEventListener("unhandledrejection", function (event) {
    post({ type: "console", level: "error", text: "Unhandled promise rejection: " + format(event.reason) });
  });

  // Links would load the docs site inside the preview (which refuses to
  // be framed). Hash links still work.
  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!link) return;
    var href = link.getAttribute("href") || "";
    if (href.charAt(0) === "#") return;
    event.preventDefault();
    post({ type: "console", level: "info", text: "The preview doesn't follow links (" + href + "). In a real app this opens the page." });
  }, true);

  function snapshot() {
    var headings = [];
    var h1s = document.querySelectorAll("h1");
    for (var i = 0; i < h1s.length && i < 5; i++) headings.push((h1s[i].textContent || "").trim());
    var tasks = [];
    var cards = document.querySelectorAll("[data-task]");
    for (var j = 0; j < cards.length && j < 300; j++) {
      tasks.push({ id: cards[j].getAttribute("data-task"), status: cards[j].getAttribute("data-status") });
    }
    var text = document.body ? (document.body.innerText || "") : "";
    // What's typed in the page's inputs, and a hash of every class
    // attribute (so a check can tell that a class: directive flipped).
    var inputs = [];
    var fields = document.querySelectorAll("input:not([type=checkbox]):not([type=radio]), textarea");
    for (var k = 0; k < fields.length && k < 20; k++) inputs.push(String(fields[k].value || "").slice(0, 200));
    var classes = 5381;
    var styled = document.querySelectorAll("[class]");
    for (var n = 0; n < styled.length && n < 2000; n++) {
      var c = styled[n].getAttribute("class") + "|";
      for (var q = 0; q < c.length; q++) classes = ((classes * 33) ^ c.charCodeAt(q)) >>> 0;
    }
    return { title: document.title, headings: headings, tasks: tasks, text: text.slice(0, 3000), inputs: inputs, classes: String(classes) };
  }

  var timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(function () { post({ type: "snapshot", snapshot: snapshot() }); }, 120);
  }

  document.addEventListener("DOMContentLoaded", function () {
    new MutationObserver(schedule).observe(document.documentElement, {
      subtree: true, childList: true, attributes: true, characterData: true
    });
    // Typing changes an input's value without touching the DOM.
    document.addEventListener("input", schedule, true);
    setTimeout(function () { post({ type: "ready" }); schedule(); }, 0);
  });
})();
