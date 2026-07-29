// ==========================================
// 1. SUPABASE INITIALIZATION
// ==========================================
const SUPABASE_URL = 'https://refufwvilgtgqpcnejhs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlZnVmd3ZpbGd0Z3FwY25lamhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4Nzk4MTMsImV4cCI6MjEwMDQ1NTgxM30.lPL_AWB1uMHS8Bac7jNtuPJJD7FUDpPNiuP0J7v6DII';

let supabase;
if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.warn("Supabase script not loaded. Real data will not fetch.");
}

document.addEventListener('DOMContentLoaded', () => {
    // Load leads if supabase is active
    if (window.supabase) {
        loadAdminLeads();
    }
    
    // Safely boot up the new calendar engine
    if (typeof renderAdminCalendar === 'function') {
        renderAdminCalendar();
        setupCalendarArrows();
        initBookingSwitch();
    }
});

// ==========================================
// 2. SPA ENGINE & UI LOGIC
// ==========================================

// Login Handler
function handleLogin(event) {
    event.preventDefault(); 
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('admin-app').classList.remove('hidden');
}

// SPA Tab Navigation
function switchTab(targetView) {
    // Hide all views completely
    const views = ['view-leads', 'view-analytics', 'view-calendar', 'view-email-templates', 'view-settings'];
    views.forEach(view => {
        const el = document.getElementById(view);
        if(el) {
            el.classList.add('hidden');
            el.classList.remove('block');
        }
    });

    // Show target view
    const targetEl = document.getElementById(`view-${targetView}`);
    if(targetEl) {
        targetEl.classList.remove('hidden');
        targetEl.classList.add('block');
    }

    // Reset Sidebar Styles (Gray/Inactive)
    const navs = ['nav-leads', 'nav-analytics', 'nav-calendar', 'nav-email-templates', 'nav-settings'];
    navs.forEach(nav => {
        const el = document.getElementById(nav);
        if(el) {
            el.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-[#3a2727] hover:text-white text-[13px] font-semibold transition-colors";
            el.querySelector('span').className = "w-2 h-2 rounded-full bg-[#6b7280]";
        }
    });

    // Apply Active Style to Target
    const activeEl = document.getElementById(`nav-${targetView}`);
    if(activeEl) {
        activeEl.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#3a2727] text-white text-[13px] font-semibold transition-colors";
        activeEl.querySelector('span').className = "w-2 h-2 rounded-full bg-[#b89569]";
    }
}

// Dynamic Calendar Logic
function showDayDetails(state, dayNum = null) {
    document.getElementById('leads-empty-state').classList.add('hidden');
    document.getElementById('leads-day-view').classList.remove('hidden');
    
    const panelDate = document.getElementById('panel-date');
    const switchEl = document.getElementById('booking-switch');
    const timeSlots = document.getElementById('time-slots-section');
    const badge = document.getElementById('booked-count-badge');
    const list = document.getElementById('booked-leads-list');
    const noLeads = document.getElementById('no-leads-msg');

    // Dynamically set the date text if a day is clicked
    if (dayNum) {
        panelDate.textContent = `July ${dayNum}, 2026`;
    }

    if (state === 'booked') {
        if (!dayNum) panelDate.textContent = "Friday, July 10, 2026";
        switchEl.className = "w-12 h-6 bg-[#00875a] rounded-full relative cursor-pointer border border-[#00875a] shadow-sm";
        switchEl.innerHTML = '<div class="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>';
        
        timeSlots.classList.remove('hidden');
        badge.textContent = "2";
        badge.classList.remove('hidden');
        list.classList.remove('hidden');
        noLeads.classList.add('hidden');
    } else if (state === 'empty') {
        if (!dayNum) panelDate.textContent = "Thursday, July 23, 2026";
        switchEl.className = "w-12 h-6 bg-[#fbf4f2] rounded-full relative cursor-pointer border border-gray-200 shadow-sm";
        switchEl.innerHTML = '<div class="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 shadow-sm border border-gray-200"></div>';
        
        timeSlots.classList.add('hidden');
        badge.textContent = "0";
        badge.classList.remove('hidden');
        list.classList.add('hidden');
        noLeads.classList.remove('hidden');
    }
}

// Modal Controls
function openModal(modalId) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    const modalEl = document.getElementById(modalId);
    if(modalEl) modalEl.classList.remove('hidden');
}

function closeModals() {
    document.getElementById('modal-overlay').classList.add('hidden');
    const modals = [
        'add-lead-modal', 'profile-modal', 'edit-template-modal', 
        'delete-template-modal', 'reset-data-modal'
    ];
    modals.forEach(modal => {
        const el = document.getElementById(modal);
        if(el) el.classList.add('hidden');
    });
}
document.getElementById('modal-overlay')?.addEventListener('click', closeModals);

// Sub-Tab Filter (All / Agents / Clients)
function filterLeads(category) {
    const filters = ['all', 'agent', 'client'];
    filters.forEach(type => {
        const btn = document.getElementById(`filter-${type}`);
        if (btn) btn.className = "px-5 py-1.5 text-[12px] font-bold text-gray-600 rounded-full hover:bg-white transition-colors";
    });

    const activeBtn = document.getElementById(`filter-${category}`);
    if (activeBtn) activeBtn.className = "px-5 py-1.5 text-[12px] font-bold text-white bg-[#bd1512] rounded-full shadow-sm";

    const rows = document.querySelectorAll('.lead-row');
    rows.forEach(row => {
        const rowType = row.getAttribute('data-type');
        if (category === 'all' || rowType === category) row.classList.remove('hidden');
        else row.classList.add('hidden');
    });
}

// ==========================================
// 3. DATABASE FETCH & RENDER
// ==========================================

async function loadAdminLeads() {
    const tableBody = document.querySelector('tbody');
    if (!tableBody) return;

    try {
        // Fetch leads from your Supabase database
        const { data: leads, error } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Clear out the hardcoded HTML rows (Angeline, Ramon, Michelle)
        tableBody.innerHTML = '';

        if (leads.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-[13px] text-gray-500 font-medium">No leads found in database.</td></tr>';
            return;
        }

        // Generate dynamic rows based on exact Figma HTML
        leads.forEach(lead => {
            const tr = document.createElement('tr');
            
            const isAgent = lead.track === "future_advisor";
            const dataType = isAgent ? 'agent' : 'client';
            const typeLabel = isAgent ? 'Agent' : 'Client';
            
            // Set Row attributes for the Filter function
            tr.className = "lead-row hover:bg-gray-50 transition-colors";
            tr.setAttribute('data-type', dataType);
            
            // Format Date (e.g. 2026-07-11)
            const dateObj = new Date(lead.created_at);
            const dateStr = dateObj.toISOString().split('T')[0];

            // Generate Initials for Avatar
            const fullName = lead.full_name || 'Unknown User';
            const names = fullName.split(' ');
            const initials = names.length > 1 ? (names[0][0] + names[names.length - 1][0]).toUpperCase() : fullName.substring(0, 2).toUpperCase();

            // Mobile logic fallback
            const mobile = lead.mobile_number || 'No number';
            const source = lead.source || `Funnel, ${isAgent ? 'Career Preview' : 'Financial Conversation'}`;

            // Determine Milestone colors (Demo logic: everyone gets standard UI for now)
            const mBadge = isAgent 
                ? `<div class="w-6 h-6 rounded-full border border-pru-red text-[9px] font-bold flex items-center justify-center text-white bg-[#bd1512]">M</div>`
                : `<div class="w-6 h-6 rounded-full border border-pru-border text-[9px] font-bold flex items-center justify-center text-gray-400 bg-[#fbf4f2]">M</div>`;
            
            const cBadge = `<div class="w-6 h-6 rounded-full border border-pru-border text-[9px] font-bold flex items-center justify-center text-gray-400 bg-[#fbf4f2]">C</div>`;

            // Inject Your EXACT Figma HTML
            tr.innerHTML = `
                <td class="px-6 py-4 flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-[#fce8e8] text-pru-red font-bold flex items-center justify-center text-sm border border-pru-border">${initials}</div>
                    <div>
                        <p class="font-bold text-gray-900">${fullName}</p>
                        <p class="text-[11px] text-gray-400 mt-0.5">Added ${dateStr}</p>
                    </div>
                </td>
                <td class="px-6 py-4"><span class="px-3 py-1 bg-[#f3e9e8] text-gray-700 text-[11px] font-bold rounded-full border border-pru-border">${typeLabel}</span></td>
                <td class="px-6 py-4">
                    <p class="font-semibold text-gray-900">${lead.email}</p>
                    <p class="text-gray-500 text-[12px] mt-0.5">${mobile}</p>
                </td>
                <td class="px-6 py-4 text-gray-500">${source}</td>
                <td class="px-6 py-4 flex gap-1 items-center h-full mt-2">
                    ${mBadge}
                    ${cBadge}
                </td>
                <td class="px-6 py-4 text-right">
                    <button onclick="viewLeadDetails('${lead.lead_id}')" class="w-8 h-8 border border-pru-border rounded-full inline-flex items-center justify-center text-gray-400 hover:text-pru-red transition-colors shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                    </button>
                    <button class="w-8 h-8 border border-pru-border rounded-full inline-flex items-center justify-center text-gray-400 hover:text-pru-red transition-colors shadow-sm ml-1">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

    } catch (err) {
        console.error("Failed to load leads:", err.message);
    }
}

// ==========================================
// 4. DYNAMIC MODAL INJECTION (LEAD DETAILS)
// ==========================================

window.viewLeadDetails = async function(leadId) {
    // 1. Open the modal shell
    openModal('profile-modal');
    const contentDiv = document.getElementById('modal-dynamic-content');
    if (!contentDiv) return;
    
    // 2. Show a loading state matching your Figma colors
    contentDiv.innerHTML = '<div class="p-12 flex justify-center text-[#b89569] text-sm font-bold tracking-widest uppercase animate-pulse">Fetching Profile...</div>';

    try {
        // 3. Fetch Core Lead Data from Supabase
        const { data: lead, error: leadError } = await supabase
            .from('leads')
            .select('*')
            .eq('lead_id', leadId)
            .single();
            
        if (leadError) throw leadError;

        // 4. Determine if Agent or Client, then fetch the specific profile
            const isAgent = lead.track === "future_advisor";
            let profile = null;

            if (isAgent) {
                const { data, error } = await supabase
                    .from("recruit_profile")
                    .select("*")
                    .eq("lead_id", leadId)
                    .single();

                if (error) console.error(error);
                profile = data;
            } else {
                const { data, error } = await supabase
                    .from("client_profile")
                    .select("*")
                    .eq("lead_id", leadId)
                    .single();

                if (error) console.error(error);
                profile = data;
            }

        // 5. Data Formatting (Initials, Dates, Age)
        const fullName = lead.full_name || 'Unknown User';
        const names = fullName.split(' ');
        const initials = names.length > 1 ? (names[0][0] + names[names.length - 1][0]).toUpperCase() : fullName.substring(0, 2).toUpperCase();
        const avatarBg = isAgent ? 'bg-[#bd1512]' : 'bg-blue-600';

        let age = '';
        let dobStr = '';
        if (lead.date_of_birth) {
            const dob = new Date(lead.date_of_birth);
            const ageDiff = new Date(Date.now() - dob.getTime());
            age = Math.abs(ageDiff.getUTCFullYear() - 1970);
            dobStr = dob.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }
        
        const addedDate = new Date(lead.created_at).toISOString().split('T')[0];

        // Safe helpers so empty data doesn't break the UI
        const safeVal = (val) => val ? `<p class="text-[13px] text-gray-500 font-medium">${val}</p>` : `<p class="text-[13px] text-gray-400 italic">Not Recorded</p>`;
        const safeProfile = (key) => (profile && profile[key]) ? `<p class="text-[13px] text-gray-500 font-medium">${profile[key]}</p>` : `<p class="text-[13px] text-gray-400 italic">Not Recorded</p>`;

        // 6. Build the specific middle section depending on track
        let specificSectionHTML = '';
        if (isAgent) {
            specificSectionHTML = `
                <h3 class="text-[11px] font-bold text-[#b89569] uppercase tracking-widest mb-4">Education & Work</h3>
                <div class="grid grid-cols-2 gap-y-6 gap-x-12 mb-8">
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">University/College (Graduated Form)</p>${safeProfile('university_college')}</div>
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Degree</p>${safeProfile('degree')}</div>
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Area of Business or Employment</p>${safeProfile('area_of_employment')}</div>
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Work Experience</p>${safeProfile('work_experience')}</div>
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Number of Years Working</p>${safeProfile('years_working')}</div>
                </div>
                
                <h3 class="text-[11px] font-bold text-[#b89569] uppercase tracking-widest mb-4">Recruitment</h3>
                <div class="grid grid-cols-2 gap-y-6 gap-x-12">
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Name of Recruiter</p><p class="text-[13px] text-gray-400 italic">Unassigned</p></div>
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Immediate Manager</p><p class="text-[13px] text-gray-400 italic">Unassigned</p></div>
                </div>
            `;
        } else {
            const budgetFormat = profile?.monthly_budget ? `₱${Number(profile.monthly_budget).toLocaleString()}` : null;
            const insuranceFormat = profile?.has_life_insurance === true ? 'Yes' : (profile?.has_life_insurance === false ? 'No' : null);
            
            specificSectionHTML = `
                <h3 class="text-[11px] font-bold text-[#b89569] uppercase tracking-widest mb-4">Financial & Lifestyle</h3>
                <div class="grid grid-cols-2 gap-y-6 gap-x-12 mb-8">
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Current Employment</p>${safeProfile('current_employment')}</div>
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Marital Status</p>${safeProfile('marital_status')}</div>
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Dependents</p>${safeProfile('no_of_dependents')}</div>
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Has Life Insurance</p>${safeVal(insuranceFormat)}</div>
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Monthly Budget</p>${safeVal(budgetFormat)}</div>
                </div>
            `;
        }

        // 7. Inject the FULL UI directly into the modal container
        contentDiv.innerHTML = `
            <div class="p-6 pb-4 bg-[#fbf4f2] border-b border-pru-border relative shrink-0">
                <button onclick="closeModals()" class="absolute top-6 right-6 text-gray-400 hover:text-gray-600 focus:outline-none">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-12 h-12 rounded-full ${avatarBg} text-white font-bold flex items-center justify-center text-lg shadow-sm">${initials}</div>
                    <div>
                        <h2 class="text-xl font-serif font-bold text-gray-900 leading-tight">${fullName}</h2>
                        <p class="text-[11px] font-bold text-gray-600 mt-1">${lead.track || 'Lead'} Added ${addedDate}</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <div class="flex-1 bg-white border border-pru-border rounded-full py-1.5 px-3 flex items-center gap-2 shadow-sm">
                        <div class="w-3 h-3 rounded-full border border-gray-300"></div><span class="text-[10px] font-bold text-gray-700">Meeting Done</span>
                    </div>
                    <div class="flex-1 bg-white border border-pru-border rounded-full py-1.5 px-3 flex items-center gap-2 shadow-sm">
                        <div class="w-3 h-3 rounded-full border border-gray-300"></div><span class="text-[10px] font-bold text-gray-700">PRU LIFE UK Email Created</span>
                    </div>
                    <div class="flex-1 bg-white border border-pru-border rounded-full py-1.5 px-3 flex items-center gap-2 opacity-50 shadow-sm">
                        <div class="w-3 h-3 rounded-full border border-gray-300"></div><span class="text-[10px] font-bold text-gray-700">Officially Converted</span>
                    </div>
                </div>
            </div>

            <div class="flex px-6 border-b border-pru-border bg-white pt-2 shrink-0">
                <button class="px-4 py-2 border-b-2 border-pru-red text-pru-red text-[13px] font-bold">Profile</button>
                <button class="px-4 py-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700 text-[13px] font-bold transition-colors">Email</button>
            </div>

            <div class="p-8 overflow-y-auto flex-grow bg-white">
                <h3 class="text-[11px] font-bold text-[#b89569] uppercase tracking-widest mb-4">Contact</h3>
                <div class="grid grid-cols-2 gap-y-6 gap-x-12 mb-8">
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Full Name</p>${safeVal(fullName)}</div>
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Email Address</p>${safeVal(lead.email)}</div>
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Mobile Number</p>${safeVal(lead.mobile_number)}</div>
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Source</p>${safeVal(lead.source)}</div>
                </div>

                <h3 class="text-[11px] font-bold text-[#b89569] uppercase tracking-widest mb-4">Basic Info</h3>
                <div class="grid grid-cols-2 gap-y-6 gap-x-12 mb-8">
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Date of Birth</p>${safeVal(dobStr)}</div>
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Age</p>${safeVal(age)}</div>
                    <div><p class="text-[12px] font-bold text-gray-900 mb-1">Area of Residence</p>${safeProfile('area_of_residence')}</div>
                </div>

                ${specificSectionHTML}
            </div>

            <div class="p-4 border-t border-pru-border flex justify-between items-center bg-white shrink-0">
                <button class="px-5 py-2 text-[13px] font-bold text-pru-red border border-pru-border rounded-full hover:bg-red-50 transition-colors shadow-sm">Delete Lead</button>
                <div class="flex gap-3">
                    <button onclick="closeModals()" class="px-5 py-2 text-[13px] font-bold text-pru-red border border-pru-border rounded-full hover:bg-[#fbf4f2] transition-colors shadow-sm">Close</button>
                    <button class="px-5 py-2 text-[13px] font-bold text-white bg-[#bd1512] rounded-full hover:bg-red-900 transition-colors shadow-sm">Edit Profile</button>
                </div>
            </div>
        `;

    } catch (err) {
        console.error("Error fetching lead profile:", err.message);
        contentDiv.innerHTML = `<div class="p-12 flex justify-center text-red-500 text-sm font-semibold">Error loading database profile. Check Console.</div>`;
    }
};

// ==========================================
// --- ADMIN CALENDAR ENGINE ---
// ==========================================

// Global state to track which calendar we are viewing in admin
let currentAdminTrack = 'future_advisor'; // Defaults to agent to match your UI

function switchAdminTrack(track) {
    currentAdminTrack = track;
    
    const clientBtn = document.getElementById('admin-track-client');
    const agentBtn = document.getElementById('admin-track-agent');
    
    // Swap the Pill UI styles
    if (track === 'future_client') {
        clientBtn.className = "px-5 py-2 text-[13px] font-bold text-white bg-[#bd1512] rounded-full shadow-sm transition-colors focus:outline-none";
        agentBtn.className = "px-5 py-2 text-[13px] font-bold text-gray-600 rounded-full hover:bg-gray-50 transition-colors focus:outline-none";
    } else {
        agentBtn.className = "px-5 py-2 text-[13px] font-bold text-white bg-[#bd1512] rounded-full shadow-sm transition-colors focus:outline-none";
        clientBtn.className = "px-5 py-2 text-[13px] font-bold text-gray-600 rounded-full hover:bg-gray-50 transition-colors focus:outline-none";
    }
    
    // Refresh the calendar UI to show data for the selected track
    if (typeof renderAdminCalendar === 'function') {
        renderAdminCalendar();
    }
}

let adminNavDate = new Date(2026, 6, 1); // Starts at July 2026
let selectedDayEl = null;

// 1. Arrow Navigation
function setupCalendarArrows() {
    const prevBtn = document.getElementById('admin-prev-month');
    const nextBtn = document.getElementById('admin-next-month');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevents page reload
            adminNavDate.setMonth(adminNavDate.getMonth() - 1);
            renderAdminCalendar();
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevents page reload
            adminNavDate.setMonth(adminNavDate.getMonth() + 1);
            renderAdminCalendar();
        });
    }
}

// 2. Dynamic Details Panel
window.showDayDetails = function(state, dayNum = null, monthStr = "July", yearStr = "2026") {
    const emptyState = document.getElementById('leads-empty-state');
    const dayView = document.getElementById('leads-day-view');
    if(emptyState) emptyState.classList.add('hidden');
    if(dayView) dayView.classList.remove('hidden');
    
    const panelDate = document.getElementById('panel-date');
    const switchEl = document.getElementById('booking-switch');
    const timeSlots = document.getElementById('time-slots-section');
    const badge = document.getElementById('booked-count-badge');
    const list = document.getElementById('booked-leads-list');
    const noLeads = document.getElementById('no-leads-msg');

    if (dayNum && panelDate) {
        const fullDate = new Date(`${monthStr} ${dayNum}, ${yearStr}`);
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayOfWeek = days[fullDate.getDay()];
        panelDate.textContent = `${dayOfWeek}, ${monthStr} ${dayNum}, ${yearStr}`;
    }

    if (state === 'booked' && switchEl) {
        switchEl.className = "w-12 h-6 bg-[#00875a] rounded-full relative cursor-pointer border border-[#00875a] shadow-sm";
        switchEl.innerHTML = '<div class="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>';
        if(timeSlots) timeSlots.classList.remove('hidden');
        if(badge) { badge.textContent = "2"; badge.classList.remove('hidden'); }
        if(list) list.classList.remove('hidden');
        if(noLeads) noLeads.classList.add('hidden');
    } else if (state === 'empty' && switchEl) {
        switchEl.className = "w-12 h-6 bg-[#fbf4f2] rounded-full relative cursor-pointer border border-gray-200 shadow-sm";
        switchEl.innerHTML = '<div class="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 shadow-sm border border-gray-200"></div>';
        if(timeSlots) timeSlots.classList.add('hidden');
        if(badge) { badge.textContent = "0"; badge.classList.remove('hidden'); }
        if(list) list.classList.add('hidden');
        if(noLeads) noLeads.classList.remove('hidden');
    }
}

// 3. Render Calendar Grid
function renderAdminCalendar() {
    const monthYearEl = document.getElementById('admin-calendar-month');
    const gridEl = document.getElementById('admin-calendar-grid');
    const bookingSwitch = document.getElementById('booking-switch');
    if (!monthYearEl || !gridEl) return;

    const year = adminNavDate.getFullYear();
    const month = adminNavDate.getMonth();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    monthYearEl.textContent = `${monthNames[month]} ${year}`;
    gridEl.innerHTML = ''; 

    const firstDayIndex = new Date(year, month, 1).getDay();
    const startDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1; 
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < startDay; i++) {
        const blank = document.createElement('div');
        blank.className = 'aspect-square';
        gridEl.appendChild(blank);
    }

    for (let i = 1; i <= daysInMonth; i++) {
    const dayDiv = document.createElement('div');
    
    // 1. Restore the original square shapes (rounded-xl) and font styling
    dayDiv.className = 'aspect-square flex items-center justify-center rounded-xl bg-[#fbf4f2] text-[13px] font-bold text-gray-800 cursor-pointer hover:scale-105 transition-transform border border-transparent';
    
    const dbDate = `${year}-${String(month+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    dayDiv.dataset.date = dbDate;

    // 2. Re-inject the demo UI states specifically for July 2026 to match your Figma/HTML design
    if (year === 2026 && month === 6) { // Month 6 is July (0-indexed)
        const greenDays = [10, 13, 17, 20, 24, 27];
        
        // Apply green background for "open" days
        if (greenDays.includes(i)) {
            dayDiv.className = 'aspect-square flex items-center justify-center rounded-xl bg-[#e6f4ea] text-[13px] font-bold text-gray-800 cursor-pointer hover:scale-105 transition-transform border border-green-200 shadow-sm';
        }
        
        // Apply the red badge specifically for the 10th
        if (i === 10) {
            dayDiv.classList.add('relative');
            dayDiv.innerHTML = `${i} <span class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#bd1512] text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white box-content shadow-sm">2</span>`;
        } else {
            dayDiv.textContent = i;
        }
    } else {
        dayDiv.textContent = i;
    }

    // 3. Update the click listener to handle the 'booked' state for the 10th
    dayDiv.addEventListener('click', (e) => {
        selectedDayEl = e.currentTarget;
        const isOpen = selectedDayEl.classList.contains('bg-[#e6f4ea]');
        
        // Trigger the booked UI panel if they click the 10th in July 2026
        if (year === 2026 && month === 6 && i === 10) {
            showDayDetails('booked', i, monthNames[month], year);
        } else {
            showDayDetails('empty', i, monthNames[month], year);
        }
        
        const bookingSwitch = document.getElementById('booking-switch');
        if (isOpen && bookingSwitch) {
            bookingSwitch.className = "w-12 h-6 bg-[#00875a] rounded-full relative cursor-pointer border border-[#00875a] shadow-sm";
            bookingSwitch.innerHTML = '<div class="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>';
        } else if (bookingSwitch) {
            bookingSwitch.className = "w-12 h-6 bg-[#fbf4f2] rounded-full relative cursor-pointer border border-gray-200 shadow-sm";
            bookingSwitch.innerHTML = '<div class="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 shadow-sm border border-gray-200"></div>';
        }
    });

    gridEl.appendChild(dayDiv);
    }
}

// 4. Booking Switch Logic
function initBookingSwitch() {
    const bookingSwitch = document.getElementById('booking-switch');
    if (!bookingSwitch) return;

    bookingSwitch.addEventListener('click', async () => {
        if (!selectedDayEl) {
            alert("Please click a date on the calendar first!");
            return;
        }
        
        const dbDate = selectedDayEl.dataset.date;
        const activeTab = document.querySelector('.bg-\\[\\#bd1512\\]');
        const trackStr = activeTab && activeTab.textContent.includes('Agent') ? 'future_advisor' : 'future_client';
        const isCurrentlyOpen = bookingSwitch.classList.contains('bg-[#00875a]');
        
        if (!window.supabase) {
            alert("Supabase is not connected! Check your initialization.");
            return;
        }

        try {
            if (isCurrentlyOpen) {
                bookingSwitch.className = "w-12 h-6 bg-[#fbf4f2] rounded-full relative cursor-pointer border border-gray-200 shadow-sm";
                bookingSwitch.innerHTML = '<div class="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 shadow-sm border border-gray-200"></div>';
                selectedDayEl.classList.remove('bg-[#e6f4ea]');
                selectedDayEl.classList.add('bg-[#fbf4f2]');

                // REMOVED 'window.' here
                const { error } = await supabase.from('availability_slots').update({ is_open: false }).eq('slot_date', dbDate).eq('track', currentAdminTrack);
                if (error) throw error;
            } else {
                bookingSwitch.className = "w-12 h-6 bg-[#00875a] rounded-full relative cursor-pointer border border-[#00875a] shadow-sm";
                bookingSwitch.innerHTML = '<div class="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>';
                selectedDayEl.classList.remove('bg-[#fbf4f2]', 'border-pru-border');
                selectedDayEl.classList.add('bg-[#e6f4ea]');

                // REMOVED 'window.' here
                const { error } = await supabase.from('availability_slots').upsert({ slot_date: dbDate, track: currentAdminTrack, is_open: true, slot_time: '09:00:00' }, { onConflict: 'slot_date, track' });
                if (error) throw error;
            }
        } catch (error) {
            console.error("SUPABASE ERROR:", error);
            alert("Database Error: " + error.message + "\n(Hint: Check if RLS is blocking this or if a unique constraint is missing)");
            renderAdminCalendar(); // Revert visually if DB fails
        }
    });
}