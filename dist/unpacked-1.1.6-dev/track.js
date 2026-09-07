// track.js — ШИНА СОБЫТИЙ (09-02). Закрывает слепое пятно: «видно, сколько поставили,
// не видно, летают ли». Разбор точек — `lab/metrics-plan.md`.
//
// ЧТО УХОДИТ: имя события и пара чисел (сколько минут, какая длина заказана, как кончился рейс).
// Ни URL, ни содержимого вкладок, ни текста — продукт их и не видит, прав на это нет.
// Идентификатор анонимный, генерится на устройстве и ни к чему больше не привязан.
//
// КУДА: GA4 Measurement Protocol, тот же ресурс, что считает установки на welcome-странице
// (`G-X9WZSNCLXF`, property 548843136). Umami был первым выбором и отвергнут по цене ЧТЕНИЯ:
// у неё бесплатный тариф Hobby даёт 100K событий и 1 сайт, но **API access только на Pro $20/мес** —
// то есть смотреть можно лишь глазами в их дашборде, а `analytics/pulse.py` не подключить никогда.
// GA4 бесплатен и на запись, и на чтение, лимитов такого рода не имеет, и студийный дашборд для
// этого продукта к нему УЖЕ подключён.
//
// ПРАВ НЕ ТРЕБУЕТ: проверено 09-02 на нашем origin — `google-analytics.com/mp/collect` отдаёт
// `access-control-allow-origin: chrome-extension://miknhpho…`, обычный fetch проходит без
// `host_permissions`. Значит при обновлении у людей НЕ появится плашка о новых правах.
(function (root) {
  'use strict';
  const MEASUREMENT_ID = 'G-X9WZSNCLXF';
  // Создаётся автором один раз: GA4 → Admin → Data Streams → выбрать поток → Measurement Protocol
  // API secrets → Create. Пока пусто — шина МОЛЧИТ (лучше тишина, чем события в никуда).
  const API_SECRET = 'rsWkt9wFTpm5O1xW8f-NXQ';
  const KEY = 'mt.cid';

  // дев-сборки молчат — иначе собственные прогоны автора красят статистику (тот же приём, что у
  // welcome-страницы и uninstall-URL, см. background.js)
  let IS_DEV = true;
  try { IS_DEV = ((chrome.runtime.getManifest().version_name) || '').includes('-dev'); } catch (e) {}

  let cid = null;
  function clientId() {
    if (cid) return Promise.resolve(cid);
    return new Promise((res) => {
      try {
        chrome.storage.local.get(KEY, (o) => {
          cid = (o && o[KEY]) || (Math.random().toString(36).slice(2) + '.' + Date.now());
          try { chrome.storage.local.set({ [KEY]: cid }); } catch (e) {}
          res(cid);
        });
      } catch (e) { cid = 'anon'; res(cid); }
    });
  }

  // Никогда не бросает и ничего не ждёт: счётчик не имеет права влиять на звук или на жест.
  function track(name, params) {
    if (IS_DEV || !API_SECRET) return Promise.resolve();
    return clientId().then((id) => fetch(
      'https://www.google-analytics.com/mp/collect'
        + '?measurement_id=' + MEASUREMENT_ID + '&api_secret=' + API_SECRET,
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: id,
          events: [{ name: name, params: Object.assign({}, params || {}) }],
        }),
      }
    )).catch(() => {});
  }

  root.track = track;
})(typeof self !== 'undefined' ? self : this);
