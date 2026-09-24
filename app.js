/* =========================================================
   CRM - Supabase, версия с бригадирами
   ========================================================= */

var SUPABASE_URL = 'https://grohsnvinhidswzieuwo.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb2hzbnZpbmhpZHN3emlldXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDA1MDcsImV4cCI6MjEwNTgxNjUwN30.bwAsw8BV-DUtpF23D1r1CTMJuvzejAQCi0qK2NfZScA';

var currentUser = null;
var allOrders = [];
var allBrigadiers = [];

/* ============ API ============ */
function supa(path, options) {
  options = options || {};
  var headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': options.prefer || 'return=representation'
  };
  return fetch(SUPABASE_URL + '/rest/v1' + path, {
    method: options.method || 'GET',
    headers: headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) { throw new Error('HTTP ' + r.status + ': ' + t); });
    if (r.status === 204) return null;
    return r.json();
  });
}

function hashPassword(pwd) {
  var hash = 0;
  for (var i = 0; i < pwd.length; i++) {
    hash = ((hash << 5) - hash) + pwd.charCodeAt(i);
    hash |= 0;
  }
  return 'h' + hash;
}

/* ============ АВТОРИЗАЦИЯ ============ */
function switchAuth(mode) {
  document.getElementById('tabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('tabRegister').classList.toggle('active', mode === 'register');
  document.getElementById('loginForm').style.display = mode === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = mode === 'register' ? 'block' : 'none';
}

function handleRegister(e) {
  e.preventDefault();
  var login = document.getElementById('regUser').value.trim();
  var pass = document.getElementById('regPass').value;
  var role = document.getElementById('regRole').value;
  supa('/crm_users?login=eq.' + encodeURIComponent(login)).then(function(rows) {
    if (rows.length > 0) throw new Error('Пользователь уже существует');
    return supa('/crm_users', { method: 'POST', body: { login: login, password_hash: hashPassword(pass), role: role } });
  }).then(function() {
    toast('Регистрация успешна!', 'success');
    switchAuth('login');
    document.getElementById('loginUser').value = login;
  }).catch(function(err) { toast(err.message, 'error'); });
}

function handleLogin(e) {
  e.preventDefault();
  var login = document.getElementById('loginUser').value.trim();
  var pass = document.getElementById('loginPass').value;
  supa('/crm_users?login=eq.' + encodeURIComponent(login)).then(function(rows) {
    if (!rows.length) throw new Error('Пользователь не найден');
    var u = rows[0];
    if (u.password_hash !== hashPassword(pass)) throw new Error('Неверный пароль');
    currentUser = { login: u.login, role: u.role };
    localStorage.setItem('crm_session', JSON.stringify(currentUser));
    enterApp();
  }).catch(function(err) { toast(err.message, 'error'); });
}

function logout() {
  if (!confirm('Выйти?')) return;
  currentUser = null;
  localStorage.removeItem('crm_session');
  document.getElementById('app').style.display = 'none';
  document.getElementById('authScreen').style.display = 'block';
}

function enterApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('currentUserName').textContent = currentUser.login + ' (' + currentUser.role + ')';
  loadBrigadiers().then(loadOrders);
}

function checkSession() {
  var s = localStorage.getItem('crm_session');
  if (s) { try { currentUser = JSON.parse(s); enterApp(); } catch(e) {} }
}

/* ============ ДАННЫЕ ============ */
function loadBrigadiers() {
  return supa('/crm_brigadiers?active=eq.true&order=name').then(function(rows) {
    allBrigadiers = rows;
    fillBrigadierSelects();
  });
}

function fillBrigadierSelects() {
  var sel1 = document.getElementById('brigadierSelect');
  var sel2 = document.getElementById('filterBrigadier');
  if (sel1) {
    var cur = sel1.value;
    sel1.innerHTML = '<option value="">— не выбран —</option>' +
      allBrigadiers.map(function(b) { return '<option value="' + b.name + '">' + b.name + '</option>'; }).join('');
    sel1.value = cur;
  }
  if (sel2) {
    var cur2 = sel2.value;
    sel2.innerHTML = '<option value="">Все</option>' +
      allBrigadiers.map(function(b) { return '<option value="' + b.name + '">' + b.name + '</option>'; }).join('');
    sel2.value = cur2;
  }
}

function loadOrders() {
  return supa('/crm_orders?order=datetime.desc').then(function(rows) {
    allOrders = rows.map(function(r) {
      return {
        id: r.id,
        clientName: r.client_name,
        clientPhone: r.client_phone,
        address: r.address,
        datetime: r.datetime,
        status: r.status,
        orderType: r.order_type || 'Под ключ',
        brigadier: r.brigadier || '',
        source: r.source || 'Сарафанка',
        totalAmount: Number(r.total_amount) || 0,
        expense: Number(r.expense) || 0,
        toGive: Number(r.to_give) || 0,
        estimateAmount: Number(r.estimate_amount) || 0,
        advanceAmount: Number(r.advance_amount) || 0,
        note: r.note || ''
      };
    });
    render();
    if (document.getElementById('page-brigadiers').style.display !== 'none') renderBrigadiers();
    if (document.getElementById('page-analytics').style.display !== 'none') renderAnalytics();
  });
}

/* ============ СТРАНИЦЫ ============ */
function switchPage(name, btn) {
  document.getElementById('page-orders').style.display = name === 'orders' ? 'block' : 'none';
  document.getElementById('page-brigadiers').style.display = name === 'brigadiers' ? 'block' : 'none';
  document.getElementById('page-analytics').style.display = name === 'analytics' ? 'block' : 'none';
  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  if (name === 'brigadiers') renderBrigadiers();
  if (name === 'analytics') renderAnalytics();
}/* ============ ФИЛЬТРЫ ============ */
function getFilteredOrders() {
  var elSearch = document.getElementById('searchInput');
  var elStatus = document.getElementById('filterStatus');
  var elType = document.getElementById('filterType');
  var elBrig = document.getElementById('filterBrigadier');
  var elSrc = document.getElementById('filterSource');
  var search = (elSearch ? elSearch.value : '').trim().toLowerCase();
  var status = elStatus ? elStatus.value : '';
  var type = elType ? elType.value : '';
  var brig = elBrig ? elBrig.value : '';
  var src = elSrc ? elSrc.value : '';

  return allOrders.filter(function(o) {
    if (search && !((o.clientName || '').toLowerCase().indexOf(search) !== -1 ||
                    (o.clientPhone || '').toLowerCase().indexOf(search) !== -1 ||
                    (o.address || '').toLowerCase().indexOf(search) !== -1)) return false;
    if (status && o.status !== status) return false;
    if (type && o.orderType !== type) return false;
    if (brig && o.brigadier !== brig) return false;
    if (src && o.source !== src) return false;
    return true;
  });
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterStatus').value = '';
  document.getElementById('filterType').value = '';
  document.getElementById('filterBrigadier').value = '';
  document.getElementById('filterSource').value = '';
  render();
}

/* ============ ФОРМАТ ============ */
function formatDate(dt) {
  if (!dt) return '—';
  var d = new Date(dt);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatMoney(n) {
  return (Number(n) || 0).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₽';
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

/* ============ РЕНДЕР ЗАЯВОК ============ */
function render() {
  var orders = getFilteredOrders();
  var tbody = document.getElementById('ordersTable');
  var cards = document.getElementById('ordersCards');
  var empty = document.getElementById('emptyMsg');
  if (tbody) tbody.innerHTML = '';
  if (cards) cards.innerHTML = '';
  if (empty) empty.style.display = orders.length === 0 ? 'block' : 'none';

  orders.forEach(function(o) {
    var st = 'status status-' + o.status.toLowerCase();
    if (tbody) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + formatDate(o.datetime) + '</td>' +
        '<td>' + escapeHtml(o.orderType) + '</td>' +
        '<td><strong>' + escapeHtml(o.clientName) + '</strong></td>' +
        '<td>' + escapeHtml(o.clientPhone) + '</td>' +
        '<td>' + escapeHtml(o.address) + '</td>' +
        '<td>' + escapeHtml(o.brigadier || '—') + '</td>' +
        '<td>' + escapeHtml(o.source) + '</td>' +
        '<td><span class="' + st + '">' + o.status + '</span></td>' +
        '<td>' + formatMoney(o.totalAmount) + '</td>' +
        '<td style="color:#0891b2;">' + formatMoney(o.advanceAmount) + '</td>' +
        '<td><button class="btn-edit" onclick="editOrder(' + o.id + ')">✎</button>' +
            '<button class="btn-danger" onclick="deleteOrder(' + o.id + ')">✕</button></td>';
      tbody.appendChild(tr);
    }
    if (cards) {
      var card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        '<div class="card-name">' + escapeHtml(o.clientName) + ' <span class="' + st + '">' + o.status + '</span></div>' +
        '<div class="card-row"><span class="label">📞</span><span class="value">' + escapeHtml(o.clientPhone) + '</span></div>' +
        '<div class="card-row"><span class="label">📍</span><span class="value">' + escapeHtml(o.address) + '</span></div>' +
        '<div class="card-row"><span class="label">Тип</span><span class="value">' + escapeHtml(o.orderType) + '</span></div>' +
        '<div class="card-row"><span class="label">Бригадир</span><span class="value">' + escapeHtml(o.brigadier || '—') + '</span></div>' +
        '<div class="card-money">' +
          '<div><div class="label">Смета</div><div class="num">' + formatMoney(o.totalAmount) + '</div></div>' +
          '<div><div class="label">Аванс</div><div class="num" style="color:#0891b2;">' + formatMoney(o.advanceAmount) + '</div></div>' +
        '</div>' +
        '<div class="card-actions">' +
          '<button class="btn-edit" onclick="editOrder(' + o.id + ')">✎ Изменить</button>' +
          '<button class="btn-danger" onclick="deleteOrder(' + o.id + ')">✕</button>' +
        '</div>';
      cards.appendChild(card);
    }
  });

  var active = orders.filter(function(o) { return o.status !== 'Отказ'; });
  var signed = orders.filter(function(o) { return o.status === 'Подписан'; });
  var rejected = orders.filter(function(o) { return o.status === 'Отказ'; });

  document.getElementById('statCount').textContent = orders.length;
  document.getElementById('statTotal').textContent = formatMoney(active.reduce(function(s, o) { return s + o.totalAmount; }, 0));
  document.getElementById('statSigned').textContent = formatMoney(signed.reduce(function(s, o) { return s + o.totalAmount; }, 0));
  document.getElementById('statAdvance').textContent = formatMoney(orders.reduce(function(s, o) { return s + o.advanceAmount; }, 0));
  document.getElementById('statRejected').textContent = rejected.length + ' шт';
}

/* ============ МОДАЛКА ЗАЯВКИ ============ */
function openCreateModal() {
  document.getElementById('orderForm').reset();
  document.getElementById('editId').value = '';
  document.getElementById('modalTitle').textContent = 'Новая заявка';
  var now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('datetime').value = now.toISOString().slice(0,16);
  document.getElementById('orderModal').classList.add('active');
}
function closeModal() { document.getElementById('orderModal').classList.remove('active'); }

document.addEventListener('input', function(e) {
  if (e.target.id === 'totalAmount' || e.target.id === 'expense') {
    var t = parseFloat(document.getElementById('totalAmount').value) || 0;
    var ex = parseFloat(document.getElementById('expense').value) || 0;
    document.getElementById('toGive').value = (t - ex).toFixed(2);
  }
});

function editOrder(id) {
  var o = allOrders.find(function(x) { return x.id === id; });
  if (!o) return;
  document.getElementById('editId').value = o.id;
  document.getElementById('orderType').value = o.orderType;
  document.getElementById('clientName').value = o.clientName;
  document.getElementById('clientPhone').value = o.clientPhone;
  document.getElementById('address').value = o.address;
  document.getElementById('datetime').value = o.datetime;
  document.getElementById('brigadierSelect').value = o.brigadier || '';
  document.getElementById('source').value = o.source;
  document.getElementById('status').value = o.status;
  document.getElementById('totalAmount').value = o.totalAmount;
  document.getElementById('advanceAmount').value = o.advanceAmount;
  document.getElementById('expense').value = o.expense;
  document.getElementById('toGive').value = o.toGive;
  document.getElementById('note').value = o.note;
  document.getElementById('modalTitle').textContent = 'Редактирование';
  document.getElementById('orderModal').classList.add('active');
}

function saveOrder(e) {
  e.preventDefault();
  var editId = document.getElementById('editId').value;
  var t = parseFloat(document.getElementById('totalAmount').value) || 0;
  var ex = parseFloat(document.getElementById('expense').value) || 0;
  var data = {
    order_type: document.getElementById('orderType').value,
    client_name: document.getElementById('clientName').value.trim(),
    client_phone: document.getElementById('clientPhone').value.trim(),
    address: document.getElementById('address').value.trim(),
    datetime: document.getElementById('datetime').value,
    brigadier: document.getElementById('brigadierSelect').value,
    source: document.getElementById('source').value,
    status: document.getElementById('status').value,
    total_amount: t,
    estimate_amount: t,
    advance_amount: parseFloat(document.getElementById('advanceAmount').value) || 0,
    expense: ex,
    to_give: t - ex,
    note: document.getElementById('note').value.trim(),
    created_by: currentUser.login,
    updated_at: new Date().toISOString()
  };
  var p = editId
    ? supa('/crm_orders?id=eq.' + editId, { method: 'PATCH', body: data })
    : supa('/crm_orders', { method: 'POST', body: data });
  p.then(function() {
    toast(editId ? 'Обновлено' : 'Добавлено', 'success');
    closeModal();
    loadOrders();
  }).catch(function(err) { toast('Ошибка: ' + err.message, 'error'); });
}

function deleteOrder(id) {
  if (!confirm('Удалить заявку?')) return;
  supa('/crm_orders?id=eq.' + id, { method: 'DELETE' }).then(function() {
    toast('Удалено', 'success'); loadOrders();
  }).catch(function(err) { toast('Ошибка: ' + err.message, 'error'); });
}

/* ============ БРИГАДИРЫ ============ */
function renderBrigadiers() {
  var tbody = document.getElementById('brigadiersTable');
  tbody.innerHTML = '';
  allBrigadiers.forEach(function(b) {
    var orders = allOrders.filter(function(o) { return o.brigadier === b.name; });
    var sum = orders.reduce(function(s, o) { return s + o.totalAmount; }, 0);
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><strong>' + escapeHtml(b.name) + '</strong></td>' +
      '<td>' + escapeHtml(b.phone || '—') + '</td>' +
      '<td>' + (b.percent || 0) + '%</td>' +
      '<td>' + orders.length + '</td>' +
      '<td>' + formatMoney(sum) + '</td>' +
      '<td><button class="btn-edit" onclick="editBrigadier(' + b.id + ')">✎</button>' +
          '<button class="btn-danger" onclick="deleteBrigadier(' + b.id + ')">✕</button></td>';
    tbody.appendChild(tr);
  });
}

function openBrigadierModal() {
  document.getElementById('brigadierForm').reset();
  document.getElementById('editBrigId').value = '';
  document.getElementById('brigTitle').textContent = 'Новый бригадир';
  document.getElementById('brigadierModal').classList.add('active');
}
function closeBrigadierModal() { document.getElementById('brigadierModal').classList.remove('active'); }

function editBrigadier(id) {
  var b = allBrigadiers.find(function(x) { return x.id === id; });
  if (!b) return;
  document.getElementById('editBrigId').value = b.id;
  document.getElementById('brigName').value = b.name;
  document.getElementById('brigPhone').value = b.phone || '';
  document.getElementById('brigPercent').value = b.percent || 0;
  document.getElementById('brigTitle').textContent = 'Редактирование';
  document.getElementById('brigadierModal').classList.add('active');
}

function saveBrigadier(e) {
  e.preventDefault();
  var id = document.getElementById('editBrigId').value;
  var data = {
    name: document.getElementById('brigName').value.trim(),
    phone: document.getElementById('brigPhone').value.trim(),
    percent: parseFloat(document.getElementById('brigPercent').value) || 0
  };
  var p = id
    ? supa('/crm_brigadiers?id=eq.' + id, { method: 'PATCH', body: data })
    : supa('/crm_brigadiers', { method: 'POST', body: data });
  p.then(function() {
    toast('Сохранено', 'success');
    closeBrigadierModal();
    loadBrigadiers().then(renderBrigadiers);
  }).catch(function(err) { toast('Ошибка: ' + err.message, 'error'); });
}

function deleteBrigadier(id) {
  if (!confirm('Удалить бригадира?')) return;
  supa('/crm_brigadiers?id=eq.' + id, { method: 'DELETE' }).then(function() {
    toast('Удалено', 'success');
    loadBrigadiers().then(renderBrigadiers);
  }).catch(function(err) { toast('Ошибка: ' + err.message, 'error'); });
}

/* ============ АНАЛИТИКА ============ */
function renderAnalytics() {
  var total = allOrders.filter(function(o) { return o.status !== 'Отказ'; })
    .reduce(function(s, o) { return s + o.totalAmount; }, 0);
  var signed = allOrders.filter(function(o) { return o.status === 'Подписан'; })
    .reduce(function(s, o) { return s + o.totalAmount; }, 0);
  var rejected = allOrders.filter(function(o) { return o.status === 'Отказ'; }).length;

  document.getElementById('anaCount').textContent = allOrders.length;
  document.getElementById('anaTotal').textContent = formatMoney(total);
  document.getElementById('anaSigned').textContent = formatMoney(signed);
  document.getElementById('anaRejected').textContent = rejected;

  function groupBy(field) {
    var map = {};
    allOrders.forEach(function(o) {
      var k = o[field] || '—';
      if (!map[k]) map[k] = { count: 0, sum: 0 };
      map[k].count++;
      map[k].sum += o.totalAmount;
    });
    return map;
  }

  function renderGroup(id, map) {
    var el = document.getElementById(id);
    var keys = Object.keys(map).sort(function(a, b) { return map[b].sum - map[a].sum; });
    el.innerHTML = keys.map(function(k) {
      return '<div class="ana-row"><span>' + escapeHtml(k) + ' (' + map[k].count + ')</span><b>' + formatMoney(map[k].sum) + '</b></div>';
    }).join('') || '<div style="color:#999;">Нет данных</div>';
  }

  renderGroup('anaSources', groupBy('source'));
  renderGroup('anaBrigadiers', groupBy('brigadier'));
  renderGroup('anaTypes', groupBy('orderType'));
}

/* ============ ЭКСПОРТ ============ */
function exportCSV() {
  var orders = getFilteredOrders();
  if (!orders.length) { toast('Нет данных', 'error'); return; }
  var headers = ['Дата','Тип','Клиент','Телефон','Адрес','Бригадир','Источник','Статус','Смета','Аванс','Заметка'];
  var rows = orders.map(function(o) {
    return [o.datetime, o.orderType, o.clientName, o.clientPhone, o.address, o.brigadier, o.source, o.status, o.totalAmount, o.advanceAmount, o.note];
  });
  var csv = '\uFEFF' + [headers].concat(rows).map(function(r) {
    return r.map(function(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';');
  }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href = url; a.download = 'orders_' + Date.now() + '.csv';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  toast('Экспортировано', 'success');
}

/* ============ TOAST ============ */
function toast(msg, type) {
  type = type || '';
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.className = 'toast'; }, 2500);
}

checkSession();
