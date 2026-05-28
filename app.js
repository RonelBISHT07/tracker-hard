// HARD Tracker - Core Application Logic

// --- Helper Functions ---

// Formats a Date object to YYYY-MM-DD in local time
function formatDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Converts YYYY-MM-DD string to a readable date (e.g., "May 28, 2026")
function formatReadableDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

// Returns the day of the week label (e.g., "Thursday")
function getDayNameLabel(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  const todayStr = formatDateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateKey(yesterday);
  
  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

// Generate unique ID
function generateId() {
  return 'act-' + Math.random().toString(36).substr(2, 9);
}

// --- Category Config ---
const CATEGORIES = {
  health: { name: 'Health', icon: '❤️', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
  mind: { name: 'Mind', icon: '🧠', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
  fitness: { name: 'Fitness', icon: '💪', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  work: { name: 'Work', icon: '💼', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  creative: { name: 'Creative', icon: '🎨', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
  routine: { name: 'Routine', icon: '✨', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)' }
};

// --- Application State ---
let state = {
  activities: [],
  history: {}, // Format: { 'YYYY-MM-DD': ['id1', 'id2'] }
  selectedDate: formatDateKey(new Date()),
  calendarMonth: new Date() // Tracks which month is currently visible in calendar
};

// --- Default Data ---
const DEFAULT_ACTIVITIES = [
  { id: 'act-1', name: 'Drink 3L of water', category: 'health' },
  { id: 'act-2', name: 'Read 15 pages of a book', category: 'mind' },
  { id: 'act-3', name: '30-minute outdoor walk', category: 'fitness' },
  { id: 'act-4', name: 'Plan the upcoming day', category: 'routine' }
];

// --- Storage Sync ---
function loadFromStorage() {
  const storedActivities = localStorage.getItem('hard_activities_v2');
  const storedHistory = localStorage.getItem('hard_history_v2');
  
  if (storedActivities) {
    state.activities = JSON.parse(storedActivities);
  } else {
    state.activities = [...DEFAULT_ACTIVITIES];
    saveActivities();
  }
  
  if (storedHistory) {
    state.history = JSON.parse(storedHistory);
  } else {
    state.history = {};
    saveHistory();
  }
}

function saveActivities() {
  localStorage.setItem('hard_activities_v2', JSON.stringify(state.activities));
}

function saveHistory() {
  localStorage.setItem('hard_history_v2', JSON.stringify(state.history));
}

// --- Date Completion Helpers ---
function getDateCompletionRatio(dateStr) {
  if (state.activities.length === 0) return 0;
  const completedIds = state.history[dateStr] || [];
  
  // Filter completed IDs to only count current activities (prevents old deleted activities from skewing)
  const validCompletions = completedIds.filter(id => 
    state.activities.some(act => act.id === id)
  );
  
  return validCompletions.length / state.activities.length;
}

function isDateComplete(dateStr) {
  if (state.activities.length === 0) return false;
  const ratio = getDateCompletionRatio(dateStr);
  return ratio === 1; // 100% complete
}

// --- Streak Calculations ---
function calculateStreaks() {
  const todayStr = formatDateKey(new Date());
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateKey(yesterday);
  
  let currentStreak = 0;
  
  const isTodayDone = isDateComplete(todayStr);
  const isYesterdayDone = isDateComplete(yesterdayStr);
  
  if (isTodayDone || isYesterdayDone) {
    let checkDate = new Date();
    // If today is not done but yesterday was, we start counting back from yesterday.
    // That means the streak is still alive today (user still has time to complete it).
    if (!isTodayDone) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    while (true) {
      const checkDateStr = formatDateKey(checkDate);
      if (isDateComplete(checkDateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }
  
  // Calculate Best/Longest Streak of all time
  let longestStreak = 0;
  const completedDates = Object.keys(state.history).filter(dStr => isDateComplete(dStr));
  
  if (completedDates.length > 0) {
    // Sort dates chronologically
    completedDates.sort((a, b) => new Date(a) - new Date(b));
    
    let currentRun = 1;
    let tempLongest = 1;
    
    for (let i = 1; i < completedDates.length; i++) {
      const d1 = new Date(completedDates[i - 1]);
      const d2 = new Date(completedDates[i]);
      
      const diffTime = Math.abs(d2 - d1);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        currentRun++;
      } else if (diffDays > 1) {
        tempLongest = Math.max(tempLongest, currentRun);
        currentRun = 1;
      }
    }
    longestStreak = Math.max(tempLongest, currentRun);
  }
  
  // Total completions count (sum of all activities checked across all history)
  let totalCompletions = 0;
  Object.keys(state.history).forEach(dStr => {
    // Only count completions for activities that currently exist
    const completedIds = state.history[dStr] || [];
    const validCount = completedIds.filter(id => 
      state.activities.some(act => act.id === id)
    ).length;
    totalCompletions += validCount;
  });
  
  return {
    currentStreak,
    longestStreak,
    totalCompletions
  };
}

// --- DOM Rendering ---

// 1. Render App Header Date
function renderHeaderDate() {
  const headerDateEl = document.getElementById('current-date-display');
  if (headerDateEl) {
    headerDateEl.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }
}

// 2. Render Streak Stats & Recent Streak Status Bar
function renderStreaks() {
  const stats = calculateStreaks();
  
  document.getElementById('current-streak-val').textContent = `${stats.currentStreak} day${stats.currentStreak === 1 ? '' : 's'}`;
  document.getElementById('stat-current-streak').textContent = stats.currentStreak;
  document.getElementById('stat-best-streak').textContent = stats.longestStreak;
  document.getElementById('stat-total-completions').textContent = stats.totalCompletions;
  
  // Render Last 7 Days Mini Dots
  const streakGridEl = document.getElementById('streak-recent-days');
  if (!streakGridEl) return;
  
  streakGridEl.innerHTML = '';
  const today = new Date();
  
  // Generate list of last 7 days (ending today)
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    last7Days.push(d);
  }
  
  last7Days.forEach(date => {
    const dateStr = formatDateKey(date);
    const ratio = getDateCompletionRatio(dateStr);
    
    const dotEl = document.createElement('div');
    dotEl.className = 'streak-day-dot';
    
    // Add custom tags for today and completions
    const todayStr = formatDateKey(today);
    if (dateStr === todayStr) {
      dotEl.classList.add('today');
    }
    
    if (ratio === 1) {
      dotEl.classList.add('completed');
    } else if (ratio > 0) {
      dotEl.classList.add('skipped'); // Display as partial/in-progress
      dotEl.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      dotEl.style.color = '#10b981';
      dotEl.style.background = 'rgba(16, 185, 129, 0.05)';
    }
    
    // Display letter of the day (M, T, W...) and day number
    const dayLetter = date.toLocaleDateString('en-US', { weekday: 'narrow' });
    const dayNum = date.getDate();
    
    dotEl.innerHTML = `${dayLetter}<span>${dayNum}</span>`;
    streakGridEl.appendChild(dotEl);
  });
}

// 3. Render Calendar Grid
function renderCalendar() {
  const monthYearEl = document.getElementById('calendar-month-year');
  const daysGridEl = document.getElementById('calendar-days-grid');
  
  if (!monthYearEl || !daysGridEl) return;
  
  const year = state.calendarMonth.getFullYear();
  const month = state.calendarMonth.getMonth();
  
  // Display Current Month & Year in Header
  monthYearEl.textContent = state.calendarMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });
  
  daysGridEl.innerHTML = '';
  
  // Get index of the first day of the month (0 = Sun, 1 = Mon ... 6 = Sat)
  const firstDayVal = new Date(year, month, 1).getDay();
  // Adjust so week starts on Monday
  // If firstDayVal is 0 (Sunday), startOffset is 6.
  // If firstDayVal is 1 (Monday), startOffset is 0.
  const startOffset = firstDayVal === 0 ? 6 : firstDayVal - 1;
  
  // Total days in current month
  const totalDays = new Date(year, month + 1, 0).getDate();
  
  // Add empty cells for the offset
  for (let i = 0; i < startOffset; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day-cell empty-cell';
    daysGridEl.appendChild(emptyCell);
  }
  
  const todayStr = formatDateKey(new Date());
  
  // Add actual day cells
  for (let day = 1; day <= totalDays; day++) {
    const currentCellDate = new Date(year, month, day);
    const dateStr = formatDateKey(currentCellDate);
    const ratio = getDateCompletionRatio(dateStr);
    
    const cellEl = document.createElement('div');
    cellEl.className = 'calendar-day-cell in-month';
    cellEl.textContent = day;
    
    // Add special states
    if (dateStr === todayStr) {
      cellEl.classList.add('today-cell');
    }
    
    if (dateStr === state.selectedDate) {
      cellEl.classList.add('selected');
    }
    
    // Completion dots & borders
    if (ratio === 1) {
      cellEl.classList.add('status-full');
    } else if (ratio > 0) {
      cellEl.classList.add('status-partial');
    }
    
    // Tiny dot helper inside day cell
    if (ratio > 0) {
      const dot = document.createElement('div');
      dot.className = 'day-progress-dot';
      cellEl.appendChild(dot);
    }
    
    // Click Handler: Select Date
    cellEl.addEventListener('click', () => {
      state.selectedDate = dateStr;
      renderCalendar(); // Re-render to update selected styling
      renderChecklist();
    });
    
    daysGridEl.appendChild(cellEl);
  }
}

// 4. Render Daily Checklist
function renderChecklist() {
  const labelEl = document.getElementById('selected-day-label');
  const titleEl = document.getElementById('selected-date-title');
  const emptyStateEl = document.getElementById('checklist-empty-state');
  const itemsContainerEl = document.getElementById('checklist-items-container');
  const completionTextEl = document.getElementById('completion-text');
  const percentageEl = document.getElementById('completion-percentage');
  const progressBarEl = document.getElementById('checklist-progress-bar');
  
  if (!titleEl || !itemsContainerEl) return;
  
  // Update selected date header displays
  labelEl.textContent = getDayNameLabel(state.selectedDate);
  titleEl.textContent = formatReadableDate(state.selectedDate);
  
  // Clear container
  itemsContainerEl.innerHTML = '';
  
  const completedIds = state.history[state.selectedDate] || [];
  
  if (state.activities.length === 0) {
    emptyStateEl.style.display = 'flex';
    itemsContainerEl.style.display = 'none';
    
    // Reset progress details
    completionTextEl.textContent = '0 of 0 completed';
    percentageEl.textContent = '0%';
    progressBarEl.style.width = '0%';
    return;
  }
  
  emptyStateEl.style.display = 'none';
  itemsContainerEl.style.display = 'flex';
  
  let completedCount = 0;
  
  // Sort activities by name or category for consistency
  const sortedActivities = [...state.activities].sort((a, b) => a.name.localeCompare(b.name));
  
  sortedActivities.forEach(activity => {
    const isCompleted = completedIds.includes(activity.id);
    if (isCompleted) completedCount++;
    
    const catInfo = CATEGORIES[activity.category] || CATEGORIES.routine;
    
    const itemEl = document.createElement('div');
    itemEl.className = `activity-item ${isCompleted ? 'completed-item' : ''}`;
    
    itemEl.innerHTML = `
      <label class="activity-item-left">
        <div class="checkbox-wrapper">
          <input type="checkbox" ${isCompleted ? 'checked' : ''} data-id="${activity.id}" />
          <span class="custom-checkbox">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
        </div>
        <div class="activity-details">
          <span class="activity-title">${escapeHtml(activity.name)}</span>
          <span class="activity-cat-tag" style="--cat-color: ${catInfo.color}; --cat-bg: ${catInfo.bg}">
            <span class="cat-icon">${catInfo.icon}</span> ${catInfo.name}
          </span>
        </div>
      </label>
      <div class="activity-actions">
        <button class="action-btn edit-btn" data-id="${activity.id}" aria-label="Edit activity">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="action-btn delete-btn" data-id="${activity.id}" aria-label="Delete activity">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    `;
    
    // Listen for state changes on the checkbox
    const checkbox = itemEl.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
      toggleActivityCompletion(activity.id, checkbox.checked);
    });

    
    // Edit Action Handler
    itemEl.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(activity.id);
    });
    
    // Delete Action Handler
    itemEl.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteActivity(activity.id);
    });
    
    itemsContainerEl.appendChild(itemEl);
  });
  
  // Update metrics UI
  const total = state.activities.length;
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  
  completionTextEl.textContent = `${completedCount} of ${total} completed`;
  percentageEl.textContent = `${percent}%`;
  progressBarEl.style.width = `${percent}%`;
}

// HTML Escaper for security/rendering
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// --- Controller Actions ---

// Toggle Checkbox state per date
function toggleActivityCompletion(activityId, isChecked) {
  if (!state.history[state.selectedDate]) {
    state.history[state.selectedDate] = [];
  }
  
  const completedList = state.history[state.selectedDate];
  
  if (isChecked) {
    if (!completedList.includes(activityId)) {
      completedList.push(activityId);
    }
  } else {
    state.history[state.selectedDate] = completedList.filter(id => id !== activityId);
    if (state.history[state.selectedDate].length === 0) {
      delete state.history[state.selectedDate]; // cleanup empty arrays
    }
  }
  
  saveHistory();
  renderChecklist();
  renderCalendar();
  renderStreaks();
}

// Delete Activity completely
function deleteActivity(activityId) {
  if (confirm('Are you sure you want to delete this activity? This will remove it from your current list and historical streaks.')) {
    // Remove from activities list
    state.activities = state.activities.filter(act => act.id !== activityId);
    saveActivities();
    
    // Cleanup completion logs
    Object.keys(state.history).forEach(dateStr => {
      state.history[dateStr] = state.history[dateStr].filter(id => id !== activityId);
      if (state.history[dateStr].length === 0) {
        delete state.history[dateStr];
      }
    });
    saveHistory();
    
    // Refresh views
    renderChecklist();
    renderCalendar();
    renderStreaks();
  }
}

// --- Modal Controller ---
const modalOverlay = document.getElementById('activity-modal');
const modalTitle = document.getElementById('modal-title');
const activityForm = document.getElementById('activity-form');
const editIdInput = document.getElementById('edit-activity-id');
const nameInput = document.getElementById('activity-name');

function openModal(editId = null) {
  modalOverlay.classList.add('active');
  nameInput.focus();
  
  if (editId) {
    modalTitle.textContent = 'Edit Activity';
    const activity = state.activities.find(act => act.id === editId);
    if (activity) {
      editIdInput.value = activity.id;
      nameInput.value = activity.name;
      
      // Select appropriate radio category
      const radio = activityForm.querySelector(`input[name="category"][value="${activity.category}"]`);
      if (radio) radio.checked = true;
    }
  } else {
    modalTitle.textContent = 'New Activity';
    editIdInput.value = '';
    activityForm.reset();
    
    // Select first option
    activityForm.querySelector('input[name="category"][value="health"]').checked = true;
  }
}

function closeModal() {
  modalOverlay.classList.remove('active');
}

// Submit activity form (New or Edit)
activityForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const name = nameInput.value.trim();
  const category = activityForm.querySelector('input[name="category"]:checked').value;
  const editId = editIdInput.value;
  
  if (!name) return;
  
  if (editId) {
    // Editing existing activity
    const activity = state.activities.find(act => act.id === editId);
    if (activity) {
      activity.name = name;
      activity.category = category;
    }
  } else {
    // Creating new activity
    const newAct = {
      id: generateId(),
      name: name,
      category: category
    };
    state.activities.push(newAct);
  }
  
  saveActivities();
  closeModal();
  
  // Refresh views
  renderChecklist();
  renderCalendar();
  renderStreaks();
});

// --- Theme Handling ---
function initTheme() {
  const storedTheme = localStorage.getItem('hard_theme') || 'dark';
  applyTheme(storedTheme);
  
  document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
  });
}

function applyTheme(theme) {
  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');
  
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
  } else {
    document.body.classList.remove('light-theme');
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
  }
  localStorage.setItem('hard_theme', theme);
}

// --- Initialize Event Listeners ---
function initApp() {
  // Setup theme
  initTheme();
  
  // Load data
  loadFromStorage();
  
  // Set up header and dynamic calculations
  renderHeaderDate();
  renderStreaks();
  renderCalendar();
  renderChecklist();
  
  // Add activity buttons
  document.getElementById('open-add-modal-btn').addEventListener('click', () => openModal());
  document.getElementById('empty-state-add-btn').addEventListener('click', () => openModal());
  
  // Modal navigation
  document.getElementById('close-modal-btn').addEventListener('click', closeModal);
  document.getElementById('cancel-modal-btn').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  
  // Calendar month switching
  document.getElementById('prev-month-btn').addEventListener('click', () => {
    state.calendarMonth.setMonth(state.calendarMonth.getMonth() - 1);
    renderCalendar();
  });
  
  document.getElementById('next-month-btn').addEventListener('click', () => {
    state.calendarMonth.setMonth(state.calendarMonth.getMonth() + 1);
    renderCalendar();
  });
  
  // Listen for keyboard ESC key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      closeModal();
    }
  });
}

// Boot up app
document.addEventListener('DOMContentLoaded', initApp);
