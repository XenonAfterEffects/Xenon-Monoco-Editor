(function () {
  "use strict";

  var DEFAULT_WELCOME_TEXT = "-- Welcome to Xenon Executer!";

  var state = {
    editor: null,
    pendingCode: "",
    resizeObserver: null,
    tabs: [],
    activeTabId: null,
    nextTabId: 1,
    nextUntitledIndex: 1,
    statusTimeoutId: null
  };

  var editorRoot = document.getElementById("editor-root");
  var statusElement = document.getElementById("status");
  var tabsElement = document.getElementById("tabs");
  var addTabButton = document.getElementById("add-tab-btn");

  function normalizeText(text) {
    if (text === null || text === undefined) {
      return "";
    }
    return String(text);
  }

  function setStatus(message) {
    if (!statusElement) {
      return;
    }

    if (!message) {
      statusElement.textContent = "";
      statusElement.classList.remove("is-visible");
      return;
    }

    statusElement.textContent = message;
    statusElement.classList.add("is-visible");
  }

  function showTemporaryStatus(message, durationMs) {
    setStatus(message);

    if (state.statusTimeoutId) {
      window.clearTimeout(state.statusTimeoutId);
      state.statusTimeoutId = null;
    }

    state.statusTimeoutId = window.setTimeout(function () {
      setStatus("");
      state.statusTimeoutId = null;
    }, durationMs || 1400);
  }

  function reportBootError(message, details) {
    setStatus(message);

    if (details) {
      console.error("[XenonMonaco]", details);
    } else {
      console.error("[XenonMonaco] " + message);
    }
  }

  function getActiveTab() {
    if (!state.activeTabId) {
      return null;
    }

    for (var i = 0; i < state.tabs.length; i += 1) {
      if (state.tabs[i].id === state.activeTabId) {
        return state.tabs[i];
      }
    }

    return null;
  }

  function getActiveModel() {
    var tab = getActiveTab();
    if (!tab) {
      return null;
    }
    return tab.model;
  }

  function nextUntitledName() {
    var name = "Untitled " + state.nextUntitledIndex;
    state.nextUntitledIndex += 1;
    return name;
  }

  function renderTabs() {
    if (!tabsElement) {
      return;
    }

    var canCloseAnyTab = state.tabs.length > 1;
    tabsElement.textContent = "";

    for (var i = 0; i < state.tabs.length; i += 1) {
      (function () {
        var tab = state.tabs[i];

        var tabButton = document.createElement("div");
        tabButton.className = "tab-item" + (tab.id === state.activeTabId ? " is-active" : "");
        tabButton.setAttribute("role", "tab");
        tabButton.setAttribute("tabindex", "0");
        tabButton.setAttribute("aria-selected", tab.id === state.activeTabId ? "true" : "false");
        tabButton.setAttribute("aria-label", tab.name);
        tabButton.title = tab.name;
        tabButton.addEventListener("click", function () {
          setActiveTab(tab.id, true);
        });
        tabButton.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setActiveTab(tab.id, true);
          }
        });

        var docIcon = document.createElement("span");
        docIcon.className = "tab-doc-icon";
        docIcon.setAttribute("aria-hidden", "true");
        tabButton.appendChild(docIcon);

        var title = document.createElement("span");
        title.className = "tab-title";
        title.textContent = tab.name;
        tabButton.appendChild(title);

        var closeButton = document.createElement("button");
        closeButton.type = "button";
        closeButton.className = "tab-close-btn";
        if (!canCloseAnyTab) {
          closeButton.className += " is-disabled";
          closeButton.disabled = true;
        }
        closeButton.setAttribute("aria-label", "Close " + tab.name);
        closeButton.title = "Close";
        closeButton.addEventListener("click", function (event) {
          event.stopPropagation();
          closeTab(tab.id);
        });
        tabButton.appendChild(closeButton);

        tabsElement.appendChild(tabButton);
      })();
    }
  }

  function setActiveTab(tabId, focusEditor) {
    if (!state.editor || !tabId) {
      return;
    }

    var currentTab = getActiveTab();
    if (currentTab) {
      currentTab.viewState = state.editor.saveViewState();
    }

    var nextTab = null;
    for (var i = 0; i < state.tabs.length; i += 1) {
      if (state.tabs[i].id === tabId) {
        nextTab = state.tabs[i];
        break;
      }
    }

    if (!nextTab) {
      return;
    }

    state.activeTabId = nextTab.id;
    state.editor.setModel(nextTab.model);

    if (nextTab.viewState) {
      state.editor.restoreViewState(nextTab.viewState);
    } else {
      state.editor.setScrollTop(0);
      state.editor.setScrollLeft(0);
    }

    renderTabs();

    if (focusEditor) {
      state.editor.focus();
    }
  }

  function createTab(options) {
    if (!window.monaco || !window.monaco.editor || !state.editor) {
      return null;
    }

    var config = options || {};
    var tab = {
      id: "tab-" + state.nextTabId,
      name: config.name || nextUntitledName(),
      model: window.monaco.editor.createModel(normalizeText(config.value || ""), "lua"),
      viewState: null
    };

    state.nextTabId += 1;
    state.tabs.push(tab);
    renderTabs();

    if (config.activate !== false) {
      setActiveTab(tab.id, true);
    }

    return tab;
  }

  function closeTab(tabId) {
    if (!state.editor || state.tabs.length === 0) {
      return;
    }

    if (state.tabs.length <= 1) {
      showTemporaryStatus("Open another tab before closing this one.", 1600);
      return;
    }

    var index = -1;
    for (var i = 0; i < state.tabs.length; i += 1) {
      if (state.tabs[i].id === tabId) {
        index = i;
        break;
      }
    }

    if (index === -1) {
      return;
    }

    var tabToClose = state.tabs[index];
    var wasActive = tabToClose.id === state.activeTabId;
    var fallbackActiveId = null;

    if (state.tabs.length > 1) {
      if (index > 0) {
        fallbackActiveId = state.tabs[index - 1].id;
      } else {
        fallbackActiveId = state.tabs[index + 1].id;
      }
    }

    state.tabs.splice(index, 1);
    tabToClose.model.dispose();

    if (wasActive && fallbackActiveId) {
      setActiveTab(fallbackActiveId, true);
    } else {
      renderTabs();
    }
  }

  function setCodeValue(text) {
    var value = normalizeText(text);
    var activeModel = getActiveModel();

    if (activeModel) {
      activeModel.setValue(value);
      return;
    }

    state.pendingCode = value;
  }

  function appendCodeValue(text) {
    var addition = normalizeText(text);
    var activeModel = getActiveModel();

    if (!addition) {
      return;
    }

    if (activeModel) {
      activeModel.setValue(activeModel.getValue() + addition);
      return;
    }

    state.pendingCode += addition;
  }

  // Public API for host interop (WebView2 / WinForms).
  window.setCode = function setCode(text) {
    setCodeValue(text);
  };

  window.getCode = function getCode() {
    var activeModel = getActiveModel();

    if (activeModel) {
      return activeModel.getValue();
    }

    return state.pendingCode;
  };

  window.clearCode = function clearCode() {
    setCodeValue("");
  };

  window.appendCode = function appendCode(text) {
    appendCodeValue(text);
  };

  // Helpful optional hook for host code to check readiness.
  window.isEditorReady = function isEditorReady() {
    return Boolean(state.editor);
  };

  if (!editorRoot || !tabsElement || !addTabButton) {
    reportBootError("Required editor DOM elements are missing.");
    return;
  }

  // Optional: disable right-click browser menu for a desktop-app feel.
  window.addEventListener("contextmenu", function (event) {
    event.preventDefault();
  });

  if (typeof window.require !== "function") {
    reportBootError("Monaco AMD loader missing. Expected ./min/vs/loader.js.");
    return;
  }

  // Monaco's current min/vs build handles worker routing internally.
  // Keep only global API exposure to stay compatible with AMD usage.
  window.MonacoEnvironment = window.MonacoEnvironment || {};
  window.MonacoEnvironment.globalAPI = true;

  if (typeof window.require.onError === "function") {
    var existingRequireErrorHandler = window.require.onError;
    window.require.onError = function (error) {
      reportBootError("Monaco module load error. Verify ./min/vs exists and is readable.", error);
      existingRequireErrorHandler(error);
    };
  } else {
    window.require.onError = function (error) {
      reportBootError("Monaco module load error. Verify ./min/vs exists and is readable.", error);
    };
  }

  window.require.config({
    paths: {
      vs: "./min/vs"
    }
  });

  function initializeEditor() {
    var monaco = window.monaco;

    if (!monaco || !monaco.editor) {
      reportBootError("Monaco loaded, but editor API is unavailable.");
      return;
    }

    monaco.editor.defineTheme("xenon-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#050505",
        "editorGutter.background": "#050505",
        "editorLineNumber.foreground": "#6a727d",
        "editorLineNumber.activeForeground": "#e3e8ee",
        "editorCursor.foreground": "#d7d7d7",
        "editor.selectionBackground": "#0d0d0d",
        "editor.inactiveSelectionBackground": "#0d0d0d",
        "editor.lineHighlightBackground": "#0b0b0b"
      }
    });

    state.editor = monaco.editor.create(editorRoot, {
      value: "",
      language: "lua",
      theme: "xenon-dark",
      lineNumbers: "on",
      minimap: { enabled: false },
      smoothScrolling: true,
      wordWrap: "on",
      contextmenu: false,
      automaticLayout: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      scrollBeyondLastLine: false,
      renderLineHighlight: "line",
      overviewRulerBorder: false,
      fontSize: 14,
      lineHeight: 22,
      padding: { top: 12, bottom: 12 }
    });

    state.editor.onDidBlurEditorText(function () {
      var activeTab = getActiveTab();
      if (activeTab) {
        activeTab.viewState = state.editor.saveViewState();
      }
    });

    addTabButton.addEventListener("click", function () {
      createTab({ value: "", activate: true });
    });

    createTab({
      name: nextUntitledName(),
      value: state.pendingCode ? state.pendingCode : DEFAULT_WELCOME_TEXT,
      activate: true
    });
    state.pendingCode = "";

    if (typeof ResizeObserver === "function") {
      state.resizeObserver = new ResizeObserver(function () {
        if (state.editor) {
          state.editor.layout();
        }
      });
      state.resizeObserver.observe(editorRoot);
    } else {
      window.addEventListener("resize", function () {
        if (state.editor) {
          state.editor.layout();
        }
      });
    }

    setStatus("");
    state.editor.focus();

    // Let host code know when editor is ready.
    window.dispatchEvent(new CustomEvent("xenon-monaco-ready"));
  }

  window.require(["vs/editor/editor.main"], initializeEditor, function (error) {
    reportBootError("Unable to load Monaco main module.", error);
  });

  window.addEventListener("beforeunload", function () {
    if (state.resizeObserver) {
      state.resizeObserver.disconnect();
    }
    if (state.statusTimeoutId) {
      window.clearTimeout(state.statusTimeoutId);
      state.statusTimeoutId = null;
    }

    for (var i = 0; i < state.tabs.length; i += 1) {
      state.tabs[i].model.dispose();
    }
    state.tabs = [];
    state.activeTabId = null;

    if (state.editor) {
      state.editor.dispose();
      state.editor = null;
    }
  });
})();
