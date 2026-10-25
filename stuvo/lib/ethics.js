// ─── Ethics page render module — #/ethics ───────────────────────────────────
// Read-only guide. All guide body text comes from /lib/ethicsContent.js
// Chrome strings use the existing i18n t() lookup with English fallback.
// Zero network, zero storage except local keys stuvo_ethics_checklist_v1,
// stuvo_ethics_scenarios_v1, stuvo_ethics_read_v1, stuvo_ethics_mode_v1.
(function () {
  'use strict';

  var ROOT_ID = 'ethics-root';
  var STORAGE_KEY = 'stuvo_ethics_checklist_v1';
  var SCENARIO_STORAGE_KEY = 'stuvo_ethics_scenarios_v1';
  var READ_STORAGE_KEY = 'stuvo_ethics_read_v1';
  var MODE_STORAGE_KEY = 'stuvo_ethics_mode_v1';
  var TOTAL_ITEMS = 10;
  var SCENARIO_TOTAL = 10;
  var TOTAL_PARTS = 9;

  var currentLang = function () {
    try { return window.currentUserLanguage || 'en'; } catch (e) { return 'en'; }
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function t(key, def) {
    try {
      if (typeof window.t === 'function') {
        var v = window.t(key, def);
        if (v !== key) return v;
      }
    } catch (e) {}
    return def !== undefined ? def : key;
  }

  function todayKey() {
    try { return new Date().toISOString().slice(0, 10); } catch (e) { return ''; }
  }

  function wordCount(text) {
    return String(text == null ? '' : text).trim().split(/\s+/).filter(Boolean).length;
  }

  // ─── Read progress state (Parts 1-9) ──────────────────────────────────────
  var readParts = [];
  var readPartsDirty = false;

  function loadReadState() {
    readParts = [];
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(READ_STORAGE_KEY) || 'null'); } catch (e) { stored = null; }
    if (stored && Array.isArray(stored.parts)) {
      for (var i = 0; i < stored.parts.length; i++) {
        readParts.push(Number(stored.parts[i]));
      }
    }
    readPartsDirty = false;
  }

  function saveReadState() {
    if (!readPartsDirty) return;
    try {
      localStorage.setItem(READ_STORAGE_KEY, JSON.stringify({ parts: readParts, updated: todayKey() }));
    } catch (e) {}
    readPartsDirty = false;
  }

  function toggleReadPart(partNum) {
    var idx = readParts.indexOf(partNum);
    if (idx >= 0) {
      readParts.splice(idx, 1);
    } else {
      readParts.push(partNum);
      readParts.sort(function (a, b) { return a - b; });
    }
    readPartsDirty = true;
    saveReadState();
    updateReadProgressUI();
    updateReadChipDots();
  }

  function isReadPart(partNum) {
    return readParts.indexOf(partNum) >= 0;
  }

  function readCount() {
    return readParts.length;
  }

  // ─── Simple / expanded mode state ─────────────────────────────────────────
  // mode: "full" | "simple". expandedParts: Set of part nums shown full in simple mode (not persisted).
  var mode = 'full';
  var modeDirty = false;
  var expandedParts = new Set();

  function loadModeState() {
    mode = 'full';
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(MODE_STORAGE_KEY) || 'null'); } catch (e) { stored = null; }
    if (stored && (stored.mode === 'full' || stored.mode === 'simple')) mode = stored.mode;
    else mode = 'full';
    modeDirty = false;
  }

  function saveModeState() {
    if (!modeDirty) return;
    try {
      localStorage.setItem(MODE_STORAGE_KEY, JSON.stringify({ mode: mode, updated: todayKey() }));
    } catch (e) {}
    modeDirty = false;
  }

  function toggleMode() {
    var scrollY = window.scrollY;
    mode = mode === 'full' ? 'simple' : 'full';
    modeDirty = true;
    saveModeState();
    expandedParts.clear();
    renderEthics(window.location.hash);
    window.scrollTo(0, scrollY);
  }

  function isSimpleMode(partNum) {
    return mode === 'simple' && !expandedParts.has(partNum);
  }

  function expandPart(partNum) {
    var scrollY = window.scrollY;
    expandedParts.add(partNum);
    renderEthics(window.location.hash);
    window.scrollTo(0, scrollY);
  }

  function collapsePart(partNum) {
    var scrollY = window.scrollY;
    expandedParts.delete(partNum);
    renderEthics(window.location.hash);
    window.scrollTo(0, scrollY);
  }

  // ─── TTS state ────────────────────────────────────────────────────────────
  var currentUtterance = null;
  var speakingPartId = null;
  var ttsAvailable = typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';

  function chunkText(text, maxChars) {
    if (!text) return [];
    maxChars = maxChars || 200;
    var chunks = [];
    var remaining = String(text);
    while (remaining.length > maxChars) {
      var cut = remaining.lastIndexOf('.', maxChars);
      if (cut === -1 || cut === 0) cut = remaining.lastIndexOf(' ', maxChars);
      if (cut === -1 || cut === 0) cut = maxChars;
      chunks.push(remaining.slice(0, cut + 1).trim());
      remaining = remaining.slice(cut + 1).trim();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
  }

  function buildSpokenText(partNum, lang) {
    var parts = window.ETHICS_CONTENT || [];
    var part = null;
    for (var p = 0; p < parts.length; p++) {
      if (parts[p].part === partNum) { part = parts[p]; break; }
    }
    if (!part) return '';
    var simple = isSimpleMode(partNum);
    var texts = [];
    texts.push(String(part.partTitle || ''));
    texts.push(String(part.summary || ''));
    var bullets = part.topics || [];
    for (var t = 0; t < bullets.length; t++) {
      var topic = bullets[t];
      texts.push(String(topic.title || ''));
      if (simple && Array.isArray(part.simple)) {
        for (var s = 0; s < part.simple.length; s++) {
          texts.push(String(part.simple[s] || ''));
        }
        break;
      } else {
        var topicBullets = topic.bullets || [];
        for (var b = 0; b < topicBullets.length; b++) {
          var item = topicBullets[b];
          var txt = typeof item === 'object' ? item.text : item;
          texts.push(String(txt || ''));
        }
        if (topic.table) {
          for (var r = 0; r < topic.table.rows.length; r++) {
            for (var c = 0; c < topic.table.rows[r].length; c++) {
              texts.push(String(topic.table.rows[r][c] || ''));
            }
          }
        }
      }
    }
    return texts.filter(function (x) { return x && x.length > 0; }).join('. ');
  }

  function speakPart(partNum, lang) {
    if (!ttsAvailable) return;
    cancelSpeech();
    var text = buildSpokenText(partNum, lang);
    if (!text) return;
    var chunks = chunkText(text, 200);
    var chunkIdx = 0;
    function speakNext() {
      if (chunkIdx >= chunks.length) { speakingPartId = null; return; }
      var utterance = new SpeechSynthesisUtterance(chunks[chunkIdx]);
      var langCode = lang === 'hi' ? 'hi-IN' : 'en-IN';
      utterance.lang = langCode;
      utterance.onend = function () { chunkIdx++; speakNext(); };
      utterance.onerror = function () { chunkIdx++; speakNext(); };
      currentUtterance = utterance;
      speakingPartId = partNum;
      window.speechSynthesis.speak(utterance);
    }
    speakNext();
  }

  function cancelSpeech() {
    try { window.speechSynthesis.cancel(); } catch (e) {}
    currentUtterance = null;
    speakingPartId = null;
  }

  function isSpeakingPart(partNum) {
    return speakingPartId === partNum;
  }

  // ─── Checklist state ──────────────────────────────────────────────────────
  var checklist = [];
  var checklistDirty = false;

  function loadChecklist() {
    checklist = [];
    for (var i = 0; i < TOTAL_ITEMS; i++) checklist.push(false);
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { stored = null; }
    var today = todayKey();
    var resetNeeded = true;
    if (stored && stored.date === today && Array.isArray(stored.checked)) {
      resetNeeded = false;
      for (var i = 0; i < TOTAL_ITEMS; i++) {
        checklist[i] = Boolean(stored.checked[i]);
      }
    }
    checklistDirty = resetNeeded;
    if (resetNeeded) saveChecklist();
  }

  function saveChecklist() {
    if (!checklistDirty) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: todayKey(), checked: checklist }));
    } catch (e) {}
    checklistDirty = false;
  }

  function setCheck(index, checked) {
    if (index < 0 || index >= TOTAL_ITEMS) return;
    if (checklist[index] === checked) return;
    checklist[index] = checked;
    checklistDirty = true;
    saveChecklist();
    updateCounter();
    updateSelfCheckTrack();
  }

  function resetChecklist() {
    for (var i = 0; i < TOTAL_ITEMS; i++) checklist[i] = false;
    checklistDirty = true;
    saveChecklist();
    updateCounter();
    updateSelfCheckTrack();
  }

  function updateCounter() {
    var done = 0;
    for (var i = 0; i < TOTAL_ITEMS; i++) if (checklist[i]) done++;
    var el = document.getElementById('ethics-counter');
    if (el) el.textContent = done >= TOTAL_ITEMS ? t('ethics.allPartsRead', 'All 9 parts read')
      : String(done) + ' of 10';
    var attrEl = document.getElementById(ROOT_ID);
    if (attrEl) attrEl.setAttribute('aria-checked-count', String(done));
  }

  function updateSelfCheckTrack() {
    var done = 0;
    for (var i = 0; i < TOTAL_ITEMS; i++) if (checklist[i]) done++;
    var fill = document.getElementById('ethics-selfcheck-track-fill');
    if (fill) fill.style.transform = 'scaleX(' + (done / TOTAL_ITEMS) + ')';
  }

  // ─── Read progress UI ─────────────────────────────────────────────────────
  function updateReadProgressUI() {
    var done = readCount();
    var el = document.getElementById('ethics-read-count');
    if (el) {
      el.textContent = done >= TOTAL_PARTS ? t('ethics.allPartsRead', 'All 9 parts read')
        : t('ethics.partsRead', '{n} of 9 parts read').replace('{n}', String(done));
    }
  }

  function updateReadChipDots() {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.querySelectorAll('.ethics-chip').forEach(function (chip) {
      var target = chip.getAttribute('data-target');
      var m = target && target.match(/^ethics-part-(\d+)$/);
      if (!m) return;
      var partNum = Number(m[1]);
      var read = isReadPart(partNum);
      chip.setAttribute('aria-label', t('ethics.part', 'Part {n}').replace('{n}', String(partNum))
        + (read ? ', ' + t('ethics.read', 'Read') : ''));
      var dotWrap = chip.querySelector('.ethics-chip-read-dot');
      if (read) {
        if (!dotWrap) {
          var dot = document.createElement('span');
          dot.className = 'ethics-chip-read-dot';
          dot.setAttribute('aria-hidden', 'true');
          chip.appendChild(dot);
        }
      } else {
        if (dotWrap) {
          if (typeof dotWrap.remove === 'function') dotWrap.remove();
          else if (dotWrap.parentNode) dotWrap.parentNode.removeChild(dotWrap);
        }
      }
    });
  }

  // ─── Bullet rendering ─────────────────────────────────────────────────────
  function renderBullet(item, lang) {
    var takeaway = false;
    var text = item;
    if (typeof item === 'object' && item !== null) {
      text = item.text;
      takeaway = Boolean(item.takeaway);
    }
    text = esc(text);
    var parts = text.split(/: /);
    var labelHtml = '';
    var restHtml = text;
    if (parts.length > 1) {
      labelHtml = '<strong class="ethics-bullet-label">' + esc(parts[0]) + '</strong>: ';
      restHtml = parts.slice(1).join(': ');
    }
    var wrapper = lang === 'hi' ? ' lang="hi"' : '';
    if (takeaway) {
      return (
        '<div class="ethics-takeaway"' + wrapper + '>' +
        '<span class="ethics-takeaway-label">' + esc(t('ethics.takeawayLabel', 'KEY TAKEAWAY')) + '</span>' +
        '<p class="ethics-takeaway-text"' + wrapper + '>' + labelHtml + restHtml + '</p>' +
        '</div>'
      );
    }
    return '<li' + wrapper + '>' + labelHtml + restHtml + '</li>';
  }

  function renderTopicBullets(bullets, lang) {
    if (!bullets || !bullets.length) return '';
    var tookIndex = -1;
    for (var i = bullets.length - 1; i >= 0; i--) {
      var item = bullets[i];
      if (typeof item === 'object' && item !== null && item.takeaway) { tookIndex = i; break; }
    }
    var html = '';
    for (var i = 0; i < bullets.length; i++) {
      if (i === tookIndex) continue;
      html += renderBullet(bullets[i], lang);
    }
    if (tookIndex !== -1) {
      html += renderBullet(bullets[tookIndex], lang);
    }
    return html;
  }

  function findTopicById(id) {
    var parts = window.ETHICS_CONTENT || [];
    for (var p = 0; p < parts.length; p++) {
      if (!Array.isArray(parts[p].topics)) continue;
      for (var ti = 0; ti < parts[p].topics.length; ti++) {
        if (parts[p].topics[ti].id === id) return parts[p].topics[ti];
      }
    }
    return null;
  }

  // ─── Topic rendering ──────────────────────────────────────────────────────
  function renderTopic(topic, lang) {
    var title = topic.title;
    var bullets = topic.bullets;
    if (lang === 'hi' && topic.translations && topic.translations.hi) {
      if (topic.translations.hi.title) title = topic.translations.hi.title;
      if (Array.isArray(topic.translations.hi.bullets)) bullets = topic.translations.hi.bullets;
    }
    var wrapper = lang === 'hi' ? ' lang="hi"' : '';
    var body;
    if (topic.table) {
      var headCells = topic.table.headers.map(function (h) {
        return '<th scope="col">' + esc(h) + '</th>';
      }).join('');
      var bodyRows = topic.table.rows.map(function (row) {
        var cells = row.map(function (cell) {
          return '<td' + wrapper + '>' + esc(cell) + '</td>';
        }).join('');
        return '<tr>' + cells + '</tr>';
      }).join('');
      body =
        '<div class="ethics-table-wrap">' +
        '<table class="ethics-table"><caption' + wrapper + '>' + esc(topic.title) + '</caption>' +
        '<thead><tr>' + headCells + '</tr></thead>' +
        '<tbody>' + bodyRows + '</tbody>' +
        '</table></div>';
    } else {
      body = '<ul class="ethics-bullets">' + renderTopicBullets(bullets, lang) + '</ul>';
    }
    return (
      '<article class="glass-card ethics-topic" id="ethics-topic-' + topic.id + '">' +
      '<div class="ethics-topic-wrap">' +
      '<div class="ethics-topic-number" aria-hidden="true">' + String(topic.id) + '</div>' +
      '<div class="ethics-topic-content">' +
      '<h3 id="ethics-topic-' + topic.id + '-title"' + wrapper + '>' + esc(title) + '</h3>' +
      body +
      '</div>' +
      '</div>' +
      '</article>'
    );
  }

  // ─── Part header ──────────────────────────────────────────────────────────
  function buildPartHead(part, lang, isRead, listening) {
    var wrapper = lang === 'hi' ? ' lang="hi"' : '';
    var readLabel = isRead ? t('ethics.read', 'Read') : t('ethics.markRead', 'Mark as read');
    var listenLabel = isSpeakingPart(part.part) ? t('ethics.stopLabel', 'Stop') : t('ethics.listenLabel', 'Listen');
    var listenDisabled = !ttsAvailable ? ' disabled' : '';
    var listenVisible = ttsAvailable ? '' : ' style="display:none"';
    return (
      '<header class="ethics-part-head">' +
      '<p class="ethics-part-label"' + wrapper + '>' + t('ethics.partLabel', 'PART {n}').replace('{n}', String(part.part)) + '</p>' +
      '<h2 id="ethics-part-' + part.part + '-title"' + wrapper + '>' + esc(part.partTitle) + '</h2>' +
      '<p class="ethics-part-summary"' + wrapper + '>' + esc(part.summary || '') + '</p>' +
      '<div class="ethics-part-actions">' +
      '<button type="button" class="ethics-btn ethics-btn-text ethics-btn-read" data-action="ethics-read" data-part="' + String(part.part) + '" aria-pressed="' + (isRead ? 'true' : 'false') + '">' +
      esc(readLabel) + '</button>' +
      '<button type="button" class="ethics-btn ethics-btn-text ethics-btn-listen" data-action="ethics-listen" data-part="' + String(part.part) + '"' + listenDisabled + listenVisible + ' aria-pressed="' + (listening ? 'true' : 'false') + '">' +
      esc(listenLabel) + '</button>' +
      '</div>' +
      '</header>'
    );
  }

  function buildSimpleWordsPanel(part, lang) {
    var wrapper = lang === 'hi' ? ' lang="hi"' : '';
    if (!Array.isArray(part.simple) || part.simple.length === 0) return '';
    var linesHtml = part.simple.map(function (line) {
      return '<li' + wrapper + '>' + esc(line) + '</li>';
    }).join('');
    return (
      '<div class="ethics-simple-panel glass-card">' +
      '<h3 class="ethics-simple-title"' + wrapper + '>' + esc(t('ethics.simpleWordsTitle', 'In simple words')) + '</h3>' +
      '<ul class="ethics-simple-list">' + linesHtml + '</ul>' +
      '</div>'
    );
  }

  function buildPartSection(part, lang, readParts) {
    var isRead = readParts.indexOf(part.part) >= 0;
    var listening = isSpeakingPart(part.part);
    var sectionClass = 'ethics-part';
    if (part.part === TOTAL_PARTS) sectionClass += ' ethics-last-part';
    var sectionHtml =
      '<section class="' + sectionClass + '" id="ethics-part-' + part.part + '" aria-labelledby="ethics-part-' + part.part + '-title">' +
      buildPartHead(part, lang, isRead, listening);
    if (isSimpleMode(part.part)) {
      sectionHtml += buildSimpleWordsPanel(part, lang);
      sectionHtml += '<button type="button" class="ethics-btn ethics-btn-text ethics-btn-show-full" data-action="ethics-show-full" data-part="' + String(part.part) + '">' +
        esc(t('ethics.showFull', 'Show full version of this Part')) + '</button>';
    } else {
      sectionHtml += '<div class="ethics-part-topics">';
      part.topics.forEach(function (topic) {
        sectionHtml += renderTopic(topic, lang);
      });
      sectionHtml += '</div>';
      if (mode === 'simple' && expandedParts.has(part.part)) {
        sectionHtml += '<button type="button" class="ethics-btn ethics-btn-text ethics-btn-show-simple" data-action="ethics-show-simple" data-part="' + String(part.part) + '">' +
          esc(t('ethics.showSimple', 'Show simple version')) + '</button>';
      }
    }
    if (part.part === TOTAL_PARTS) {
      sectionHtml +=
        '<div class="ethics-clear-progress-wrap">' +
        '<button type="button" class="ethics-btn ethics-btn-text ethics-btn-clear-progress" data-action="ethics-clear-progress" id="ethics-btn-clear-progress">' +
        esc(t('ethics.clearProgress', 'Clear progress')) + '</button>' +
        '</div>';
    }
    sectionHtml += '</section>';
    return sectionHtml;
  }

  // ─── Part observer (active chip tracking) ─────────────────────────────────
  function setupPartObserver() {
    try {
      if (window._ethicsPartObserver) { window._ethicsPartObserver.disconnect(); }
      window._ethicsPartObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = entry.target.id;
          var activeChip = null;
          document.querySelectorAll('.ethics-chip').forEach(function (c) {
            var isActive = c.getAttribute('data-target') === id;
            c.classList.toggle('active', isActive);
            c.setAttribute('aria-current', isActive ? 'true' : 'false');
            if (isActive) activeChip = c;
          });
          if (activeChip) {
            activeChip.scrollIntoView({ inline: 'center', block: 'nearest' });
          }
        });
      }, { rootMargin: '-30% 0px -60% 0px' });
      document.querySelectorAll('.ethics-part').forEach(function (section) {
        window._ethicsPartObserver.observe(section);
      });
    } catch (e) {}
  }

  // ─── Scenarios state (Prompt A Feature 2) ─────────────────────────────────
  var scenarioChoices = {};
  var scenarioIndex = 0;
  var scenarioScore = 0;
  var scenarioCompleted = false;

  function shuffleSeeded(arr) {
    var copy = arr.slice(), i = copy.length, tmp, idx;
    while (i) { idx = Math.floor(Math.random() * i); i--; tmp = copy[i]; copy[i] = copy[idx]; copy[idx] = tmp; }
    return copy;
  }

  function chooseOption(index) {
    if (scenarioChoices[scenarioIndex] !== undefined) return;
    scenarioChoices[scenarioIndex] = index;
    var scenario = window.ETHICS_SCENARIOS && window.ETHICS_SCENARIOS[scenarioIndex];
    if (scenario && scenario.options && scenario.options[index] && scenario.options[index].best) scenarioScore++;
    var section = document.getElementById('ethics-scenarios');
    if (section) section.innerHTML = renderScenariosSection(currentLang());
  }

  function advanceScenario() {
    var total = (window.ETHICS_SCENARIOS || []).length;
    scenarioIndex++;
    if (scenarioIndex >= total) { scenarioCompleted = true; scenarioIndex = 0; }
    else { scenarioChoices[scenarioIndex] = undefined; }
    var section = document.getElementById('ethics-scenarios');
    if (section) section.innerHTML = renderScenariosSection(currentLang());
  }

  function resetScenarioState() {
    scenarioChoices = {}; scenarioIndex = 0; scenarioScore = 0; scenarioCompleted = false;
    var section = document.getElementById('ethics-scenarios');
    if (section) section.innerHTML = renderScenariosSection(currentLang());
  }

  // ─── Scenarios section (Prompt A Feature 2) ───────────────────────────────
  function renderScenarioOption(option, index) {
    var chosen = scenarioChoices[scenarioIndex] !== undefined;
    var chosenThis = chosen && scenarioChoices[scenarioIndex] === index;
    var disabled = chosen ? 'disabled' : '';
    var selectedClass = chosenThis ? ' ethics-option-selected' : '';
    return (
      '<button type="button" class="ethics-option-btn' + selectedClass + '" data-action="ethics-option" data-option="' + String(index) + '" data-best="' + (option.best ? '1' : '0') + '" ' + disabled + '>' +
      esc(option.text) +
      '</button>'
    );
  }

  function renderScenarioResult(scenario, chosenIndex) {
    var option = scenario.options && scenario.options[chosenIndex];
    if (!option) return '';
    var isCorrect = Boolean(option.best);
    var label = isCorrect ? t('ethics.scenarioStrong', 'A STRONG CHOICE') : t('ethics.scenarioThinkAgain', 'THINK AGAIN');
    var topic = findTopicById(option.topicId);
    devCheckRendered(label, 'scenario result label');
    devCheckRendered(option.why, 'scenario explanation');
    devCheckRendered(topic ? topic.title : option.topicId, 'scenario related topic');
    var topicLink = topic ? ('<a href="#ethics-topic-' + option.topicId + '" class="ethics-scenario-topic-link" data-action="ethics-scroll" data-target="ethics-topic-' + option.topicId + '">' + esc(topic.title) + '</a>') : esc(String(option.topicId));
    return (
      '<div class="ethics-scenario-result">' +
      '<span class="ethics-scenario-result-label">' + esc(label) + '</span>' +
      '<p class="ethics-scenario-result-text">' + esc(option.why) + '</p>' +
      '<p class="ethics-scenario-result-topic"><span class="ethics-scenario-result-topic-label">' + esc(t('ethics.scenarioRelated', 'Related topic')) + ': </span>' + topicLink + '</p>' +
      '</div>'
    );
  }

  function renderScenariosSection(lang) {
    var wrapperAttr = lang === 'hi' ? ' lang="hi"' : '';
    var scenario = window.ETHICS_SCENARIOS && window.ETHICS_SCENARIOS[scenarioIndex];
    if (!scenario) scenario = { situation: '', options: [], topicId: 0 };
    var chosenIndex = scenarioChoices[scenarioIndex];
    var hasResult = chosenIndex !== undefined;
    var opts = shuffleSeeded(scenario.options || []);
    var optsHtml = opts.map(function (o, i) { return renderScenarioOption(o, i); }).join('');
    var resultHtml = hasResult ? renderScenarioResult(scenario, chosenIndex) : '';
    var headerHtml;
    var buttonsHtml;
    if (scenarioCompleted) {
      headerHtml =
        '<div class="ethics-scenario-header">' +
        '<span class="ethics-scenario-label">' + esc(t('ethics.scenarioLabel', 'Scenario {n} of 10').replace('{n}', String(SCENARIO_TOTAL))) + '</span>' +
        '<h2 class="ethics-scenario-title">' + esc(t('ethics.scenariosTitle', 'What would you do?')) + '</h2>' +
        '</div>';
      buttonsHtml =
        '<p class="ethics-scenario-score">' + esc(t('ethics.scenarioScore', 'You chose the strongest option {n} times out of 10.').replace('{n}', String(scenarioScore))) + '</p>' +
        '<button type="button" class="ethics-btn ethics-btn-primary" data-action="ethics-reset-scenarios">' + esc(t('ethics.scenarioTryAgain', 'Try again')) + '</button>';
    } else {
      headerHtml =
        '<div class="ethics-scenario-header">' +
        '<span class="ethics-scenario-label">' + esc(t('ethics.scenarioLabel', 'Scenario {n} of 10').replace('{n}', String(scenarioIndex + 1))) + '</span>' +
        '<button type="button" class="ethics-btn ethics-btn-text ethics-scenario-skip" data-action="ethics-skip">' + esc(t('ethics.scenarioSkip', 'Skip')) + '</button>' +
        '</div>' +
        '<h2 class="ethics-scenario-title">' + esc(scenario.situation) + '</h2>' +
        '<div class="ethics-scenario-options">' + optsHtml + '</div>' +
        resultHtml +
        (hasResult ? '<button type="button" class="ethics-btn ethics-btn-primary" data-action="ethics-next">' + esc(t('ethics.scenarioNext', 'Next scenario')) + '</button>' : '');
    }
    return (
      '<section class="ethics-part ethics-scenarios-section" id="ethics-scenarios" aria-labelledby="ethics-scenarios-title"' + wrapperAttr + '>' +
      '<div class="ethics-part-head">' +
      '<span class="ethics-part-label">' + t('ethics.scenariosLabel', 'Scenarios') + '</span>' +
      '<h2 id="ethics-scenarios-title">' + esc(t('ethics.scenariosTitle', 'What would you do?')) + '</h2>' +
      '<p class="ethics-part-summary">' + esc(t('ethics.scenariosSummary', 'Ten real situations. Choose what you would do, then see why.')) + '</p>' +
      '</div>' +
      '<div class="glass-card ethics-scenarios-panel">' +
      '<div class="ethics-scenario-content">' +
      headerHtml +
      buttonsHtml +
      '</div>' +
      '</div>' +
      '</section>'
    );
  }

  // ─── Myth or Fact section (Prompt B Feature 2) ────────────────────────────
  var mythFactChoices = {};
  var mythFactRevealed = {};

  function chooseMythFact(index, answer) {
    if (mythFactChoices[index] !== undefined) return;
    mythFactChoices[index] = answer;
    mythFactRevealed[index] = true;
    var section = document.getElementById('ethics-mythfact');
    if (section) {
      section.innerHTML = renderMythFactSection(currentLang());
    }
  }

  function renderMythFactRow(item, index, lang) {
    var correct = item.answer;
    var chosen = mythFactChoices[index] !== undefined;
    var revealed = mythFactRevealed[index];
    var userIsCorrect = chosen && correct === chosen;
    var disabled = chosen ? 'disabled' : '';
    var checkIcon = revealed && correct === 'myth'
      ? ' <svg class="ethics-mf-check" width="12" height="12" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19l27-27-1.42-1.41L9 13.09z"/></svg>'
      : '';
    var factCheckIcon = revealed && correct === 'fact'
      ? ' <svg class="ethics-mf-check" width="12" height="12" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19l27-27-1.42-1.41L9 13.09z"/></svg>'
      : '';
    var resultHtml = revealed
      ? '<p class="ethics-mf-result"><span class="ethics-mf-result-label">' + (correct === 'fact' ? t('ethics.factLabel', 'Fact') : t('ethics.mythLabel', 'Myth')) + '</span> ' + esc(item.explanation) + '</p>'
      : '';
    devCheckRendered(item.statement, 'mythfact statement');
    devCheckRendered(item.explanation, 'mythfact explanation');
    var yourAnswerHtml = chosen ? '<span class="ethics-mf-your-answer">' + t('ethics.yourAnswerLabel', 'Your answer') + ': ' + esc(t(chosen === 'myth' ? 'ethics.mythLabel' : 'ethics.factLabel', chosen === 'myth' ? 'Myth' : 'Fact')) + '</span>' : '';
    var mythBtn = 'ethics-mf-btn ethics-mf-myth' + (chosen && mythFactChoices[index] === 'myth' ? ' ethics-mf-selected' : '') + disabled;
    var factBtn = 'ethics-mf-btn ethics-mf-fact' + (chosen && mythFactChoices[index] === 'fact' ? ' ethics-mf-selected' : '') + disabled;
    if (revealed) {
      if (correct === 'myth') { mythBtn += ' ethics-mf-correct'; } else { factBtn += ' ethics-mf-correct'; }
      if (chosen && mythFactChoices[index] !== correct) {
        if (mythFactChoices[index] === 'myth') { mythBtn += ' ethics-mf-wrong'; } else { factBtn += ' ethics-mf-wrong'; }
      }
    }
    return (
      '<div class="ethics-mf-row' + (revealed ? ' ethics-mf-revealed' : '') + '">' +
      '<p class="ethics-mf-statement"' + (lang === 'hi' ? ' lang="hi"' : '') + '>' + esc(item.statement) + '</p>' +
      '<div class="ethics-mf-buttons">' +
      '<button type="button" class="' + mythBtn + '" data-action="ethics-mf" data-answer="myth">' + esc(t('ethics.mythLabel', 'Myth')) + checkIcon + '</button>' +
      '<button type="button" class="' + factBtn + '" data-action="ethics-mf" data-answer="fact">' + esc(t('ethics.factLabel', 'Fact')) + factCheckIcon + '</button>' +
      '</div>' +
      yourAnswerHtml +
      resultHtml +
      '</div>'
    );
  }

  function renderMythFactSection(lang) {
    var wrapperAttr = lang === 'hi' ? ' lang="hi"' : '';
    var rowsHtml = '';
    var myths = window.ETHICS_MYTH_FACTS || [];
    for (var i = 0; i < myths.length; i++) {
      rowsHtml += renderMythFactRow(myths[i], i, lang);
    }
    return (
      '<section class="ethics-part ethics-mythfact-section" id="ethics-mythfact" aria-labelledby="ethics-mythfact-title"' + wrapperAttr + '>' +
      '<div class="ethics-part-head">' +
      '<span class="ethics-part-label">' + t('ethics.mythFactLabel', 'MYTH OR FACT') + '</span>' +
      '<h2 id="ethics-mythfact-title">' + esc(t('ethics.mythFactTitle', 'Myth or Fact?')) + '</h2>' +
      '<p class="ethics-part-summary">' + esc(t('ethics.mythFactSummary', 'Short statements students often hear. Decide, then see the answer.')) + '</p>' +
      '</div>' +
      '<div class="glass-card ethics-mythfact-panel">' +
      '<div class="ethics-mythfact-content">' +
      rowsHtml +
      '</div>' +
      '</div>' +
      '</section>'
    );
  }

  // ─── Sources section (Prompt B Feature 5) ─────────────────────────────────
  function renderSourcesSection(lang) {
    var wrapperAttr = lang === 'hi' ? ' lang="hi"' : '';
    var itemsHtml = '';
    var sources = window.ETHICS_SOURCES || [];
    for (var i = 0; i < sources.length; i++) {
      var src = sources[i];
      var url = src.url || '';
      var linkHtml;
      try {
        var u = new URL(url);
        var protocol = u.protocol;
        if (protocol === 'http:' || protocol === 'https:') {
          linkHtml = '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" class="ethics-source-link" aria-label="' + esc(src.name + ', ' + t('ethics.linkOpens', 'opens in a new tab')) + '">' + esc(src.name) + ' <svg class="ethics-source-icon" width="12" height="12" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 19H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V19h2V3h-7z"/></svg></a>';
        } else {
          linkHtml = '<span class="ethics-source-name">' + esc(src.name) + '</span> <span class="ethics-source-unavailable">(' + t('ethics.linkUnavailable', 'Link unavailable') + ')</span>';
        }
      } catch (e) {
        linkHtml = '<span class="ethics-source-name">' + esc(src.name) + '</span> <span class="ethics-source-unavailable">(' + t('ethics.linkUnavailable', 'Link unavailable') + ')</span>';
      }
      itemsHtml +=
        '<div class="ethics-source-item">' +
        '<div class="ethics-source-name">' + esc(src.name) + '</div>' +
        '<p class="ethics-source-purpose"' + wrapperAttr + '>' + esc(src.purpose || '') + '</p>' +
        linkHtml +
        '</div>';
    }
    return (
      '<section class="ethics-part ethics-sources-section" id="ethics-sources" aria-labelledby="ethics-sources-title"' + wrapperAttr + '>' +
      '<div class="ethics-part-head">' +
      '<span class="ethics-part-label">' + t('ethics.sourcesLabel', 'SOURCES') + '</span>' +
      '<h2 id="ethics-sources-title">' + esc(t('ethics.sourcesTitle', 'Sources')) + '</h2>' +
      '<p class="ethics-part-summary">' + esc(t('ethics.sourcesSummary', 'Check the official text yourself. Laws and rules can change.')) + '</p>' +
      '</div>' +
      '<div class="glass-card ethics-sources-panel">' +
      '<div class="ethics-sources-content">' +
      itemsHtml +
      '<p class="ethics-sources-last-checked">' + esc(t('ethics.lastChecked', 'Last checked: 19 October 2026')) + '</p>' +
      '<p class="ethics-sources-disclaimer">' + esc(t('ethics.notLegalAdvice', 'This guide is for general awareness and is not legal advice.')) + '</p>' +
      '</div>' +
      '</div>' +
      '</section>'
    );
  }

  // ─── Hero stats (updated with read progress) ──────────────────────────────
  function estimateReadMinutes() {
    var parts = window.ETHICS_CONTENT || [];
    var total = 0;
    var simple = mode === 'simple';
    for (var p = 0; p < parts.length; p++) {
      var part = parts[p];
      total += wordCount(part.partTitle);
      total += wordCount(part.summary);
      if (simple && Array.isArray(part.simple)) {
        for (var s = 0; s < part.simple.length; s++) total += wordCount(part.simple[s]);
      } else {
        if (Array.isArray(part.topics)) {
          for (var ti = 0; ti < part.topics.length; ti++) {
            var topic = part.topics[ti];
            total += wordCount(topic.title);
            if (topic.table) {
              for (var r = 0; r < topic.table.rows.length; r++) {
                for (var c = 0; c < topic.table.rows[r].length; c++) total += wordCount(topic.table.rows[r][c]);
              }
            } else {
              var bullets = topic.bullets || [];
              for (var b = 0; b < bullets.length; b++) {
                var item = bullets[b];
                var txt = typeof item === 'object' ? item.text : item;
                total += wordCount(txt);
              }
            }
          }
        }
      }
    }
    var minutes = total / 200;
    var rounded = Math.round(minutes / 5) * 5;
    return rounded < 5 ? 5 : rounded;
  }

  function buildHeroStats(done, totalParts) {
    var readText = done >= TOTAL_PARTS ? t('ethics.allPartsRead', 'All 9 parts read')
      : t('ethics.partsRead', '{n} of 9 parts read').replace('{n}', String(done));
    var readMinutes = estimateReadMinutes();
    return (
      '<div class="ethics-hero-stats">' +
      '<div class="ethics-stat"><span class="ethics-stat-num">9</span><span class="ethics-stat-label">' + t('ethics.statParts', 'parts') + '</span></div>' +
      '<div class="ethics-stat"><span class="ethics-stat-num">32</span><span class="ethics-stat-label">' + t('ethics.statTopics', 'topics') + '</span></div>' +
      '<div class="ethics-stat"><span class="ethics-stat-num">About ' + String(readMinutes) + ' min</span><span class="ethics-stat-label">' + t('ethics.statRead', 'to read') + '</span></div>' +
      '<div class="ethics-stat ethics-stat-read"><span class="ethics-stat-num" id="ethics-read-count">' + esc(readText) + '</span><span class="ethics-stat-label">' + t('ethics.statReadProgress', 'read') + '</span></div>' +
      '</div>'
    );
  }

  // ─── Simple mode toggle ───────────────────────────────────────────────────
  function buildSimpleToggle() {
    var isSimple = mode === 'simple';
    var fullPressed = !isSimple ? 'true' : 'false';
    var simplePressed = isSimple ? 'true' : 'false';
    return (
      '<div class="ethics-simple-toggle" role="radiogroup" aria-label="' + t('ethics.simpleLabel', 'Simple') + ' / ' + t('ethics.fullLabel', 'Full') + '">' +
      '<button type="button" class="ethics-toggle-btn' + (!isSimple ? ' ethics-toggle-active' : '') + '" data-action="ethics-toggle-mode" data-mode="full" role="radio" aria-pressed="' + fullPressed + '">' + esc(t('ethics.fullLabel', 'Full')) + '</button>' +
      '<button type="button" class="ethics-toggle-btn' + (isSimple ? ' ethics-toggle-active' : '') + '" data-action="ethics-toggle-mode" data-mode="simple" role="radio" aria-pressed="' + simplePressed + '">' + esc(t('ethics.simpleLabel', 'Simple')) + '</button>' +
      '</div>'
    );
  }

  // ─── Build the full page HTML ─────────────────────────────────────────────
  function buildHtml() {
    var parts = window.ETHICS_CONTENT || [];
    var selfCheck = window.ETHICS_SELF_CHECK || [];
    var lang = currentLang();
    var done = readCount();
    var readText = done >= TOTAL_PARTS ? t('ethics.allPartsRead', 'All 9 parts read')
      : t('ethics.partsRead', '{n} of 9 parts read').replace('{n}', String(done));
    var simple = mode === 'simple';
    var readMinutes = estimateReadMinutes();

    var partSections = [];
    var partChips = [];
    parts.forEach(function (part) {
      var sectionHtml = buildPartSection(part, lang, readParts);
      partSections.push(sectionHtml);

      var chipLabel = part.shortName ? String(part.part) + ' ' + esc(part.shortName) : String(part.part);
      var chipAria = t('ethics.part', 'Part {n}').replace('{n}', String(part.part)) + (part.shortName ? ' ' + esc(part.shortName) : '');
      var isRead = readParts.indexOf(part.part) >= 0;
      if (isRead) chipAria += ', ' + t('ethics.read', 'Read');
      partChips.push(
        '<button type="button" class="ethics-chip' + (isRead ? ' ethics-chip-read' : '') + '" data-action="ethics-chip" data-target="ethics-part-' + part.part + '" aria-label="' + esc(chipAria) + '">' +
        '<span class="ethics-chip-num">' + String(part.part) + '</span>' +
        '<span class="ethics-chip-name">' + esc(part.shortName || '') + '</span>' +
        (isRead ? '<span class="ethics-chip-read-dot" aria-hidden="true"></span>' : '') +
        '</button>'
      );
    });

    partChips.push(
      '<button type="button" class="ethics-chip" data-action="ethics-chip" data-target="ethics-scenarios" aria-label="' + esc(t('ethics.scenariosLabel', 'Scenarios')) + '">' +
      '<span class="ethics-chip-name">' + esc(t('ethics.scenariosLabel', 'Scenarios')) + '</span>' +
      '</button>'
    );

    partChips.push(
      '<button type="button" class="ethics-chip" data-action="ethics-chip" data-target="ethics-mythfact" aria-label="' + esc(t('ethics.mythFactLabel', 'MYTH OR FACT')) + '">' +
      '<span class="ethics-chip-name">' + esc(t('ethics.mythFactLabel', 'MYTH OR FACT')) + '</span>' +
      '</button>'
    );

    var selfCheckLabel = t('ethics.chipSelfCheck', 'Self-Check');
    partChips.push(
      '<button type="button" class="ethics-chip" data-action="ethics-chip" data-target="ethics-selfcheck" aria-label="' + esc(selfCheckLabel) + '">' +
      '<span class="ethics-chip-name">' + esc(selfCheckLabel) + '</span>' +
      '</button>'
    );

    partChips.push(
      '<button type="button" class="ethics-chip" data-action="ethics-chip" data-target="ethics-sources" aria-label="' + esc(t('ethics.sourcesLabel', 'SOURCES')) + '">' +
      '<span class="ethics-chip-name">' + esc(t('ethics.sourcesLabel', 'SOURCES')) + '</span>' +
      '</button>'
    );

    var scenariosSection = renderScenariosSection(lang);
    var mythFactSection = renderMythFactSection(lang);
    var sourcesSection = renderSourcesSection(lang);

    var checkItems = [];
    selfCheck.forEach(function (item, i) {
      checkItems.push(
        '<li class="ethics-checklist-item" role="checkbox" aria-checked="false" tabindex="0">' +
        '<input type="checkbox" class="ethics-check" id="ethics-check-' + i + '" />' +
        '<label for="ethics-check-' + i + '">' + esc(item) + '</label>' +
        '</li>'
      );
    });

    var creditsTitle = t('ethics.credits', 'Credits and Technical Support');
    var helplineTitle = t('ethics.helpline', 'Student Helpline');

    var helplineItems = '';
    helplineItems +=
      '<div class="ethics-help-item">' +
      buildHelpTelRow('ethics.childHelpline', 'ethics.helpSheetChildWhen') +
      '</div>';
    helplineItems +=
      '<div class="ethics-help-item">' +
      buildHelpTelRow('ethics.emergency', 'ethics.emergencyWhen') +
      '</div>';
    helplineItems += '<p class="ethics-sub ethics-other-title">' + esc(t('ethics.otherPlaces', 'Other places to seek help')) + '</p>';
    var HELPLINE_LINKS = [
      { nameKey: 'placeNcpcr', url: 'https://ncpcr.gov.in' },
      { nameKey: 'placeCyber', url: 'https://cybercrime.gov.in' },
      { nameKey: 'placeEducation', url: 'https://education.gov.in' }
    ];
    HELPLINE_LINKS.forEach(function (link) {
      helplineItems +=
        '<div class="ethics-help-item">' +
        '<a href="' + esc(link.url) + '" target="_blank" rel="noopener noreferrer" class="ethics-link">' +
        esc(t(link.nameKey, link.nameKey)) + '</a>' +
        '<span class="ethics-purpose">' + esc(t(link.nameKey + 'Purpose', '')) + '</span>' +
        '</div>';
    });
    helplineItems +=
      '<div class="ethics-help-item">' +
      '<span class="ethics-help-name">' + esc(t('ethics.placeState', 'State Commission for Protection of Child Rights')) + '</span>' +
      '<span class="ethics-purpose">' + esc(t('ethics.placeStateNote', 'Check your state\'s official website')) + '</span>' +
      '</div>';
    helplineItems +=
      '<div class="ethics-help-item">' +
      '<span class="ethics-help-name">' + esc(t('ethics.placePolice', 'Police or Special Juvenile Police Unit')) + '</span>' +
      '<span class="ethics-purpose">' + esc(t('ethics.placePoliceNote', 'For offences and serious safety concerns')) + '</span>' +
      '</div>';
    helplineItems +=
      '<div class="ethics-help-item">' +
      '<span class="ethics-help-name">' + esc(t('ethics.placeCwc', 'Child Welfare Committee')) + '</span>' +
      '<span class="ethics-purpose">' + esc(t('ethics.placeCwcNote', 'For children needing care and protection under law')) + '</span>' +
      '</div>';

    var adultLine = t('ethics.adultLine', "If the person causing harm is a teacher, principal, or family member, talk to an independent trusted adult or contact an authority directly.");

    return (
      '<div class="ethics-page" id="' + ROOT_ID + '"' + (lang === 'hi' ? ' lang="hi"' : '') + '>' +
      '<div class="ethics-wrap">' +
      '<header class="ethics-hero">' +
      '<div class="ethics-hero-inner">' +
      '<p class="ethics-hero-kicker">' + esc(t('ethics.kicker', 'STUDENT AWARENESS GUIDE')) + '</p>' +
      '<h1 class="ethics-hero-title">' + esc(t('ethics.title', 'Ethics')) + '</h1>' +
      '<p class="ethics-hero-sub">' + esc(t('ethics.subtitle', 'Etiquette, civic sense, rights, safety, and everyday responsibility for every student.')) + '</p>' +
      buildHeroStats(done, TOTAL_PARTS) +
      buildSimpleToggle() +
      '<div class="ethics-hero-actions">' +
      '<button type="button" class="ethics-btn ethics-btn-primary" data-action="ethics-scroll" data-target="ethics-part-1">' + esc(t('ethics.btnStart', 'Start reading')) + '</button>' +
      '<button type="button" class="ethics-btn ethics-btn-text" data-action="ethics-scroll" data-target="ethics-selfcheck">' + esc(t('ethics.btnSelfCheck', 'Jump to Self-Check')) + '</button>' +
      '</div>' +
      '</div>' +
      '</header>' +
      '<nav class="ethics-chip-row" role="navigation" aria-label="Ethics parts">' +
      partChips.join('') +
      '<div class="ethics-progress-fill" aria-hidden="true"></div>' +
      '</nav>' +
      '<main class="ethics-guide">' +
      '<div id="ethics-parts-container">' +
      partSections.join('') +
      '</div>' +
      scenariosSection +
      mythFactSection +
      '<section class="ethics-part ethics-selfcheck-section" id="ethics-selfcheck" aria-labelledby="ethics-selfcheck-title">' +
      '<div class="ethics-part-head">' +
      '<span class="ethics-part-label">' + t('ethics.selfCheckLabel', 'SELF-CHECK') + '</span>' +
      '<h2 id="ethics-selfcheck-title">' + esc(t('ethics.selfCheck', 'Daily Student Self-Check')) + '</h2>' +
      '</div>' +
      '<div class="glass-card ethics-selfcheck-panel">' +
      '<div class="ethics-selfcheck-head">' +
      '<div class="ethics-selfcheck-info">' +
      '<h2>' + esc(t('ethics.selfCheck', 'Daily Student Self-Check')) + '</h2>' +
      '<p class="ethics-counter" id="ethics-counter">' + t('ethics.zero', '0 of 10') + '</p>' +
      '</div>' +
      '<div class="ethics-progress-track-wrap">' +
      '<div class="ethics-progress-track" aria-hidden="true"><div class="ethics-progress-fill" id="ethics-selfcheck-track-fill"></div></div>' +
      '</div>' +
      '</div>' +
      '<ol class="ethics-checklist">' + checkItems.join('') + '</ol>' +
      '<button type="button" class="ethics-btn ethics-btn-text ethics-btn-reset" data-action="ethics-reset-checklist">' + esc(t('ethics.reset', 'Reset checklist')) + '</button>' +
      '</div>' +
      '</section>' +
      sourcesSection +
      '</main>' +
      '<footer class="ethics-footer" role="contentinfo">' +
      '<div class="ethics-footer-inner">' +
      '<div class="ethics-footer-row">' +
      '<div class="glass-card ethics-panel">' +
      '<h3 class="ethics-panel-title">' + esc(creditsTitle) + '</h3>' +
      '<p class="ethics-panel-line">' + esc(t('ethics.creditLine1', 'Created by Innosphere and team')) + '</p>' +
      '<p class="ethics-panel-line"><span>' + esc(t('ethics.creditLine2Label', 'Technical support: Innosphere')) + '</span> ' +
      '<a href="mailto:stuvoinnosphere@gmail.com" class="ethics-link">' + esc(t('ethics.creditEmail', 'stuvoinnosphere@gmail.com')) + '</a></p>' +
      '</div>' +
      '<div class="glass-card ethics-panel" id="ethics-footer-row">' +
      '<h3 class="ethics-panel-title">' + esc(helplineTitle) + '</h3>' +
      helplineItems +
      '<p class="ethics-purpose ethics-adult-line">' + esc(adultLine) + '</p>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</footer>' +
      '</div>' +
      '<button type="button" class="ethics-help-button" id="ethics-help-button" data-action="ethics-help" aria-label="' + esc(t('ethics.needHelpNow', 'Need help now')) + '">' +
      '<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.62 10.79c1.44-2.83 3.76-5.17 6.59-6.59L22.9 8.82c-.6 3.45-4.23 6.24-8.39 7.05V20c0 .55-.45 1-1 1H3c-.55 0-1-.45-1-1v-8c0-.55.45-1 1-1h2.19c.79.95 1.68 2.2 2.43 3.79M4.62 6.19l1.42-1.42c1.88-1.88 4.74-2.93 7.75-2.93s5.87 1.05 7.75 2.93l1.42 1.42c-1.48 2.36-4.31 3.85-7.5 3.85s-6.02-1.49-7.5-3.85zM12 4.5c-4.2 0-7.5 3.3-7.5 7.5s3.3 7.5 7.5 7.5 7.5-3.3 7.5-7.5z"/></svg>' +
      esc(t('ethics.needHelpNow', 'Need help now')) +
      '</button>' +
      '</div>'
    );
  }

  // ─── Dev check: fail loud if any rendered string is a placeholder (FX5) ───
  function devCheckRendered(value, what) {
    var s = String(value == null ? '' : value);
    if (s === 'undefined' || s === 'null' || s === 'NaN') {
      console.error('[ethics] placeholder rendered for ' + what + ': "' + s + '"');
    }
  }

  // ─── Split a combined "Name 112" helpline string into label + number (FX6) ───
  function splitTelLabelNumber(text) {
    var s = String(text == null ? '' : text).replace(/\s+$/, '');
    var m = s.match(/^(.*?)\s*(\d[\d\s]*)\s*$/);
    if (m) {
      return { label: m[1].replace(/\s+$/, ''), number: m[2].replace(/\s+/g, '') };
    }
    return { label: '', number: s };
  }

  // ─── Shared helpline row component used by footer and help sheet (FX6) ───
  function buildHelpTelRow(numberKey, whenKey) {
    var lang = currentLang();
    var split = splitTelLabelNumber(t(numberKey, ''));
    var desc = t(whenKey, '');
    var digits = split.number.replace(/\D/g, '');
    var telHref = digits ? 'tel:' + digits : '';
    var labelHtml = split.label ? '<span class="ethics-help-tel-label">' + esc(split.label) + '</span>' : '';
    var numberHtml = split.number ? '<span class="ethics-help-tel-number">' + esc(split.number) + '</span>' : '';
    var descHtml = desc ? '<span class="ethics-help-tel-desc">' + esc(desc) + '</span>' : '';
    devCheckRendered(split.label, 'helpline label ' + numberKey);
    devCheckRendered(split.number, 'helpline number ' + numberKey);
    devCheckRendered(desc, 'helpline description ' + whenKey);
    return (
      '<a href="' + esc(telHref) + '" class="ethics-help-tel" aria-label="' + esc(split.label + ' ' + split.number + '. ' + desc) + '">' +
      labelHtml + numberHtml + descHtml +
      '</a>'
    );
  }

  // ─── Help sheet (portal, body level) ──────────────────────────────────────
  var helpOverlay = null;
  var helpSheetEl = null;
  var helpOpen = false;
  var helpReturnFocus = null;
  var helpScrollRAF = null;

  function buildHelpSheetHtml(lang) {
    var wrapper = lang === 'hi' ? ' lang="hi"' : '';
    return (
      '<div class="ethics-help-sheet-header">' +
      '<h2 id="ethics-help-sheet-title" class="ethics-help-sheet-title">' + esc(t('ethics.helpSheetTitle', 'If you need help right now')) + '</h2>' +
      '<button type="button" class="ethics-help-sheet-close" data-action="ethics-help-close">' + esc(t('ethics.helpSheetClose', 'Close')) + '</button>' +
      '</div>' +
      '<div class="ethics-help-sheet-body">' +
      '<div class="ethics-help-tel-row">' + buildHelpTelRow('ethics.helpSheetEmergency', 'ethics.helpSheetEmergencyWhen') + '</div>' +
      '<div class="ethics-help-tel-row">' + buildHelpTelRow('ethics.helpSheetChild', 'ethics.helpSheetChildWhen') + '</div>' +
      '<div class="ethics-help-say-block">' +
      '<h3 class="ethics-help-say-title">' + esc(t('ethics.helpSheetSayTitle', 'When you call, you can say')) + '</h3>' +
      '<ul class="ethics-help-say-list">' +
      '<li>' + esc(t('ethics.helpSheetSay1', 'My name (you can start with just your first name)')) + '</li>' +
      '<li>' + esc(t('ethics.helpSheetSay2', 'Where I am')) + '</li>' +
      '<li>' + esc(t('ethics.helpSheetSay3', 'What is happening')) + '</li>' +
      '<li>' + esc(t('ethics.helpSheetSay4', 'Whether I am safe right now')) + '</li>' +
      '</ul>' +
      '</div>' +
      '<div class="ethics-help-notdanger-block">' +
      '<h3 class="ethics-help-notdanger-title">' + esc(t('ethics.helpSheetNotDangerTitle', 'If you are not in danger right now')) + '</h3>' +
      '<ul class="ethics-help-notdanger-list">' +
      '<li>' + esc(t('ethics.helpSheetNotDanger1', 'Tell a trusted adult: a parent, a teacher you trust, or a school counsellor.')) + '</li>' +
      '<li>' + esc(t('ethics.helpSheetNotDanger2', 'If the person hurting you is a teacher, principal, or family member, tell a different trusted adult or call 1098.')) + '</li>' +
      '</ul>' +
      '</div>' +
      '</div>'
    );
  }

  function trapFocus(el, e) {
    var focusables = el.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    var list = Array.prototype.slice.call(focusables);
    var current = list.indexOf(document.activeElement);
    var next = e.shiftKey ? current - 1 : current + 1;
    if (next >= list.length) next = 0;
    if (next < 0) next = list.length - 1;
    list[next].focus();
  }

  function onHelpSheetKeydown(e) {
    if (!helpSheetEl || !helpOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeHelpSheet(); return; }
    if (e.key === 'Tab') { e.preventDefault(); trapFocus(helpSheetEl, e); }
  }

  function openHelpSheet() {
    if (helpOpen) return;
    helpReturnFocus = document.activeElement;
    if (!helpOverlay) {
      helpOverlay = document.createElement('div');
      helpOverlay.className = 'ethics-help-overlay';
      helpOverlay.setAttribute('aria-hidden', 'true');
      helpSheetEl = document.createElement('div');
      helpSheetEl.className = 'ethics-help-sheet';
      helpSheetEl.setAttribute('role', 'dialog');
      helpSheetEl.setAttribute('aria-modal', 'true');
      helpSheetEl.setAttribute('aria-labelledby', 'ethics-help-sheet-title');
      helpOverlay.appendChild(helpSheetEl);
      helpSheetEl.addEventListener('keydown', onHelpSheetKeydown);
      helpOverlay.addEventListener('click', function (e) {
        if (e.target === helpOverlay) closeHelpSheet();
      });
    }
    helpSheetEl.innerHTML = buildHelpSheetHtml(currentLang());
    document.body.appendChild(helpOverlay);
    void helpOverlay.offsetWidth;
    helpOverlay.classList.add('is-open');
    helpOverlay.setAttribute('aria-hidden', 'false');
    helpOpen = true;
    document.body.style.overflow = 'hidden';
    var title = helpSheetEl.querySelector('#ethics-help-sheet-title');
    if (title) title.focus();
  }

  function closeHelpSheet() {
    if (!helpOpen) return;
    helpOpen = false;
    helpOverlay.classList.remove('is-open');
    helpOverlay.setAttribute('aria-hidden', 'true');
    var done = function () {
      if (helpOverlay && helpOverlay.parentNode) helpOverlay.parentNode.removeChild(helpOverlay);
      document.body.style.overflow = '';
      if (helpReturnFocus) { try { helpReturnFocus.focus(); } catch (e) {}; helpReturnFocus = null; }
    };
    var timer = setTimeout(done, 250);
    helpOverlay.addEventListener('transitionend', function onEnd(ev) {
      if (ev.target === helpOverlay) {
        clearTimeout(timer);
        done();
      }
    }, { once: true });
  }

  // ─── Scroll / progress (rAF-throttled, passive) ───────────────────────────
  function onScroll() {
    if (helpScrollRAF) return;
    helpScrollRAF = requestAnimationFrame(function () {
      helpScrollRAF = null;
      try {
        var docEl = document.documentElement;
        var max = Math.max(0, docEl.scrollHeight - docEl.clientHeight);
        var cur = docEl.scrollTop || window.pageYOffset || 0;
        var p = max > 0 ? Math.min(1, cur / max) : 0;
        docEl.style.setProperty('--ethics-progress', String(p));
      } catch (e) {}
    });
  }

  // ─── Measure header height for sticky chip row ────────────────────────────
  function measureHeader() {
    try {
      var header = document.getElementById('topbar') || document.querySelector('.topbar') || document.getElementById('mobile-top-header');
      var stickyTop = 0;
      var chipH = 0;
      var chipRow = document.querySelector('.ethics-chip-row');
      if (chipRow) { chipH = chipRow.offsetHeight; }
      if (header) {
        var pos = getComputedStyle(header).position;
        if (pos === 'fixed' || pos === 'sticky') {
          var rect = header.getBoundingClientRect();
          stickyTop = Math.max(0, rect.bottom);
        } else {
          stickyTop = 0;
        }
      }
      var docEl = document.documentElement;
      if (docEl.style && typeof docEl.style.setProperty === 'function') {
        docEl.style.setProperty('--ethics-sticky-top', stickyTop + 'px');
        docEl.style.setProperty('--ethics-chip-h', chipH + 'px');
      }
    } catch (e) {
      var docEl = document.documentElement;
      if (docEl.style && typeof docEl.style.setProperty === 'function') {
        docEl.style.setProperty('--ethics-sticky-top', '0px');
        docEl.style.setProperty('--ethics-chip-h', '3.25em');
      }
    }
  }

  // ─── Footer-hide observer (helpline panel) ────────────────────────────────
  function bindFooterObserver() {
    try {
      if (window._ethicsFooterObserver) { window._ethicsFooterObserver.disconnect(); }
      var footer = document.getElementById('ethics-footer-row') || document.querySelector('.ethics-footer-row');
      var btn = document.getElementById('ethics-help-button');
      if (!footer || !btn) return;
      window._ethicsFooterObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            btn.classList.add('ethics-help-button-hidden');
          } else {
            btn.classList.remove('ethics-help-button-hidden');
          }
        });
      }, { root: null, rootMargin: '0px' });
      window._ethicsFooterObserver.observe(footer);
    } catch (e) {}
  }

  // ─── Delegated event handlers ─────────────────────────────────────────────
  window._ethicsClickHandler = function (e) {
    var btn = e.target.closest('[data-action="ethics-reset-checklist"]');
    if (btn) {
      e.preventDefault();
      resetChecklist();
      return;
    }
    var clearProgressBtn = e.target.closest('[data-action="ethics-clear-progress"]');
    if (clearProgressBtn) {
      e.preventDefault();
      var now = Date.now();
      var pending = clearProgressBtn.dataset.ethicsClearPending === '1';
      var last = Number(clearProgressBtn.dataset.ethicsClearTime || 0);
      if (pending && (now - last) < 4000) {
        readParts = [];
        readPartsDirty = true;
        saveReadState();
        updateReadProgressUI();
        updateReadChipDots();
        var parts = window.ETHICS_CONTENT || [];
        var container = document.getElementById('ethics-parts-container');
        if (container) {
          container.innerHTML = '';
          for (var p = 0; p < parts.length; p++) {
            container.innerHTML += buildPartSection(parts[p], currentLang(), readParts);
          }
          setupPartObserver();
          updateReadChipDots();
        }
        clearProgressBtn.dataset.ethicsClearPending = '0';
        clearProgressBtn.textContent = esc(t('ethics.clearProgress', 'Clear progress'));
        return;
      }
      clearProgressBtn.dataset.ethicsClearPending = '1';
      clearProgressBtn.dataset.ethicsClearTime = String(now);
      clearProgressBtn.textContent = esc(t('ethics.clearProgressConfirm', 'Tap again to clear'));
      return;
    }
    var tryAgain = e.target.closest('[data-action="ethics-reset-scenarios"]');
    if (tryAgain) {
      e.preventDefault();
      resetScenarioState();
      window.location.hash = '#/ethics';
      return;
    }
    var scrollBtn = e.target.closest('[data-action="ethics-scroll"]');
    if (scrollBtn) {
      e.preventDefault();
      var target = scrollBtn.getAttribute('data-target');
      if (target) {
        var el = document.getElementById(target);
        if (el) el.scrollIntoView({ block: 'start' });
      }
      return;
    }
    var chip = e.target.closest('[data-action="ethics-chip"]');
    if (chip) {
      e.preventDefault();
      var target = chip.getAttribute('data-target');
      if (target) {
        var el = document.getElementById(target);
        if (el) el.scrollIntoView({ block: 'start' });
      }
      return;
    }
    var helpBtn = e.target.closest('[data-action="ethics-help"]');
    if (helpBtn) {
      e.preventDefault();
      openHelpSheet();
      return;
    }
    var closeBtn = e.target.closest('[data-action="ethics-help-close"]');
    if (closeBtn) {
      e.preventDefault();
      closeHelpSheet();
      return;
    }
    var skipBtn = e.target.closest('[data-action="ethics-skip"]');
    if (skipBtn) {
      e.preventDefault();
      advanceScenario();
      return;
    }
    var nextBtn = e.target.closest('[data-action="ethics-next"]');
    if (nextBtn) {
      e.preventDefault();
      advanceScenario();
      return;
    }
    var optionBtn = e.target.closest('[data-action="ethics-option"]');
    if (optionBtn && !optionBtn.disabled) {
      e.preventDefault();
      var index = Number(optionBtn.getAttribute('data-option'));
      chooseOption(index);
      return;
    }
    var mfBtn = e.target.closest('[data-action="ethics-mf"]');
    if (mfBtn && !mfBtn.disabled) {
      e.preventDefault();
      var row = mfBtn.closest('.ethics-mf-row');
      var rows = row.parentNode.querySelectorAll('.ethics-mf-row');
      var index = Array.prototype.indexOf.call(rows, row);
      var answer = mfBtn.getAttribute('data-answer');
      chooseMythFact(index, answer);
      return;
    }
    var readBtn = e.target.closest('[data-action="ethics-read"]');
    if (readBtn) {
      e.preventDefault();
      var partNum = Number(readBtn.getAttribute('data-part'));
      toggleReadPart(partNum);
      var parts = window.ETHICS_CONTENT || [];
      var partData = null;
      for (var p = 0; p < parts.length; p++) {
        if (parts[p].part === partNum) { partData = parts[p]; break; }
      }
      if (partData) {
        var section = document.getElementById('ethics-part-' + partNum);
        if (section) {
          section.innerHTML = buildPartSection(partData, currentLang(), readParts);
        }
      }
      return;
    }
    var listenBtn = e.target.closest('[data-action="ethics-listen"]');
    if (listenBtn) {
      e.preventDefault();
      var partNum = Number(listenBtn.getAttribute('data-part'));
      if (isSpeakingPart(partNum)) {
        cancelSpeech();
        var section = document.getElementById('ethics-part-' + partNum);
        if (section) {
          var parts = window.ETHICS_CONTENT || [];
          var partData = null;
          for (var p = 0; p < parts.length; p++) {
            if (parts[p].part === partNum) { partData = parts[p]; break; }
          }
          if (partData) {
            section.innerHTML = buildPartSection(partData, currentLang(), readParts);
          }
        }
      } else {
        speakPart(partNum, currentLang());
        var section = document.getElementById('ethics-part-' + partNum);
        if (section) {
          var parts = window.ETHICS_CONTENT || [];
          var partData = null;
          for (var p = 0; p < parts.length; p++) {
            if (parts[p].part === partNum) { partData = parts[p]; break; }
          }
          if (partData) {
            section.innerHTML = buildPartSection(partData, currentLang(), readParts);
          }
        }
      }
      return;
    }
    var toggleBtn = e.target.closest('[data-action="ethics-toggle-mode"]');
    if (toggleBtn) {
      e.preventDefault();
      var m = toggleBtn.getAttribute('data-mode');
      if (m === 'simple' && mode !== 'simple') toggleMode();
      else if (m === 'full' && mode !== 'full') toggleMode();
      return;
    }
    var showFullBtn = e.target.closest('[data-action="ethics-show-full"]');
    if (showFullBtn) {
      e.preventDefault();
      var partNum = Number(showFullBtn.getAttribute('data-part'));
      expandPart(partNum);
      return;
    }
    var showSimpleBtn = e.target.closest('[data-action="ethics-show-simple"]');
    if (showSimpleBtn) {
      e.preventDefault();
      var partNum = Number(showSimpleBtn.getAttribute('data-part'));
      collapsePart(partNum);
      return;
    }
    var row = e.target.closest('.ethics-checklist-item');
    if (row && !e.target.closest('a')) {
      var cb = row.querySelector('.ethics-check');
      if (cb) {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
  };

  window._ethicsKeydownHandler = function (e) {
    if (e.key === 'Escape') {
      if (helpOpen) { e.preventDefault(); closeHelpSheet(); }
    }
  };

  // ─── Mount / unmount ──────────────────────────────────────────────────────
  function mountHelpButton() {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;
    measureHeader();
    root.addEventListener('click', window._ethicsClickHandler);
    root.addEventListener('keydown', window._ethicsKeydownHandler);
    root.addEventListener('change', window._ethicsChangeHandler);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measureHeader);
    window.addEventListener('orientationchange', measureHeader);
    setupPartObserver();
    bindFooterObserver();
    updateReadProgressUI();
    updateReadChipDots();
  }

  window._ethicsChangeHandler = function (e) {
    var cb = e.target.closest('.ethics-check');
    if (!cb) return;
    var index = Number(cb.id.replace('ethics-check-', ''));
    setCheck(index, cb.checked);
  };

  function unmountEthics() {
    var root = document.getElementById(ROOT_ID);
    if (root) {
      root.removeEventListener('click', window._ethicsClickHandler);
      root.removeEventListener('keydown', window._ethicsKeydownHandler);
      root.removeEventListener('change', window._ethicsChangeHandler);
    }
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', measureHeader);
    window.removeEventListener('orientationchange', measureHeader);
    if (helpScrollRAF) { cancelAnimationFrame(helpScrollRAF); helpScrollRAF = null; }
    try {
      if (window._ethicsPartObserver) {
        window._ethicsPartObserver.disconnect();
        window._ethicsPartObserver = null;
      }
    } catch (e) {}
    try {
      if (window._ethicsFooterObserver) {
        window._ethicsFooterObserver.disconnect();
        window._ethicsFooterObserver = null;
      }
    } catch (e) {}
    cancelSpeech();
    closeHelpSheet();
    document.body.style.overflow = '';
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  function renderEthics(outlet, params) {
    unmountEthics();
    outlet.innerHTML = buildHtml();
    var root = document.getElementById(ROOT_ID);
    if (!root) return;

    try {
      var appFooter = document.getElementById('app-footer');
      if (appFooter) appFooter.style.display = 'none';
    } catch (e) {}

    loadChecklist();
    loadReadState();
    loadModeState();

    root.querySelectorAll('.ethics-check').forEach(function (cb, i) {
      cb.checked = checklist[i];
    });
    updateCounter();
    updateSelfCheckTrack();

    measureHeader();
    updateReadChipDots();

    mountHelpButton();
  }

  window.renderEthics = renderEthics;
  window.closeHelpSheet = closeHelpSheet;
})();
