/* Cam stick + call + BLE — loaded after app.js */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const statusEl = $('#robotStatus');
  const toastEl = $('#toast');
  const leftPupil = $('#leftPupil');
  const rightPupil = $('#rightPupil');
  const synth = window.speechSynthesis;

  function look(x, y) {
    const max = 12;
    const t = 'translate(' + (x * max) + 'px, ' + (y * max) + 'px)';
    if (leftPupil) leftPupil.style.transform = t;
    if (rightPupil) rightPupil.style.transform = t;
  }
  function setStatus(text, hi) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle('hi', !!hi);
  }
  function toast(msg, ms) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), ms || 2400);
  }
  function speak(text) {
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    u.rate = 1.05;
    u.pitch = 1.15;
    synth.speak(u);
  }

  const cmds = {
    left: { text: 'Медленно влево на палке', look: [-1, 0], say: 'Влево' },
    right: { text: 'Медленно вправо', look: [1, 0], say: 'Вправо' },
    up: { text: 'Подними камеру вверх', look: [0, -1], say: 'Вверх' },
    down: { text: 'Опусти камеру вниз', look: [0, 1], say: 'Вниз' },
    orbit: { text: 'Орбита 360°: веди палку вокруг объекта', look: [0.6, 0], say: 'Орбита' },
    push: { text: 'Наезд: плавно приближайся', look: [0, 0], say: 'Наезд' },
    stop: { text: 'Стоп. Зафиксируй кадр', look: [0, 0], say: 'Стоп' },
    track: { text: 'ActiveTrack в Mimo: выбери объект', look: [0, 0], say: 'Трекинг' },
  };

  $$('.chip.cmd').forEach((b) => {
    b.addEventListener('click', () => {
      $$('.chip.cmd').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const c = cmds[b.dataset.cmd];
      if (!c) return;
      look(c.look[0], c.look[1]);
      setStatus(c.text, true);
      speak(c.say + '. ' + c.text);
      const card = $('#stickCard');
      if (card) card.innerHTML = '<p class="tip-title">Cam ведёт</p><p class="tip-text">' + c.text + '</p>';
      toast(c.say);
    });
  });

  function updateBleStatus() {
    const el = $('#bleStatus');
    if (!el) return;
    if (navigator.bluetooth) el.textContent = 'Bluetooth: API есть — можно пробовать Connect';
    else el.textContent = 'Bluetooth: Safari без Web Bluetooth. Нужен beacio / WebBLE или Mimo';
  }
  updateBleStatus();

  async function tryBleConnect() {
    if (!navigator.bluetooth) {
      toast('Safari не даёт BLE. Поставь beacio или открой Mimo');
      speak('Нужен Mimo');
      setStatus('BLE недоступен в Safari');
      return;
    }
    try {
      setStatus('Ищу устройство…', true);
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [0xfff0, 0xffe0, 'generic_access'],
      });
      await device.gatt.connect();
      setStatus('BLE: ' + (device.name || 'устройство'), true);
      speak('Подключено');
      toast('Связь есть. Моторы OM5 — протокол DJI / Mimo', 4000);
      updateBleStatus();
    } catch (e) {
      toast('Не удалось: ' + (e.message || 'отмена'));
      setStatus('BLE: нет связи');
      speak('Не подключился. Открой Mimo');
    }
  }

  $('#btnBleConnect') && $('#btnBleConnect').addEventListener('click', tryBleConnect);
  $('#btnOpenMimo') && $('#btnOpenMimo').addEventListener('click', () => {
    speak('Mimo');
    window.location.href = 'djimimo://';
    setTimeout(() => toast('Если не открылось — Mimo вручную'), 1200);
  });

  function camCall() {
    setStatus('Cam звонит… 📞', true);
    speak('Алло! Это Cam. Готов снимать?');
    toast('Cam звонит тебе');
    const ring = $('#listeningRing');
    if (ring) {
      ring.classList.add('active');
      setTimeout(() => ring.classList.remove('active'), 3500);
    }
  }

  function dialNumber() {
    const input = $('#callNumber');
    const num = ((input && input.value) || '').replace(/[^\d+]/g, '');
    if (!num) {
      window.location.href = 'tel:';
      toast('Открываю Телефон');
      return;
    }
    setStatus('Набираю ' + num, true);
    speak('Звоню');
    window.location.href = 'tel:' + num;
  }

  $('#btnCall') && $('#btnCall').addEventListener('click', camCall);
  $('#btnCallPanel') && $('#btnCallPanel').addEventListener('click', camCall);
  $('#btnDial') && $('#btnDial').addEventListener('click', dialNumber);
})();
