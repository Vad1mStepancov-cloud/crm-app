var STORAGE = { orders: 'crm_orders', users: 'crm_users', session: 'crm_session' };
var currentUser = null;
var allOrders = [];
var sortState = { field: 'datetime', dir: 'desc' };

function hashPassword(pwd) {
  var hash = 0;
  for (var i = 0; i < pwd.length; i++) {
    hash = ((hash << 5) - hash) + pwd.charCodeAt(i);
    hash |= 0;
  }
  return 'h' + hash;
}
function getUsers() { try { return JSON.parse(localStorage.getItem(STORAGE.users) || '{}'); } catch(e) { return {}; } }
function saveUsers(u) { localStorage.setItem(STORAGE.users, JSON.stringify(u)); }

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
  var users = getUsers();
  if (users[login]) { toast('Пользователь уже существует', 'error'); return; }
  users[login] = { password: hashPassword(pass), role: role, created: Date.now() };
  saveUsers(users);
  toast('Регистрация успешна! Теперь войдите.', 'success');
  switchAuth('login');
  document.getElementById('loginUser').value = login;
}

function handleLogin(e) {
  e.preventDefault();
  var login = document.getElementById('loginUser').value.trim();
  var pass = document.getElementById('loginPass').value;
  var users = getUsers();
  if (Object.keys(users).length === 0) {
    users['admin'] = { password: hashPassword('admin'), role: 'admin', created: Date.now() };
    saveUsers(users);
  }
  var user = users[login];
  if (!user || user.password !== hashPassword(pass)) {
    toast('Неверный логин или пароль', 'error');
    return;
  }
  currentUser = { login: login, role: user.role };
  localStorage.setItem(STORAGE.session, JSON.stringify(currentUser));
  enterApp();
}

function logout() {
  if (!confirm('Выйти из системы?')) return;
  currentUser = null;
  localStorage.removeItem(STORAGE.session);
  document.getElementById('app').style.display = 'none';
  document.getElementById('authScreen').style.display = 'block';
}

function enterApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('currentUserName').textContent = currentUser.login + ' (' + currentUser.role + ')';
  loadOrders();
  render();
}

function checkSession() {
  var s = localStorage.getItem(STORAGE.session);
  if (s) {
    try { currentUser = JSON.parse(s); enterApp(); } catch(e) {}
  }
}

function loadOrders() { try { allOrders = JSON.parse(localStorage.getItem(STORAGE.orders) || '[]'); } catch(e) { allOrders = []; } }
function saveOrders() { localStorage.setItem(STORAGE.orders, JSON.stringify(allOrders)); }

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
    var parts = sort.split('-');
    var field = parts[0], dir = parts[1];
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

function render() {
  var orders = getFilteredOrders();
  var tbody = document.getElementById('ordersTable');
  var empty = document.getElementById('emptyMsg');
  tbody.innerHTML = '';
  empty.style.display = orders.length === 0 ? 'block' : 'none';
  orders.forEach(function(o) {
    var tr = document.createElement('tr');
    var statusClass = 'status status-' + o.status.toLowerCase().replace(' ', '-');
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
        '<button class="btn-edit" onclick="editOrder(' + o.id + ')" title="Редактировать">✎</button>' +
        '<button class="btn-print" onclick="printOrder(' + o.id + ')" title="Печать">🖨</button>' +
        '<button class="btn-danger" onclick="deleteOrder(' + o.id + ')" title="Удалить">✕</button>' +
      '</td>';
    tbody.appendChild(tr);
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
  var o = null;
  for (var i = 0; i < allOrders.length; i++) if (allOrders[i].id === id) { o = allOrders[i]; break; }
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
  var order = {
    id: editId ? Number(editId) : Date.now(),
    clientName: document.getElementById('clientName').value.trim(),
    clientPhone: document.getElementById('clientPhone').value.trim(),
    address: document.getElementById('address').value.trim(),
    datetime: document.getElementById('datetime').value,
    status: document.getElementById('status').value,
    totalAmount: parseFloat(document.getElementById('totalAmount').value) || 0,
    expense: parseFloat(document.getElementById('expense').value) || 0,
    toGive: parseFloat(document.getElementById('toGive').value) || 0,
    updatedAt: Date.now(),
    updatedBy: currentUser.login
  };
  if (editId) {
    allOrders = allOrders.map(function(o) { return o.id === order.id ? order : o; });
    toast('Заявка обновлена', 'success');
  } else {
    order.createdAt = Date.now();
    order.createdBy = currentUser.login;
    allOrders.push(order);
    toast('Заявка добавлена', 'success');
  }
  saveOrders();
  closeModal();
  render();
}

function deleteOrder(id) {
  if (!confirm('Удалить заявку?')) return;
  allOrders = allOrders.filter(function(o) { return o.id !== id; });
  saveOrders();
  render();
  toast('Заявка удалена', 'success');
}

function printOrder(id) {
  var o = null;
  for (var i = 0; i < allOrders.length; i++) if (allOrders[i].id === id) { o = allOrders[i]; break; }
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

function exportCSV() {
  var orders = getFilteredOrders();
  if (orders.length === 0) { toast('Нет данных для экспорта', 'error'); return; }
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
      var existing = {};
      allOrders.forEach(function(o) { existing[o.id] = true; });
      var added = 0;
      data.forEach(function(o) {
        if (!existing[o.id]) { allOrders.push(o); added++; }
      });
      saveOrders();
      render();
      toast('Импортировано ' + added + ' заявок', 'success');
    } catch (err) {
      toast('Ошибка импорта: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function downloadFile(content, filename, type) {
  var blob = new Blob([content], { type: type });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a
