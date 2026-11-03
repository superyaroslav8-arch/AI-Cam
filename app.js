/**
 * AI Cam — LOOI-style robot operator for iPhone + selfie stick / OM5
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
    facing: 'environment',
    stream: null,
    mediaRecorder: null,
    chunks: [],
    recording: false,
    dirMode: null,
    tipIndex: 0,
    synth: window.speechSynthesis || null,
    recognition: null,
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  const leftPupil = $('#leftPupil');
  const rightPupil = $('#rightPupil');
  const statusEl = $('#robotStatus');
  const toastEl = $('#toast');
  const face = $('#looiFace');

  function look(x, y) {
    const max = 12;
    const t = `translate(${x * max}px, ${y * max}px)`;
    if (leftPupil) leftPupil.style.transform = t;
    if (rightPupil) rightPupil.style.transform = t;
  }

  function blink() {
    if (!face) return;
    face.classList.add('blink');
    setTimeout(() => face.classList.remove('blink'), 150);
  }

  function setStatus(text, hi = false) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle('hi', hi);
  }

  function toast(msg, ms = 2200) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  function speak(text) {
    if (state.isMuted || !state.synth) return;
    state.synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    u.rate = 1.05;
    u.pitch = 1.15;
    const voices = state.synth.getVoices();
    const ru = voices.find((v) => v.lang.startsWith('ru'));
    if (ru) u.voice = ru;
    state.synth.speak(u);
  }

  const idleActs = [
    { text: 'Зеваю…', say: 'Ммм' },
    { text: 'Смотрю по сторонам', say: null },
    { text: 'Думаю о кадре…', say: 'Хм' },
    { text: 'Готов снимать!', say: 'Готов' },
    { text: 'Где свет получше?', say: null },
    { text: 'Может, киношный ракурс?', say: null },
  ];

  function doIdle() {
    if (!state.idle) return;
    const cam = $('#camLayer');
    if (cam && !cam.classList.contains('hidden')) return;
    const a = idleActs[Math.floor(Math.random() * idleActs.length)];
    setStatus(a.text);
    const log = $('#idleLog');
    if (log) log.textContent = a.text;
    look((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.0);
    if (a.say) speak(a.say);
  }

  setInterval(blink, 2800 + Math.random() * 2200);
  setInterval(() => {
    if (state.idle) look((Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.1);
  }, 2400);
  setInterval(doIdle, 7000);

  if (face) {
    face.addEventListener('pointerdown', (e) => {
      const rect = face.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const cy = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      look(cx * 0.9, cy * 0.9);
      state.idle = false;
      setStatus('Ха-ха! Щекотно', true);
      speak('Ха-ха!');
      toast('Глазки живут');
      setTimeout(() => {
        state.idle = true;
        setStatus('Готов помогать со съёмкой');
      }, 1600);
    });
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
      toast(o === 'landscape' ? 'Альбомная ориентация' : 'Портретная ориентация');
    }, 200);
  });
  window.addEventListener('resize', updateOrient);
  updateOrient();

  $('#btnOrient') && $('#btnOrient').addEventListener('click', () => {
    const o = updateOrient();
    toast(o === 'portrait' ? 'Сейчас портрет. Поверни для альбома.' : 'Сейчас альбом. Для портрета — вертикально.');
    speak(o === 'portrait' ? 'Портрет' : 'Альбом');
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
      box.innerHTML = '<p class="tip-title">Выбери режим</p><p class="tip-text">Подскажу ракурс для селфи-палки / OM5.</p>';
      return;
    }
    const d = tips[state.dirMode];
    const i = state.tipIndex % d.list.length;
    box.innerHTML = '<p class="tip-title">' + d.title + ' · ' + (i + 1) + '/' + d.list.length + '</p><p class="tip-text">' + d.list[i] + '</p>';
    setStatus(d.list[i]);
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
    if (!state.dirMode) { toast('Сначала выбери режим'); return; }
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
    toast(state.manual ? 'Ручной режим' : 'Авто режим');
  });

  $('#btnPhotoMode') && $('#btnPhotoMode').addEventListener('click', () => {
    state.captureMode = 'photo';
    $('#btnShutter') && $('#btnShutter').classList.remove('video');
    toast('Режим фото');
  });
  $('#btnVideoMode') && $('#btnVideoMode').addEventListener('click', () => {
    state.captureMode = 'video';
    $('#btnShutter') && $('#btnShutter').classList.add('video');
    toast('Режим видео');
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
      setStatus('Камера включена', true);
      speak('Камера');
      switchTab('shoot');
    } catch (e) {
      toast('Нужен доступ к камере');
      setStatus('Разреши камеру');
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
      setStatus('Таймер ' + left);
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
    setStatus('Кадр!');
    speak('Кадр');
    toast('Снимок готов');
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
      a.download = 'aicam-' + Date.now() + '.webm';
      a.click();
      toast('Видео сохранено');
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

  $('#btnOpenCam') && $('#btnOpenCam').addEventListener('click', startCam);
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
    settings: { url: 'App-prefs://', name: 'Настройки' },
  };

  $$('.app-card').forEach((b) => {
    b.addEventListener('click', () => {
      const app = apps[b.dataset.app];
      if (!app) return;
      toast('Открываю ' + app.name + '…');
      speak(app.name);
      setTimeout(() => {
        window.location.href = app.url;
        setTimeout(() => toast('Если не открылось — запусти вручную'), 1200);
      }, 250);
    });
  });

  const scenarios = {
    orbit: 'Орбита 360°: веди OM5 вокруг объекта.',
    push: 'Наезд: плавно приближайся.',
    reveal: 'Reveal вверх: с низа поднимай камеру.',
    follow: 'ActiveTrack: в Mimo выбери объект.',
  };

  $$('.chip.sc').forEach((b) => {
    b.addEventListener('click', () => {
      $$('.chip.sc').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const t = scenarios[b.dataset.sc] || '';
      const d = $('#scDesc');
      if (d) d.textContent = t;
      setStatus(t);
      speak(t);
    });
  });

  $('#btnMute') && $('#btnMute').addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    $('#btnMute').textContent = state.isMuted ? '🔇' : '🔊';
    if (state.isMuted) state.synth && state.synth.cancel();
    toast(state.isMuted ? 'Звук выкл' : 'Звук вкл');
  });

  $('#btnWake') && $('#btnWake').addEventListener('click', () => {
    state.idle = false;
    setStatus('Я здесь! Что снимаем?', true);
    speak('Я здесь! Что снимаем?');
    look(0, 0);
    setTimeout(() => { state.idle = true; }, 3000);
  });

  $('#btnIdle') && $('#btnIdle').addEventListener('click', () => {
    state.idle = true;
    setStatus('Живу своей жизнью…');
    toast('Idle как у LOOI');
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  setStatus('Привет! Я AI Cam — оператор в стиле LOOI');
  setTimeout(() => speak('Привет! Я AI Cam'), 600);
})();
