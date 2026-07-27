// ==========================================
// IASLIA Admin Logic (SPA Engine)
// ==========================================

// 1. Login Handler
function handleLogin(event) {
    event.preventDefault(); 
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('admin-app').classList.remove('hidden');
}

// 2. SPA Tab Navigation
function switchTab(targetView) {
    // Hide all views completely
    const views = ['view-leads', 'view-analytics', 'view-calendar'];
    views.forEach(view => {
        document.getElementById(view).classList.add('hidden');
        document.getElementById(view).classList.remove('block');
    });

    // Show target view
    document.getElementById(`view-${targetView}`).classList.remove('hidden');
    document.getElementById(`view-${targetView}`).classList.add('block');

    // Reset Sidebar Styles (Gray/Inactive)
    const navs = ['nav-leads', 'nav-analytics', 'nav-calendar'];
    navs.forEach(nav => {
        const el = document.getElementById(nav);
        el.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-[#3a2727] hover:text-white text-[13px] font-semibold transition-colors";
        // Reset dot to gray
        el.querySelector('span').className = "w-2 h-2 rounded-full bg-[#6b7280]";
    });

    // Apply Active Style to Target
    const activeEl = document.getElementById(`nav-${targetView}`);
    activeEl.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#3a2727] text-white text-[13px] font-semibold transition-colors";
    // Set dot to gold/yellow
    activeEl.querySelector('span').className = "w-2 h-2 rounded-full bg-[#b89569]";
}

// 3. Dynamic Calendar Click Logic (Figma Testing). Click Day 10 to see Booked Leads, Click Day 23 to see an Empty/Closed day.
function showDayDetails(state) {
    document.getElementById('leads-empty-state').classList.add('hidden');
    document.getElementById('leads-day-view').classList.remove('hidden');
    
    const panelDate = document.getElementById('panel-date');
    const switchEl = document.getElementById('booking-switch');
    const timeSlots = document.getElementById('time-slots-section');
    const badge = document.getElementById('booked-count-badge');
    const list = document.getElementById('booked-leads-list');
    const noLeads = document.getElementById('no-leads-msg');

    if (state === 'booked') {
        // Render Friday, July 10 (Open, 2 Leads)
        panelDate.textContent = "Friday, July 10, 2026";
        switchEl.className = "w-12 h-6 bg-[#00875a] rounded-full relative cursor-pointer border border-[#00875a] shadow-sm";
        switchEl.innerHTML = '<div class="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>';
        
        timeSlots.classList.remove('hidden');
        badge.textContent = "2";
        badge.classList.remove('hidden');
        list.classList.remove('hidden');
        noLeads.classList.add('hidden');
    } else if (state === 'empty') {
        // Render Thursday, July 23 (Closed, 0 Leads)
        panelDate.textContent = "Thursday, July 23, 2026";
        switchEl.className = "w-12 h-6 bg-[#fbf4f2] rounded-full relative cursor-pointer border border-pru-border shadow-sm";
        switchEl.innerHTML = '<div class="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 shadow-sm border border-gray-200"></div>';
        
        timeSlots.classList.add('hidden');
        badge.textContent = "0";
        badge.classList.remove('hidden');
        list.classList.add('hidden');
        noLeads.classList.remove('hidden');
    }
}

// 4. Modal Controls
function openModal(modalId) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModals() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('add-lead-modal').classList.add('hidden');
    document.getElementById('profile-modal').classList.add('hidden');
}

// Close modals if the user clicks the dark background overlay
document.getElementById('modal-overlay').addEventListener('click', closeModals);