/* =========================================================
   CRM - работает через Supabase (общая база для всех)
   ========================================================= */

var SUPABASE_URL = 'https://grohsnvinhidswzieuwo.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdyb2hzbnZpbmhpZHN3emlldXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNDA1MDcsImV4cCI6MjEwNTgxNjUwN30.bwAsw8BV-DUtpF23D1r1CTMJuvzejAQCi0qK2NfZScA';

var currentUser = null;
var allOrders = [];
var sortState = { field: 'datetime', dir: 'desc' };

/* ============ SUPABASE REST ============ */
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
    if (!r.ok) {
      return r.text().then(function(t) { throw new Error('HTTP ' + r.status + ': ' + t); });
    }
    if (r.status === 204) return null;
    return r.json();
  });
}

/* ============ ПАРОЛИ ============ */
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

  supa('/crm_users?login=eq.' + encodeURIComponent(login), { method: 'GET' }).then(function(rows) {
    if (rows.length > 0) throw new Error('Пользователь уже существует');
    return supa('/crm_users', {
      method: 'POST',
      body: { login: login, password_hash: hashPassword(pass), role: role }
    });
  }).then(function() {
    toast('Регистрация успешна! Теперь войдите.', 'success');
    switchAuth('login');
    document.getElementById('loginUser').value = login;
  }).catch(function(err) { toast(err.message, 'error'); });
}

function handleLogin(e) {
  e.preventDefault();
  var login = document.getElementById('loginUser').value.trim();
  var pass = document.getElementById('loginPass').value;

  supa('/crm_users?login=eq.' + encodeURIComponent(login), { method: 'GET' }).then(function(rows) {
    if (!rows.length) throw new Error('Пользователь не найден');
    var u = rows[0];
    if (u.password_hash !== hashPassword(pass)) throw new Error('Неверный пароль');
    currentUser = { login: u.login, role: u.role };
    localStorage.setItem('crm_session', JSON.stringify(currentUser));
    enterApp();
  }).catch(function(err) { toast(err.message, 'error'); });
}

function logout() {
  if (!confirm('Выйти из системы?')) return;
  currentUser = null;
  localStorage.removeItem('crm_session');
  document.getElementById('app').style.display = 'none';
  document.getElementById('authScreen').style.display = 'block';
}

function enterApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('currentUserName').textContent = currentUser.login + ' (' + currentUser.role + ')';
  loadOrders();
}

function checkSession() {
  var s = localStorage.getItem('crm_session');
  if (s) {
    try { currentUser = JSON.parse(s); enterApp(); } catch (e) {}
  }
}

/* ============ ЗАЯВКИ (Supabase) ============ */
function loadOrders() {
  supa('/crm_orders?order=datetime.desc').then(function(rows) {
    allOrders = rows.map(function(r) {
      return {
        id: r.id,
        clientName: r.client_name,
        clientPhone: r.client_phone,
        address: r.address,
        datetime: r.datetime,
        status: r.status,
        totalAmount: Number(r.total_amount),
        expense: Number(r.expense),
        toGive: Number(r.to_give),
        createdBy: r.created_by
      };
    });
    render();
  }).catch(function(err) { toast('Ошибка загрузки: ' + err.message, 'error'); });
}

/* ============ ФИЛЬТРЫ ============ */
function getFilteredOrders() {
  var search = document.getElementById('searchInput').value.trim().toLowerCase();
  var status = document.getElementById('filterStatus').value;
  var df = document.getElementById('filterDateFrom').value;
  var dt = document.getElementById('filterDateTo').value;
  var sort = document.getElementById('sortSelect').value;

  var result = allOrders.slice();

  if (search) {
    result = result.filter(function(o) {
      return (o.clientName || '').toLowerCase().indexOf(search) !== -1 ||
             (o.clientPhone || '').toLowerCase().indexOf(search) !== -1 ||
             (o.address || '').toLowerCase().indexOf(search) !== -1;
    });
  }
  if (status) result = result.filter(function(o) { return o.status === status; });
  if (df) result = result.filter(function(o) { return o.datetime && o.datetime.slice(0,10) >= df; });
  if (dt) result = result.filter(function(o) { return o.datetime && o.datetime.slice(0,10) <= dt; });

  if (sort) {
    var parts = sort.split('-'), field = parts[0], dir = parts[1];
    result.sort(function(a, b) {
      var va = a[field], vb = b[field];
      if (['datetime','totalAmount','expense','toGive'].indexOf(field) !== -1) {
        va = field === 'datetime' ? new Date(va).getTime() : Number(va) || 0;
        vb = field === 'datetime' ? new Date(vb).getTime() : Number(vb) || 0;
      } else {
        va = String(va || '').toLowerCase();
        vb = String(vb || '').toLowerCase();
      }
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }
  return result;
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterStatus').value = '';
  document.getElementById('filterDateFrom').value = '';
  document.getElementById('filterDateTo').value = '';
  document.getElementById('sortSelect').value = 'datetime-desc';
  render();
}

function sortBy(field) {
  if (sortState.field === field) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  else { sortState.field = field; sortState.dir = 'desc'; }
  document.getElementById('sortSelect').value = sortState.field + '-' + sortState.dir;
  render();
}

/* ============ ФОРМАТ ============ */
function formatDate(dt) {
  if (!dt) return '—';
  var d = new Date(dt);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function formatMoney(n) {
  return (Number(n) || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
}
function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

/* ============ РЕНДЕР ============ */
function render() {
  var orders = getFilteredOrders();
  var tbody = document.getElementById('ordersTable');
  var cards = document.getElementById('ordersCards');
  var empty = document.getElementById('emptyMsg');

  if (tbody) tbody.innerHTML = '';
  if (cards) cards.innerHTML = '';
  if (empty) empty.style.display = orders.length === 0 ? 'block' : 'none';

  orders.forEach(function(o) {
    var statusClass = 'status status-' + o.status.toLowerCase().replace(' ', '-');

    if (tbody) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + formatDate(o.datetime) + '</td>' +
        '<td><strong>' + escapeHtml(o.clientName) + '</strong></td>' +
        '<td>' + escapeHtml(o.clientPhone) + '</td>' +
        '<td>' + escapeHtml(o.address) + '</td>' +
        '<td><span class="' + statusClass + '">' + o.status + '</span></td>' +
        '<td>' + formatMoney(o.totalAmount) + '</td>' +
        '<td style="color:#dc2626;">' + formatMoney(o.expense) + '</td>' +
        '<td style="color:#059669; font-weight:600;">' + formatMoney(o.toGive) + '</td>' +
        '<td class="no-print">' +
          '<button class="btn-edit" onclick="editOrder(' + o.id + ')">✎</button>' +
          '<button class="btn-print" onclick="printOrder(' + o.id + ')">🖨</button>' +
          '<button class="btn-danger" onclick="deleteOrder(' + o.id + ')">✕</button>' +
        '</td>';
      tbody.appendChild(tr);
    }

    if (cards) {
      var card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        '<div class="card-name">' + escapeHtml(o.clientName) + '</div>' +
        '<div class="card-row"><span class="label">📞 Телефон</span><span class="value">' + escapeHtml(o.clientPhone) + '</span></div>' +
        '<div class="card-row"><span class="label">📍 Адрес</span><span class="value">' + escapeHtml(o.address) + '</span></div>' +
        '<div class="card-row"><span class="label">🕐 Дата</span><span class="value">' + formatDate(o.datetime) + '</span></div>' +
        '<div class="card-row"><span class="label">Статус</span><span class="' + statusClass + '">' + o.status + '</span></div>' +
        '<div class="card-money">' +
          '<div><div class="label">Сумма</div><div class="num">' + formatMoney(o.totalAmount) + '</div></div>' +
          '<div><div class="label">Расход</div><div class="num" style="color:#dc2626;">' + formatMoney(o.expense) + '</div></div>' +
          '<div><div class="label">К сдаче</div><div class="num" style="color:#059669;">' + formatMoney(o.toGive) + '</div></div>' +
        '</div>' +
        '<div class="card-actions">' +
          '<button class="btn-edit" onclick="editOrder(' + o.id + ')">✎ Изменить</button>' +
          '<button class="btn-print" onclick="printOrder(' + o.id + ')">🖨</button>' +
          '<button class="btn-danger" onclick="deleteOrder(' + o.id + ')">✕</button>' +
        '</div>';
      cards.appendChild(card);
    }
  });

  var total = orders.reduce(function(s, o) { return s + (Number(o.totalAmount) || 0); }, 0);
  var expense = orders.reduce(function(s, o) { return s + (Number(o.expense) || 0); }, 0);
  var profit = total - expense;

  document.getElementById('statCount').textContent = orders.length;
  document.getElementById('statTotal').textContent = formatMoney(total);
  document.getElementById('statExpense').textContent = formatMoney(expense);
  document.getElementById('statProfit').textContent = formatMoney(profit);
  document.getElementById('statProfit').style.color = profit >= 0 ? '#059669' : '#dc2626';
}

/* ============ МОДАЛКА ============ */
function openCreateModal() {
  document.getElementById('orderForm').reset();
  document.getElementById('editId').value = '';
  document.getElementById('toGive').value = '';
  document.getElementById('modalTitle').textContent = 'Новая заявка';
  var now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('datetime').value = now.toISOString().slice(0,16);
  document.getElementById('orderModal').classList.add('active');
}

function closeModal() { document.getElementById('orderModal').classList.remove('active'); }

document.addEventListener('input', function(e) {
  if (e.target.id === 'totalAmount' || e.target.id === 'expense') {
    var total = parseFloat(document.getElementById('totalAmount').value) || 0;
    var exp = parseFloat(document.getElementById('expense').value) || 0;
    document.getElementById('toGive').value = (total - exp).toFixed(2);
  }
});

function editOrder(id) {
  var o = allOrders.find(function(x) { return x.id === id; });
  if (!o) return;
  document.getElementById('editId').value = o.id;
  document.getElementById('clientName').value = o.clientName;
  document.getElementById('clientPhone').value = o.clientPhone;
  document.getElementById('address').value = o.address;
  document.getElementById('datetime').value = o.datetime;
  document.getElementById('status').value = o.status;
  document.getElementById('totalAmount').value = o.totalAmount;
  document.getElementById('expense').value = o.expense;
  document.getElementById('toGive').value = o.toGive;
  document.getElementById('modalTitle').textContent = 'Редактирование заявки';
  document.getElementById('orderModal').classList.add('active');
}

function saveOrder(e) {
  e.preventDefault();
  var editId = document.getElementById('editId').value;
  var totalAmount = parseFloat(document.getElementById('totalAmount').value) || 0;
  var expense = parseFloat(document.getElementById('expense').value) || 0;

  var data = {
    client_name: document.getElementById('clientName').value.trim(),
    client_phone: document.getElementById('clientPhone').value.trim(),
    address: document.getElementById('address').value.trim(),
    datetime: document.getElementById('datetime').value,
    status: document.getElementById('status').value,
    total_amount: totalAmount,
    expense: expense,
    to_give: totalAmount - expense,
    created_by: currentUser.login,
    updated_at: new Date().toISOString()
  };

  var promise;
  if (editId) {
    promise = supa('/crm_orders?id=eq.' + editId, { method: 'PATCH', body: data });
  } else {
    promise = supa('/crm_orders', { method: 'POST', body: data });
  }

  promise.then(function() {
    toast(editId ? 'Заявка обновлена' : 'Заявка добавлена', 'success');
    closeModal();
    loadOrders();
  }).catch(function(err) { toast('Ошибка: ' + err.message, 'error'); });
}

function deleteOrder(id) {
  if (!confirm('Удалить заявку?')) return;
  supa('/crm_orders?id=eq.' + id, { method: 'DELETE' }).then(function() {
    toast('Заявка удалена', 'success');
    loadOrders();
  }).catch(function(err) { toast('Ошибка: ' + err.message, 'error'); });
}

/* ============ ПЕЧАТЬ ============ */
function printOrder(id) {
  var o = allOrders.find(function(x) { return x.id === id; });
  if (!o) return;
  document.getElementById('printContent').innerHTML =
    '<h3>Заявка №' + o.id + '</h3>' +
    '<div style="margin-top:16px; line-height:1.8;">' +
      '<div><b>Дата:</b> ' + formatDate(o.datetime) + '</div>' +
      '<div><b>Клиент:</b> ' + escapeHtml(o.clientName) + '</div>' +
      '<div><b>Телефон:</b> ' + escapeHtml(o.clientPhone) + '</div>' +
      '<div><b>Адрес:</b> ' + escapeHtml(o.address) + '</div>' +
      '<div><b>Статус:</b> ' + o.status + '</div>' +
      '<hr style="margin:12px 0;">' +
      '<div><b>Общая сумма:</b> ' + formatMoney(o.totalAmount) + '</div>' +
      '<div><b>Расход:</b> ' + formatMoney(o.expense) + '</div>' +
      '<div style="font-size:18px;"><b>К сдаче:</b> ' + formatMoney(o.toGive) + '</div>' +
    '</div>' +
    '<div style="display:flex; gap:8px; margin-top:24px;" class="no-print">' +
      '<button class="btn-primary" style="flex:1;" onclick="printCurrentModal()">🖨 Печать</button>' +
      '<button class="btn-secondary" onclick="document.getElementById(\'printModal\').classList.remove(\'active\')">Закрыть</button>' +
    '</div>';
  document.getElementById('printModal').classList.add('active');
}

function printCurrentModal() {
  var content = document.getElementById('printContent').innerHTML;
  var w = window.open('', '', 'width=600,height=700');
  w.document.write('<html><head><title>Заявка</title><style>body{font-family:Arial;padding:20px;line-height:1.6;}h3{margin-bottom:16px;}</style></head><body>' + content + '</body></html>');
  w.document.close();
  w.focus();
  setTimeout(function() { w.print(); }, 300);
}

/* ============ ЭКСПОРТ ============ */
function exportCSV() {
  var orders = getFilteredOrders();
  if (orders.length === 0) { toast('Нет данных', 'error'); return; }
  var headers = ['ID','Дата','Имя','Телефон','Адрес','Статус','Сумма','Расход','К сдаче'];
  var rows = orders.map(function(o) {
    return [o.id, o.datetime, o.clientName, o.clientPhone, o.address, o.status, o.totalAmount, o.expense, o.toGive];
  });
  var csv = '\uFEFF' + [headers].concat(rows).map(function(r) {
    return r.map(function(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';');
  }).join('\n');
  downloadFile(csv, 'orders_' + Date.now() + '.csv', 'text/csv;charset=utf-8');
  toast('CSV экспортирован', 'success');
}

function exportJSON() {
  var data = JSON.stringify(allOrders, null, 2);
  downloadFile(data, 'orders_' + Date.now() + '.json', 'application/json');
  toast('JSON экспортирован', 'success');
}

function importJSON(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    try {
      var data = JSON.parse(ev.target.result);
      if (!Array.isArray(data)) throw new Error('Не массив');
      var promises = data.map(function(o) {
        return supa('/crm_orders', {
          method: 'POST',
          body: {
            client_name: o.clientName, client_phone: o.clientPhone,
            address: o.address, datetime: o.datetime, status: o.status,
            total_amount: o.totalAmount || 0, expense: o.expense || 0,
            to_give: o.toGive || 0, created_by: currentUser.login
          }
        });
      });
      Promise.all(promises).then(function() {
        toast('Импортировано ' + data.length + ' заявок', 'success');
        loadOrders();
      });
    } catch (err) { toast('Ошибка: ' + err.message, 'error'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function downloadFile(content, filename, type) {
  var blob = new Blob([content], { type: type });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
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

/* ============ СТАРТ ============ */
checkSession();
