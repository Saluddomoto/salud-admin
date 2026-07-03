// Salud Smart Board Frontend Script

let apiData = [];
let currentTab = 'dashboard';
let calendarCurrentDate = new Date();

// メンバーカラーマッピング用
const memberColors = {
  '栗原': 'bg-member-1',
  '住田': 'bg-member-2',
  '田中': 'bg-member-3',
  '佐藤': 'bg-member-4',
  '林': 'bg-member-5'
};

// 起動時の初期処理
window.addEventListener('DOMContentLoaded', () => {
  switchTab('dashboard');
  fetchData();
  
  // Lucideアイコンの初期化
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

// データの取得
async function fetchData() {
  const syncIcon = document.getElementById('sync-icon');
  if (syncIcon) syncIcon.classList.add('spin-animation');

  try {
    const response = await fetch('/api/tasks');
    if (!response.ok) throw new Error('API通信エラー');
    apiData = await response.json();
    
    // スプレッドシートデータの解析と描画
    updateDashboardStats();
    renderDashboardProgress();
    renderDashboardActions();
    renderProjects();
    renderBoardSelectOptions();
    renderBoard();
    renderCalendar();
    renderMembers();
    
  } catch (error) {
    console.error('データ取得失敗:', error);
    // テスト用のダミーデータ（スプレッドシートが未設定の場合）
    apiData = [
      {
        "対応ステータス": "商談設定",
        "問合せ日": "2026/06/01",
        "初回商談日": "2026/06/05",
        "会社名": "株式会社サンプル",
        "面談担当者": "栗原",
        "紹介元": "Aファクトリー",
        "問い合わせ内容": "新事業進出補助金相談",
        "書類作成担当者": "住田",
        "補助金種類": "新事業進出補助金",
        "備考": "初回相談",
        "次回アクション(対応メモ）": "初回商談実施",
        "総受注見込額": 1800000
      },
      {
        "対応ステータス": "成約",
        "問合せ日": "2026/05/10",
        "初回商談日": "2026/05/15",
        "会社名": "株式会社Saludパートナー",
        "面談担当者": "住田",
        "紹介元": "自社Web",
        "問い合わせ内容": "LP制作・SEOマーケティング",
        "書類作成担当者": "田中",
        "補助金種類": "IT導入補助金",
        "備考": "契約完了",
        "次回アクション(対応メモ）": "要件定義ヒアリング",
        "総受注見込額": 2500000
      }
    ];
    
    updateDashboardStats();
    renderDashboardProgress();
    renderDashboardActions();
    renderProjects();
    renderBoardSelectOptions();
    renderBoard();
    renderCalendar();
    renderMembers();
  } finally {
    if (syncIcon) {
      setTimeout(() => {
        syncIcon.classList.remove('spin-animation');
      }, 500);
    }
  }
}

// タブの切り替え
function switchTab(tabId) {
  currentTab = tabId;
  
  // すべてのコンテンツを非表示に
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  // 選択されたコンテンツを表示
  document.getElementById(`tab-${tabId}`).classList.remove('hidden');
  
  // メニューのアクティブクラス切り替え
  document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active-menu-btn'));
  document.getElementById(`btn-${tabId}`).classList.add('active-menu-btn');
  
  // タイトル更新
  const titles = {
    'dashboard': 'ダッシュボード',
    'projects': 'プロジェクト一覧',
    'board': 'カンバンボード',
    'calendar': 'カレンダー',
    'members': 'メンバー管理'
  };
  document.getElementById('page-title').innerText = titles[tabId];

  // アイコン再レンダリング
  if (window.lucide) window.lucide.createIcons();
}

// 1. ダッシュボード：数値サマリーの更新
function updateDashboardStats() {
  const projectCount = new Set(apiData.map(item => item["会社名"]).filter(Boolean)).size;
  const taskCount = apiData.filter(item => item["次回アクション(対応メモ）"]).length;
  const ongoingCount = apiData.filter(item => item["対応ステータス"] === '進行中' || item["対応ステータス"] === '商談設定').length;
  
  // 売上見込総額の集計
  const totalSales = apiData.reduce((acc, cur) => {
    const val = parseInt(cur["総受注見込額"]) || 0;
    return acc + val;
  }, 0);

  document.getElementById('stat-projects').innerText = projectCount;
  document.getElementById('stat-tasks').innerText = taskCount;
  document.getElementById('stat-ongoing').innerText = ongoingCount;
  document.getElementById('stat-sales').innerText = `¥${totalSales.toLocaleString()}`;
}

// 1. ダッシュボード：プロジェクト進捗
function renderDashboardProgress() {
  const container = document.getElementById('dashboard-progress-list');
  container.innerHTML = '';
  
  const projects = [...new Set(apiData.map(item => item["会社名"]).filter(Boolean))];
  
  if (projects.length === 0) {
    container.innerHTML = '<p class="text-sm text-slate-400">登録されたプロジェクトはありません。</p>';
    return;
  }

  projects.forEach(name => {
    // 該当企業のデータを抽出
    const items = apiData.filter(item => item["会社名"] === name);
    const completedTasks = items.filter(item => item["対応ステータス"] === '成約' || item["対応ステータス"] === '完了').length;
    const totalTasks = items.length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const row = document.createElement('div');
    row.innerHTML = `
      <div class="flex justify-between items-center text-sm font-medium">
        <span class="text-slate-700 font-bold">${name}</span>
        <span class="text-slate-500">${progress}%</span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width: ${progress}%"></div>
      </div>
    `;
    container.appendChild(row);
  });
}

// 1. ダッシュボード：直近のアクション
function renderDashboardActions() {
  const container = document.getElementById('dashboard-action-list');
  container.innerHTML = '';

  const actions = apiData.filter(item => item["次回アクション(対応メモ）"] || item["備考"]);
  
  if (actions.length === 0) {
    container.innerHTML = '<p class="text-sm text-slate-400">直近のアクションはありません。 🎉</p>';
    return;
  }

  actions.slice(0, 5).forEach(item => {
    const card = document.createElement('div');
    card.className = 'p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex gap-4 items-start';
    
    // イニシャルアイコン
    const assignee = item["面談担当者"] || '未';
    const colorClass = memberColors[assignee] || 'bg-slate-400';
    const avatar = `<span class="member-avatar ${colorClass}">${assignee.charAt(0)}</span>`;

    card.innerHTML = `
      ${avatar}
      <div class="flex-1 min-w-0">
        <div class="flex justify-between items-start">
          <h4 class="text-sm font-bold text-slate-800 truncate">${item["会社名"]}</h4>
          <span class="text-xs text-slate-400">${item["初回商談日"] || ''}</span>
        </div>
        <p class="text-xs text-slate-500 mt-1 truncate">${item["次回アクション(対応メモ）"] || item["備考"]}</p>
      </div>
    `;
    container.appendChild(card);
  });
}

// 2. プロジェクト一覧
function renderProjects() {
  const grid = document.getElementById('project-grid');
  grid.innerHTML = '';

  const projects = [...new Set(apiData.map(item => item["会社名"]).filter(Boolean))];
  document.getElementById('project-count').innerText = `${projects.length} 件のプロジェクト`;

  projects.forEach(name => {
    const items = apiData.filter(item => item["会社名"] === name);
    const completedTasks = items.filter(item => item["対応ステータス"] === '成約' || item["対応ステータス"] === '完了').length;
    const totalTasks = items.length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // 担当メンバーのリスト作成
    const assignees = [...new Set(items.map(item => item["面談担当者"]).filter(Boolean))];
    const avatars = assignees.map(name => {
      const color = memberColors[name] || 'bg-slate-400';
      return `<span class="member-avatar ${color}">${name.charAt(0)}</span>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[180px]';
    card.innerHTML = `
      <div>
        <h4 class="font-bold text-slate-800 text-base mb-1">${name}</h4>
        <p class="text-xs text-slate-400 truncate">${items[0]["補助金種類"] || 'その他案件'}</p>
        <div class="mt-4">
          <div class="flex justify-between text-xs text-slate-400 font-medium mb-1">
            <span>進捗</span>
            <span>${progress}%</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${progress}%"></div>
          </div>
        </div>
      </div>
      <div class="flex justify-between items-center mt-6 pt-4 border-t border-slate-50">
        <div class="flex -space-x-2">
          ${avatars || '<span class="text-xs text-slate-400">担当なし</span>'}
        </div>
        <span class="text-xs text-slate-500 font-medium">${totalTasks} タスク</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

// 3. ボード：プロジェクト選択ドロップダウンの構築
function renderBoardSelectOptions() {
  const select = document.getElementById('board-project-select');
  select.innerHTML = '<option value="all">すべてのプロジェクト</option>';
  
  const projects = [...new Set(apiData.map(item => item["会社名"]).filter(Boolean))];
  projects.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.innerText = name;
    select.appendChild(opt);
  });
}

// 3. ボード：カンバン表示
function renderBoard() {
  const selectVal = document.getElementById('board-project-select').value;
  const filteredData = selectVal === 'all' ? apiData : apiData.filter(item => item["会社名"] === selectVal);

  const cols = {
    'todo': document.getElementById('col-todo'),
    'ongoing': document.getElementById('col-ongoing'),
    'review': document.getElementById('col-review'),
    'done': document.getElementById('col-done')
  };

  // 一ったんすべてクリア
  Object.values(cols).forEach(col => col.innerHTML = '');

  let counts = { todo: 0, ongoing: 0, review: 0, done: 0 };

  filteredData.forEach(item => {
    // ステータスのマッピング
    let colKey = 'todo';
    const status = item["対応ステータス"];
    if (status === '進行中') colKey = 'ongoing';
    else if (status === 'レビュー') colKey = 'review';
    else if (status === '成約' || status === '完了') colKey = 'done';
    else if (status === '商談設定' || status === '問い合わせ') colKey = 'todo';

    counts[colKey]++;

    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.draggable = true;
    card.dataset.id = item["会社名"]; // 会社名をIDキーとする
    card.ondragstart = handleDragStart;

    // 担当者
    const assignee = item["面談担当者"] || '未';
    const avatarColor = memberColors[assignee] || 'bg-slate-400';

    card.innerHTML = `
      <div class="flex justify-between items-start gap-2 mb-2">
        <h5 class="font-bold text-slate-800 text-sm line-clamp-2">${item["会社名"]}</h5>
      </div>
      <p class="text-xs text-slate-500 mb-4 truncate">${item["次回アクション(対応メモ）"] || 'タスク詳細なし'}</p>
      <div class="flex justify-between items-center pt-3 border-t border-slate-50">
        <span class="px-2 py-0.5 rounded text-[10px] font-semibold tag-priority-medium">● 中</span>
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] text-slate-400 font-medium">📅 ${item["初回商談日"] ? item["初回商談日"].slice(-5) : '設定なし'}</span>
          <span class="member-avatar ${avatarColor}">${assignee.charAt(0)}</span>
        </div>
      </div>
    `;
    cols[colKey].appendChild(card);
  });

  // 件数の表示更新
  document.getElementById('count-todo').innerText = counts.todo;
  document.getElementById('count-ongoing').innerText = counts.ongoing;
  document.getElementById('count-review').innerText = counts.review;
  document.getElementById('count-done').innerText = counts.done;
}

// ドラッグ＆ドロップ処理
function handleDragStart(e) {
  e.dataTransfer.setData('text/plain', e.currentTarget.dataset.id);
}

function allowDrop(e) {
  e.preventDefault();
}

async function handleDrop(e, newStatus) {
  e.preventDefault();
  const companyName = e.dataTransfer.getData('text/plain');
  if (!companyName) return;

  // ローカルデータを即時更新（楽観的UI更新）
  const targetItem = apiData.find(item => item["会社名"] === companyName);
  if (targetItem) {
    targetItem["対応ステータス"] = newStatus;
    renderBoard();
  }

  // サーバーへ更新リクエスト
  try {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `${companyName} の対応ステータスを ${newStatus} に変更しました。`
      })
    });
    fetchData(); // データの再読み込みと整合性担保
  } catch (error) {
    console.error('ステータス変更送信失敗:', error);
  }
}

// 4. カレンダーの描画
function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  const year = calendarCurrentDate.getFullYear();
  const month = calendarCurrentDate.getMonth();

  // 月名ラベルの更新
  document.getElementById('calendar-month-label').innerText = `${year}年 ${month + 1}月`;

  // 月の最初の日と最後の日
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // カレンダー開始位置（前の月の残り）
  const startDayOfWeek = firstDay.getDay();
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  // 前の月の余りセルを描画
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell other-month';
    cell.innerHTML = `<span class="text-xs font-semibold">${prevMonthLastDay - i}</span>`;
    grid.appendChild(cell);
  }

  // 当月の日セルを描画
  const today = new Date();
  for (let date = 1; date <= lastDay.getDate(); date++) {
    const cell = document.createElement('div');
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === date;
    cell.className = `calendar-cell ${isToday ? 'today' : ''}`;
    
    let cellContent = `<span class="text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-slate-700'}">${date}</span>`;

    // 該当する日付のイベント（初回商談日など）をマッピング
    const targetDateStr = `${year}/${String(month + 1).padStart(2, '0')}/${String(date).padStart(2, '0')}`;
    const targetDateStrShort = `${year}/${month + 1}/${date}`;
    
    const events = apiData.filter(item => {
      const rawDate = item["初回商談日"] || '';
      return rawDate === targetDateStr || rawDate === targetDateStrShort;
    });

    events.forEach(ev => {
      cellContent += `<div class="calendar-event" title="${ev["会社名"]}: ${ev["次回アクション(対応メモ）"]}">${ev["会社名"]}</div>`;
    });

    cell.innerHTML = cellContent;
    grid.appendChild(cell);
  }

  // 次の月の余りセルを描画
  const totalCells = grid.children.length;
  const nextMonthCellsNeeded = 42 - totalCells; // 6週間グリッド(7*6=42)
  for (let i = 1; i <= nextMonthCellsNeeded; i++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell other-month';
    cell.innerHTML = `<span class="text-xs font-semibold">${i}</span>`;
    grid.appendChild(cell);
  }
}

function prevMonth() {
  calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
  renderCalendar();
}

function nextMonth() {
  calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
  renderCalendar();
}

function setToday() {
  calendarCurrentDate = new Date();
  renderCalendar();
}

// 5. メンバー
function renderMembers() {
  const tbody = document.getElementById('member-table-body');
  tbody.innerHTML = '';

  // スプレッドシートの「面談担当者」「書類作成担当者」のユニークリスト
  const members = [...new Set([
    ...apiData.map(item => item["面談担当者"]),
    ...apiData.map(item => item["書類作成担当er"])
  ].filter(Boolean))];

  if (members.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="py-6 px-6 text-sm text-slate-400 text-center">登録メンバーはいません。</td></tr>';
    return;
  }

  members.forEach(name => {
    const assignedProjects = new Set(apiData.filter(item => item["面談担当者"] === name || item["書類作成担当者"] === name).map(item => item["会社名"])).size;
    const activeTasks = apiData.filter(item => (item["面談担当者"] === name || item["書類作成担当者"] === name) && item["対応ステータス"] !== '成約' && item["対応ステータス"] !== '完了').length;

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/50 transition-all border-b border-slate-100 text-sm font-medium';
    
    const color = memberColors[name] || 'bg-slate-400';
    const avatar = `<span class="member-avatar ${color} mr-3">${name.charAt(0)}</span>`;

    tr.innerHTML = `
      <td class="py-4 px-6 flex items-center">
        ${avatar}
        <div>
          <p class="font-bold text-slate-800">${name}</p>
          <p class="text-xs text-slate-400">${name}@salud.co.jp</p>
        </div>
      </td>
      <td class="py-4 px-6 text-slate-500">${assignedProjects} プロジェクト</td>
      <td class="py-4 px-6">
        <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600">${activeTasks} 件 進行中</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
