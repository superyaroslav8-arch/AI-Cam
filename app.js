/**
 * Ai Cam (Cam) v2 — живой оператор: голос, зрение, команды, лицо
 */
(() => {
  'use strict';

  const state = {
    emotion: 'neutral',
    isListening: false,
    isMuted: false,
    idle: true,
    timerSec: 3,
    manual: false,
    captureMode: 'photo',
    facing: 'user',
    stream: null,
    mediaRecorder: null,
    chunks: [],
    recording: false,
    dirMode: null,
    tipIndex: 0,
    synth: window.speechSynthesis || null,
    recognition: null,
    spokenOnce: false,
    voicesReady: false,
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const leftPupil = $('#leftPupil');
  const rightPupil = $('#rightPupil');
  const statusEl = $('#robotStatus');
  const toastEl = $('#toast');
  const face = $('#looiFace');
  const ring = $('#listeningRing');
  const micBtn = $('#micFab');

  function look(x, y) {
    const max = 14;
    const t = `translate(${x * max}px, ${y * max}px)`;
    if (leftPupil) leftPupil.style.transform = t;
    if (rightPupil) rightPupil.style.transform = t;
  }

  function blink() {
    if (!face) return;
    face.classList.add('blink');
    setTimeout(() => face.classList.remove('blink'), 150);
  }

  function setStatus(text, hi = true) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.remove('fade');
    statusEl.classList.toggle('hi', hi);
    clearTimeout(statusEl._fadeT);
    statusEl._fadeT = setTimeout(() => {
      if (!state.isListening) statusEl.classList.add('fade');
    }, 4500);
  }

  function toast(msg, ms = 2500) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  function unlockAudio() {
    if (!state.synth) return;
    try {
      state.synth.cancel();
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      state.synth.speak(u);
      state.spokenOnce = true;
    } catch (_) {}
  }

  function speak(text) {
    if (state.isMuted || !state.synth || !text) return;
    try {
      state.synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU';
      u.rate = 1.02;
      u.pitch = 1.12;
      u.volume = 1;
      const voices = state.synth.getVoices();
      const ru = voices.find((v) => /ru/i.test(v.lang));
      if (ru) u.voice = ru;
      state.synth.speak(u);
      state.spokenOnce = true;
    } catch (e) {
      toast('Голос: ' + (e.message || 'ошибка'));
    }
  }

  if (state.synth) {
    state.synth.onvoiceschanged = () => { state.voicesReady = true; };
    state.voicesReady = state.synth.getVoices().length > 0;
  }

  const idleActs = [
    { text: 'Я здесь. Удерживай глаза — скажи команду', say: null },
    { text: 'Скажи: фото, камера, влево, портрет…', say: null },
    { text: 'Думаю о кадре…', say: 'Хм' },
    { text: 'Готов снимать', say: 'Готов' },
    { text: 'Микрофон внизу справа', say: null },
  ];

  function doIdle() {
    if (!state.idle || state.isListening) return;
    const cam = $('#camLayer');
    if (cam && !cam.classList.contains('hidden')) return;
    const a = idleActs[Math.floor(Math.random() * idleActs.length)];
    setStatus(a.text, false);
    look((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.0);
    if (a.say) speak(a.say);
  }

  setInterval(blink, 2600 + Math.random() * 2000);
  setInterval(() => {
    if (state.idle && !state.isListening) look((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.1);
  }, 2200);
  setInterval(doIdle, 9000);

  /* —— Speech recognition —— */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function setListening(on) {
    state.isListening = on;
    if (ring) ring.classList.toggle('active', on);
    if (micBtn) micBtn.classList.toggle('live', on);
    if (on) {
      setStatus('Слушаю… говори', true);
      look(0, 0);
    }
  }

  function handleCommand(raw) {
    const t = (raw || '').toLowerCase().trim();
    if (!t) {
      setStatus('Не расслышал. Ещё раз');
      speak('Повтори');
      return;
    }
    setStatus('Услышал: ' + raw, true);
    toast(raw);

    if (/привет|здравств|эй кэм|эй cam|hello/.test(t)) {
      speak('Привет! Я Cam. Скажи фото, камера или режим портрет');
      setStatus('Привет! Чем помочь?', true);
      return;
    }
    if (/как дела|ты тут|ты здесь/.test(t)) {
      speak('На связи. Готов снимать');
      return;
    }
    if (/фото|снимок|кадр|фотку/.test(t)) {
      speak('Открываю камеру');
      startCam().then(() => {
        state.captureMode = 'photo';
        toast('Скажи «снимай» или жми затвор');
      });
      return;
    }
    if (/видео|запись/.test(t)) {
      state.captureMode = 'video';
      speak('Режим видео');
      startCam();
      return;
    }
    if (/камера|открой камеру|включи камеру/.test(t)) {
      speak('Камера');
      startCam();
      return;
    }
    if (/закрой|стоп камер/.test(t)) {
      stopCam(true);
      speak('Закрыл');
      return;
    }
    if (/снимай|щёлк|сфот|затвор/.test(t)) {
      if ($('#camLayer') && !$('#camLayer').classList.contains('hidden')) {
        speak('Три');
        onShutter();
      } else {
        speak('Сначала камера');
        startCam();
      }
      return;
    }
    if (/влево|налево/.test(t)) {
      look(-1, 0);
      speak('Влево');
      setStatus('Влево → тело палки');
      $$('.chip.cmd[data-cmd="left"]').forEach((b) => b.click());
      return;
    }
    if (/вправо|направо/.test(t)) {
      look(1, 0);
      speak('Вправо');
      $$('.chip.cmd[data-cmd="right"]').forEach((b) => b.click());
      return;
    }
    if (/вверх/.test(t)) {
      look(0, -1);
      speak('Вверх');
      $$('.chip.cmd[data-cmd="up"]').forEach((b) => b.click());
      return;
    }
    if (/вниз/.test(t)) {
      look(0, 1);
      speak('Вниз');
      $$('.chip.cmd[data-cmd="down"]').forEach((b) => b.click());
      return;
    }
    if (/стоп|стой|хватит/.test(t)) {
      speak('Стоп');
      $$('.chip.cmd[data-cmd="stop"]').forEach((b) => b.click());
      return;
    }
    if (/орбит/.test(t)) {
      speak('Орбита');
      $$('.chip.cmd[data-cmd="orbit"]').forEach((b) => b.click());
      return;
    }
    if (/портрет/.test(t)) {
      activateDir('portrait');
      return;
    }
    if (/кино|кинематограф/.test(t)) {
      activateDir('cinematic');
      return;
    }
    if (/блог/.test(t)) {
      activateDir('blog');
      return;
    }
    if (/предмет|товар/.test(t)) {
      activateDir('product');
      return;
    }
    if (/пейзаж/.test(t)) {
      activateDir('landscape');
      return;
    }
    if (/спорт/.test(t)) {
      activateDir('sport');
      return;
    }
    if (/что видишь|посмотри|опиши|зрение|видишь/.test(t)) {
      analyzeScene();
      return;
    }
    if (/mimo|мимо|палка|джиай|dji/.test(t)) {
      speak('Открываю Mimo');
      window.location.href = 'djimimo://';
      return;
    }
    if (/меню|открой меню/.test(t)) {
      if (window.CamUI) window.CamUI.openPanel();
      speak('Меню');
      return;
    }
    if (/позвони|звонок/.test(t)) {
      speak('Алло! Это Cam');
      setStatus('Cam звонит…');
      return;
    }
    if (/помоги|что умеешь|команды/.test(t)) {
      speak('Скажи: фото, камера, влево, вправо, портрет, что видишь, меню');
      setStatus('фото · камера · влево · портрет · что видишь');
      return;
    }

    speak('Не понял. Скажи: фото, камера или что видишь');
    setStatus('Не понял. Попробуй иначе');
  }

  function activateDir(key) {
    const btn = document.querySelector('.chip.dir[data-dir="' + key + '"]');
    if (btn) btn.click();
    else {
      state.dirMode = key;
      showTip();
      speak(tips[key] ? tips[key].title : key);
    }
  }

  function startListen() {
    unlockAudio();
    if (!SR) {
      setStatus('Голос недоступен в этом браузере');
      speak('Голосовой ввод недоступен. Открой в Safari');
      toast('Нужен Safari / Chrome с микрофоном');
      return;
    }
    if (state.isListening && state.recognition) {
      try { state.recognition.stop(); } catch (_) {}
      return;
    }
    try {
      const rec = new SR();
      state.recognition = rec;
      rec.lang = 'ru-RU';
      rec.interimResults = false;
      rec.maxAlternatives = 3;
      rec.continuous = false;
      rec.onstart = () => setListening(true);
      rec.onend = () => {
        setListening(false);
        state.recognition = null;
      };
      rec.onerror = (ev) => {
        setListening(false);
        const err = ev.error || '';
        if (err === 'not-allowed') {
          setStatus('Разреши микрофон в настройках');
          toast('Микрофон запрещён');
          speak('Разреши микрофон');
        } else if (err === 'no-speech') {
          setStatus('Тишина. Удержи глаза и говори');
          toast('Не услышал речь');
        } else {
          setStatus('Ошибка голоса: ' + err);
        }
      };
      rec.onresult = (ev) => {
        let best = '';
        for (let i = 0; i < ev.results.length; i++) {
          if (ev.results[i].isFinal || i === ev.results.length - 1) {
            best = ev.results[i][0].transcript;
          }
        }
        handleCommand(best);
      };
      rec.start();
      speak('Слушаю');
    } catch (e) {
      setListening(false);
      toast('Не запустился микрофон');
      setStatus(String(e.message || e));
    }
  }

  /* hold face / mic to talk */
  let holdTimer = null;
  function onHoldStart(e) {
    if (e && e.pointerType === 'mouse' && e.button !== 0) return;
    unlockAudio();
    state.idle = false;
    holdTimer = setTimeout(() => startListen(), 280);
  }
  function onHoldEnd() {
    clearTimeout(holdTimer);
  }

  if (face) {
    face.addEventListener('pointerdown', (e) => {
      const rect = face.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const cy = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      look(cx * 0.9, cy * 0.9);
      onHoldStart(e);
      setStatus('Удерживай — скажи команду', true);
    });
    face.addEventListener('pointerup', onHoldEnd);
    face.addEventListener('pointerleave', onHoldEnd);
    face.addEventListener('pointercancel', onHoldEnd);
    face.addEventListener('click', () => {
      unlockAudio();
      if (!state.spokenOnce) {
        speak('Привет! Я Cam. Удерживай глаза и говори');
        setStatus('Удержи глаза и говори', true);
      }
    });
  }

  if (micBtn) {
    micBtn.addEventListener('click', (e) => {
      e.preventDefault();
      unlockAudio();
      startListen();
    });
  }

  /* —— «Зрение» по кадру (яркость / контраст) —— */
  function analyzeScene() {
    const video = $('#camVideo');
    const canvas = $('#camCanvas');
    const layer = $('#camLayer');

    const run = () => {
      if (!video || !canvas || video.readyState < 2) {
        speak('Мало данных с камеры');
        setStatus('Камера ещё грузится');
        return;
      }
      const w = 64;
      const h = 48;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      let sum = 0;
      let min = 255;
      let max = 0;
      for (let i = 0; i < data.length; i += 4) {
        const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sum += y;
        if (y < min) min = y;
        if (y > max) max = y;
      }
      const avg = sum / (data.length / 4);
      const contrast = max - min;
      let msg;
      if (avg < 45) msg = 'Темно. Добавь свет или поверни к окну.';
      else if (avg > 210) msg = 'Слишком ярко. Убери контровой свет.';
      else if (contrast < 40) msg = 'Плоский свет. Поверни объект к окну.';
      else msg = 'Свет нормальный. Можно снимать. Держи горизонт ровно.';
      setStatus(msg, true);
      speak(msg);
      toast('Cam посмотрел на кадр');
    };

    if (!layer || layer.classList.contains('hidden')) {
      speak('Открываю глаза');
      startCam().then(() => setTimeout(run, 900));
    } else {
      run();
    }
  }

  function switchTab(name) {
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    $$('.pane').forEach((p) => p.classList.toggle('active', p.id === 'pane-' + name));
  }
  $$('.tab').forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  function updateOrient() {
    const landscape = window.matchMedia('(orientation: landscape)').matches;
    const badge = $('#orientBadge');
    if (badge) badge.textContent = landscape ? 'Альбом' : 'Портрет';
    return landscape ? 'landscape' : 'portrait';
  }
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      const o = updateOrient();
      toast(o === 'landscape' ? 'Альбом' : 'Портрет');
    }, 200);
  });
  window.addEventListener('resize', updateOrient);
  updateOrient();

  $('#btnOrient') && $('#btnOrient').addEventListener('click', () => {
    const o = updateOrient();
    speak(o === 'portrait' ? 'Портрет' : 'Альбом');
    toast(o === 'portrait' ? 'Портрет. Поверни для альбома' : 'Альбом');
  });

  const tips = {
    portrait: { title: 'Портрет', list: ['Камера на уровне глаз.', 'Мягкий свет сбоку.', 'Фокус на глазах.', 'Плечо чуть к камере.'] },
    cinematic: { title: 'Кино', list: ['Альбом + медленный наезд.', 'Низкий угол.', 'Держи кадр 2–4 сек.', 'Линии ведут взгляд.'] },
    blog: { title: 'Блог', list: ['Смотри в объектив.', 'Крючок в первые 3 сек.', 'Меняй ракурс.', 'Две руки или OM5.'] },
    product: { title: 'Предмет', list: ['Боковой свет.', 'Чистый фон.', 'Облет на OM5.', 'Фокус на детали.'] },
    landscape: { title: 'Пейзаж', list: ['Горизонт на 1/3.', 'Широкий 0.5×.', 'Золотой час.', 'Держи ровно.'] },
    sport: { title: 'Спорт', list: ['Серийная съёмка.', 'Панорама с объектом.', 'Низкий угол.', 'ActiveTrack в Mimo.'] },
  };

  function showTip() {
    const box = $('#tipCard');
    if (!box) return;
    if (!state.dirMode || !tips[state.dirMode]) {
      box.innerHTML = '<p class="tip-title">Режим</p><p class="tip-text">Выбери или скажи «портрет»</p>';
      return;
    }
    const d = tips[state.dirMode];
    const i = state.tipIndex % d.list.length;
    box.innerHTML = '<p class="tip-title">' + d.title + ' · ' + (i + 1) + '/' + d.list.length + '</p><p class="tip-text">' + d.list[i] + '</p>';
    setStatus(d.list[i], true);
  }

  $$('.chip.dir').forEach((b) => {
    b.addEventListener('click', () => {
      $$('.chip.dir').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.dirMode = b.dataset.dir;
      state.tipIndex = 0;
      showTip();
      speak(tips[state.dirMode].title + '. ' + tips[state.dirMode].list[0]);
      switchTab('director');
    });
  });

  $('#btnNextTip') && $('#btnNextTip').addEventListener('click', () => {
    if (!state.dirMode) { toast('Сначала режим'); return; }
    state.tipIndex++;
    showTip();
    speak(tips[state.dirMode].list[state.tipIndex % tips[state.dirMode].list.length]);
  });

  $$('.chip[data-timer]').forEach((b) => {
    b.addEventListener('click', () => {
      $$('.chip[data-timer]').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.timerSec = parseInt(b.dataset.timer, 10);
      toast(state.timerSec ? 'Таймер ' + state.timerSec + ' с' : 'Таймер выкл');
    });
  });

  $('#btnManual') && $('#btnManual').addEventListener('click', () => {
    state.manual = !state.manual;
    $('#btnManual').textContent = state.manual ? 'Ручной: вкл' : 'Ручной: выкл';
    const mb = $('#modeBadge');
    if (mb) mb.textContent = state.manual ? 'Ручной' : 'Авто';
  });

  $('#btnPhotoMode') && $('#btnPhotoMode').addEventListener('click', () => {
    state.captureMode = 'photo';
    $('#btnShutter') && $('#btnShutter').classList.remove('video');
    toast('Фото');
    speak('Фото');
  });
  $('#btnVideoMode') && $('#btnVideoMode').addEventListener('click', () => {
    state.captureMode = 'video';
    $('#btnShutter') && $('#btnShutter').classList.add('video');
    toast('Видео');
    speak('Видео');
  });

  async function startCam() {
    try {
      if (state.stream) stopCam(false);
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: state.facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: state.captureMode === 'video',
      });
      const v = $('#camVideo');
      v.srcObject = state.stream;
      await v.play();
      $('#camLayer').classList.remove('hidden');
      $('#miniRobot').classList.remove('hidden');
      $('#robotWrap').classList.add('hidden');
      updateOrient();
      setStatus('Камера. Скажи «что видишь» или жми затвор', true);
      speak('Камера');
      return true;
    } catch (e) {
      toast('Нужен доступ к камере');
      setStatus('Разреши камеру в настройках');
      speak('Разреши камеру');
      return false;
    }
  }

  function stopCam(hide) {
    if (state.recording) stopRecording();
    if (state.stream) {
      state.stream.getTracks().forEach((t) => t.stop());
      state.stream = null;
    }
    const v = $('#camVideo');
    if (v) v.srcObject = null;
    if (hide !== false) {
      $('#camLayer').classList.add('hidden');
      $('#miniRobot').classList.add('hidden');
      $('#robotWrap').classList.remove('hidden');
    }
  }

  function runTimer(cb) {
    let left = state.timerSec || 0;
    if (!left) { cb(); return; }
    const tick = () => {
      setStatus('Таймер ' + left, true);
      toast(String(left));
      if (left <= 0) { cb(); return; }
      speak(String(left));
      left -= 1;
      setTimeout(tick, 1000);
    };
    tick();
  }

  function takePhoto() {
    const video = $('#camVideo');
    const canvas = $('#camCanvas');
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const data = canvas.toDataURL('image/jpeg', 0.92);
    const box = $('#snapBox');
    if (box) {
      box.innerHTML = '<img src="' + data + '" alt="snap" />';
      box.classList.remove('hidden');
    }
    setStatus('Кадр готов!', true);
    speak('Кадр');
    toast('Снимок');
  }

  function startRecording() {
    if (!state.stream || state.recording) return;
    state.chunks = [];
    try {
      state.mediaRecorder = new MediaRecorder(state.stream);
    } catch (e) {
      toast('Запись недоступна');
      return;
    }
    state.mediaRecorder.ondataavailable = (e) => { if (e.data.size) state.chunks.push(e.data); };
    state.mediaRecorder.onstop = () => {
      const blob = new Blob(state.chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cam-' + Date.now() + '.webm';
      a.click();
      toast('Видео сохранено');
      speak('Готово');
    };
    state.mediaRecorder.start();
    state.recording = true;
    $('#recBadge') && $('#recBadge').classList.remove('hidden');
    setStatus('Идёт запись…', true);
    speak('Запись');
  }

  function stopRecording() {
    if (!state.mediaRecorder || !state.recording) return;
    state.mediaRecorder.stop();
    state.recording = false;
    $('#recBadge') && $('#recBadge').classList.add('hidden');
  }

  function onShutter() {
    if (state.captureMode === 'video') {
      if (state.recording) stopRecording();
      else runTimer(startRecording);
    } else {
      runTimer(takePhoto);
    }
  }

  $('#btnOpenCam') && $('#btnOpenCam').addEventListener('click', () => { unlockAudio(); startCam(); });
  $('#btnCamClose') && $('#btnCamClose').addEventListener('click', () => stopCam(true));
  $('#btnShutter') && $('#btnShutter').addEventListener('click', onShutter);
  $('#btnFlipCam') && $('#btnFlipCam').addEventListener('click', () => {
    state.facing = state.facing === 'environment' ? 'user' : 'environment';
    startCam();
  });

  const apps = {
    camera: { url: 'camera://', name: 'Камера' },
    mimo: { url: 'djimimo://', name: 'DJI Mimo' },
    photos: { url: 'photos-redirect://', name: 'Фото' },
    phone: { url: 'tel:', name: 'Телефон' },
  };

  $$('.app-card').forEach((b) => {
    b.addEventListener('click', () => {
      const app = apps[b.dataset.app];
      if (!app) return;
      toast('Открываю ' + app.name);
      speak(app.name);
      setTimeout(() => {
        window.location.href = app.url;
      }, 200);
    });
  });

  $('#btnMute') && $('#btnMute').addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    $('#btnMute').textContent = state.isMuted ? '🔇' : '🔊';
    if (state.isMuted && state.synth) state.synth.cancel();
    toast(state.isMuted ? 'Звук выкл' : 'Звук вкл');
  });

  $('#btnWake') && $('#btnWake').addEventListener('click', () => {
    unlockAudio();
    state.idle = false;
    setStatus('Я здесь! Удержи глаза и говори', true);
    speak('Я здесь! Что снимаем?');
    look(0, 0);
    setTimeout(() => { state.idle = true; }, 4000);
  });

  $('#btnIdle') && $('#btnIdle').addEventListener('click', () => {
    state.idle = true;
    setStatus('Живу сам…');
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  // Первый жест пользователя — разблокировка звука iOS
  document.body.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
  document.body.addEventListener('click', unlockAudio, { once: true });

  setStatus('Тапни глаза или 🎤 — я Cam', true);
  // На iOS speak без жеста молчит — ждём тап
})();
