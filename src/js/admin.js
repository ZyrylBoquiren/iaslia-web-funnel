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

document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase) {
        console.warn("Supabase script not loaded. Real data will not fetch.");
        return;
    }

    // Check if the admin is already logged in from a previous session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        // Skip login screen
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('admin-app').classList.remove('hidden');
        
        // Load data
        loadAdminLeads();
        if (typeof renderAdminCalendar === 'function') {
            await renderAdminCalendar();
            setupCalendarArrows();
            loadEmailTemplates();
            initBookingSwitch();
            initAddSlotButton();
        }
    } else {
        // Show login screen (default HTML state)
        document.getElementById('login-view').classList.remove('hidden');
        document.getElementById('admin-app').classList.add('hidden');
    }
});

// ==========================================
// 2. SPA ENGINE & UI LOGIC
// ==========================================

// Login Handler
// ==========================================
// SUPABASE AUTHENTICATION
// ==========================================
async function handleLogin(event) {
    event.preventDefault(); 
    
    const email = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const errorMsg = document.getElementById('login-error-msg');
    
    // Hide previous errors every time they click submit
    if (errorMsg) {
        errorMsg.classList.add('hidden');
        errorMsg.textContent = "";
    }

    // ==========================================
    // CLOUDFLARE TURNSTILE SECURITY CHECK
    // ==========================================
    const formData = new FormData(event.target);
    const turnstileResponse = formData.get('cf-turnstile-response');

    if (!turnstileResponse) {
        if (errorMsg) {
            errorMsg.textContent = "Security Check Failed: Please verify you are human.";
            errorMsg.classList.remove('hidden');
        }
        return; // Kills the function instantly
    }

    // UI Feedback
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Authenticating...";
    submitBtn.disabled = true;

    try {
        // The actual call to Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: pass,
        });

        if (error) throw error;

        // If successful, hide login, show dashboard
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('admin-app').classList.remove('hidden');
        
        // Load the data
        if (typeof loadAdminLeads === 'function') loadAdminLeads();
        if (typeof loadEmailTemplates === 'function') loadEmailTemplates();
        if (typeof renderAdminCalendar === 'function') {
            await renderAdminCalendar();
            setupCalendarArrows();
            initBookingSwitch();
            initAddSlotButton();
        }

    } catch (error) {
        // SHOW ERROR IN UI INSTEAD OF ALERT
        if (errorMsg) {
            errorMsg.textContent = 'Access Denied: Invalid email or password.';
            errorMsg.classList.remove('hidden');
        }
        console.error("Auth Error:", error);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// ==========================================
// SUPABASE LOGOUT
// ==========================================
async function handleLogout() {
    try {
        // Attempt to tell the server to kill the session
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            console.warn("Server session already dead or expired:", error.message);
        }
    } catch (error) {
        console.error("Logout Error:", error);
    } finally {
        
        // Hide dashboard, show login screen
        const adminApp = document.getElementById('admin-app');
        const loginView = document.getElementById('login-view');
        
        if (adminApp) adminApp.classList.add('hidden');
        if (loginView) loginView.classList.remove('hidden');

        // Clear the input fields and error messages
        const usernameInput = document.getElementById('login-username');
        const passwordInput = document.getElementById('login-password');
        const errorMsg = document.getElementById('login-error-msg');
        
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (errorMsg) {
            errorMsg.classList.add('hidden');
            errorMsg.textContent = '';
        }
    }
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

    // Update the Track Label dynamically based on the active tab
    const trackLabel = document.getElementById('panel-track-label');
    if (trackLabel) {
        trackLabel.textContent = currentAdminTrack === 'future_client' 
            ? 'Track: Financial Conversation (Client)' 
            : 'Track: Career Preview (Agent)';
    }

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
        // Fetch leads, BUT exclude anyone who has been 'archived' (Soft Delete)
        const { data: leads, error } = await supabase
            .from('leads')
            .select('*')
            .neq('current_stage', 'archived') 
            .order('created_at', { ascending: false });

        if (error) throw error;

        // --- DASHBOARD CARDS SYNC LOGIC ---
        const totalLeads = leads.length;
        const agentLeads = leads.filter(l => l.track === "future_advisor").length;
        const clientLeads = leads.filter(l => l.track === "future_client").length;
        const convertedLeads = leads.filter(l => l.current_stage === "converted").length;

        // Inject the math into the UI cards
        document.getElementById('card-total-leads').textContent = totalLeads;
        document.getElementById('card-agent-leads').textContent = agentLeads;
        document.getElementById('card-client-leads').textContent = clientLeads;
        document.getElementById('card-converted-leads').textContent = convertedLeads;
        // ----------------------------------

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
            // Determine dynamic milestone badges based on actual database stage
            const stage = lead.current_stage || 'new';
            const isMeetingDone = (stage === 'meeting' || stage === 'email_created' || stage === 'converted');
            const isConverted = (stage === 'converted');

            const mActive = isMeetingDone 
                ? 'bg-[#bd1512] text-white border-pru-red' 
                : 'bg-[#fbf4f2] text-gray-400 border-pru-border';
                
            const cActive = isConverted 
                ? 'bg-[#00875a] text-white border-[#00875a]' // Lights up Green when Officially Converted!
                : 'bg-[#fbf4f2] text-gray-400 border-pru-border';

            const mBadge = `<div class="w-6 h-6 rounded-full border text-[9px] font-bold flex items-center justify-center shadow-sm transition-colors ${mActive}">M</div>`;
            const cBadge = `<div class="w-6 h-6 rounded-full border text-[9px] font-bold flex items-center justify-center shadow-sm transition-colors ${cActive}">C</div>`;

            tr.innerHTML = `
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-[#fce8e8] text-pru-red font-bold flex items-center justify-center text-sm border border-pru-border flex-shrink-0">${initials}</div>
                        <div>
                            <p class="font-bold text-gray-900">${fullName}</p>
                            <p class="text-[11px] text-gray-400 mt-0.5">Added ${dateStr}</p>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4"><span class="px-3 py-1 bg-[#f3e9e8] text-gray-700 text-[11px] font-bold rounded-full border border-pru-border">${typeLabel}</span></td>
                <td class="px-6 py-4">
                    <p class="font-semibold text-gray-900">${lead.email}</p>
                    <p class="text-gray-500 text-[12px] mt-0.5">${mobile}</p>
                </td>
                <td class="px-6 py-4 text-gray-500">${source}</td>
                <td class="px-6 py-4">
                    <div class="flex gap-1 items-center">
                        ${mBadge}
                        ${cBadge}
                    </div>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex gap-1 justify-end items-center">
                        <button onclick="viewLeadDetails('${lead.lead_id}')" class="w-8 h-8 flex-shrink-0 border border-pru-border rounded-full inline-flex items-center justify-center text-gray-400 hover:text-pru-red transition-colors shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                        </button>
                        <button onclick="softDeleteLead('${lead.lead_id}')" class="w-8 h-8 flex-shrink-0 border border-pru-border rounded-full inline-flex items-center justify-center text-gray-400 hover:text-pru-red transition-colors shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

    } catch (err) {
        console.error("Failed to load leads:", err.message);
    }
}

// ----------------------------------------------------
// SOFT DELETE LOGIC (Hides from UI, keeps in Database)
// ----------------------------------------------------
window.softDeleteLead = async function(leadId) {
    if (!confirm("Are you sure you want to archive this lead? They will be removed from your pipeline.")) return;
    
    try {
        const { error } = await supabase
            .from('leads')
            .update({ current_stage: 'archived' })
            .eq('lead_id', leadId);
            
        if (error) throw error;
        
        // Immediately reload the table and refresh the synced cards
        loadAdminLeads();
        
    } catch (err) {
        console.error("Error archiving lead:", err.message);
        alert("Failed to archive lead. Please check the console.");
    }
};

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

        // Editable helpers to map UI text directly to Supabase columns
        const editableVal = (val, col) => val ? `<p data-table="leads" data-column="${col}" class="text-[13px] text-gray-500 font-medium">${val}</p>` : `<p data-table="leads" data-column="${col}" class="text-[13px] text-gray-400 italic"></p>`;
        
        // Upgraded to accept formatted overrides (like Peso signs and Yes/No)
        const editableProfile = (key, overrideVal) => {
            const displayVal = overrideVal !== undefined ? overrideVal : profile?.[key];
            return displayVal ? `<p data-column="${key}" class="text-[13px] text-gray-500 font-medium">${displayVal}</p>` : `<p data-column="${key}" class="text-[13px] text-gray-400 italic"></p>`;
        };

        // 6. Build the specific middle section depending on track
        let specificSectionHTML = '';
        if (isAgent) {
            specificSectionHTML = `
                <div class="mb-8">
                    <div class="flex items-center gap-2 mb-4">
                        <h3 class="text-[11px] font-bold text-[#b89569] uppercase tracking-widest">Education & Work</h3>
                        <button onclick="toggleEditMode(this, 'recruit_profile', '${leadId}')" class="text-gray-400 hover:text-[#bd1512] transition"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                    </div>
                    <div class="grid grid-cols-2 gap-y-6 gap-x-12">
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">University/College (Graduated Form)</p>${editableProfile('university_college')}</div>
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Degree</p>${editableProfile('degree')}</div>
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Area of Business or Employment</p>${editableProfile('area_of_employment')}</div>
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Work Experience</p>${editableProfile('work_experience')}</div>
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Number of Years Working</p>${editableProfile('years_working')}</div>
                    </div>
                </div>
                
                <div class="mb-8">
                    <div class="flex items-center gap-2 mb-4">
                        <h3 class="text-[11px] font-bold text-[#b89569] uppercase tracking-widest">Recruitment</h3>
                    </div>
                    <div class="grid grid-cols-2 gap-y-6 gap-x-12">
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Name of Recruiter</p><p class="text-[13px] text-gray-400 italic">Unassigned</p></div>
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Immediate Manager</p><p class="text-[13px] text-gray-400 italic">Unassigned</p></div>
                    </div>
                </div>
            `;
        } else {
            const budgetFormat = profile?.monthly_budget ? `₱${Number(profile.monthly_budget).toLocaleString()}` : null;
            const insuranceFormat = profile?.has_life_insurance === true ? 'Yes' : (profile?.has_life_insurance === false ? 'No' : null);
            
            specificSectionHTML = `
                <div class="mb-8">
                    <div class="flex items-center gap-2 mb-4">
                        <h3 class="text-[11px] font-bold text-[#b89569] uppercase tracking-widest">Financial & Lifestyle</h3>
                        <button onclick="toggleEditMode(this, 'client_profile', '${leadId}')" class="text-gray-400 hover:text-[#bd1512] transition"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                    </div>
                    <div class="grid grid-cols-2 gap-y-6 gap-x-12">
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Current Employment</p>${editableProfile('current_employment')}</div>
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Marital Status</p>${editableProfile('marital_status')}</div>
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Dependents</p>${editableProfile('no_of_dependents')}</div>
                        
                        <!-- These two use strict formatting (booleans/pesos) so we leave them uneditable to prevent DB crashes -->
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Has Life Insurance</p>${editableProfile('has_life_insurance', insuranceFormat)}</div>
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Monthly Budget</p>${editableProfile('monthly_budget', budgetFormat)}</div>
                    </div>
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
                    <label class="flex-1 bg-white border border-pru-border rounded-full py-1.5 px-3 flex items-center gap-2 shadow-sm cursor-pointer hover:bg-gray-50 transition">
                        <input type="checkbox" id="checkbox-meeting" onchange="updateLeadStage(this, 'meeting', '${leadId}')" class="w-3.5 h-3.5 accent-[#bd1512] cursor-pointer" ${lead.current_stage === 'meeting' || lead.current_stage === 'email_created' || lead.current_stage === 'converted' ? 'checked' : ''}>
                        <span class="text-[10px] font-bold text-gray-700">Meeting Done</span>
                    </label>
                    <label class="flex-1 bg-white border border-pru-border rounded-full py-1.5 px-3 flex items-center gap-2 shadow-sm cursor-pointer hover:bg-gray-50 transition">
                        <input type="checkbox" id="checkbox-email" onchange="updateLeadStage(this, 'email_created', '${leadId}')" class="w-3.5 h-3.5 accent-[#bd1512] cursor-pointer" ${lead.current_stage === 'email_created' || lead.current_stage === 'converted' ? 'checked' : ''}>
                        <span class="text-[10px] font-bold text-gray-700">PRU Email Created</span>
                    </label>
                    <label class="flex-1 bg-white border border-pru-border rounded-full py-1.5 px-3 flex items-center gap-2 shadow-sm cursor-pointer hover:bg-gray-50 transition">
                        <input type="checkbox" id="checkbox-converted" onchange="updateLeadStage(this, 'converted', '${leadId}')" class="w-3.5 h-3.5 accent-[#bd1512] cursor-pointer" ${lead.current_stage === 'converted' ? 'checked' : ''}>
                        <span class="text-[10px] font-bold text-gray-700">Officially Converted</span>
                    </label>
                </div>
            </div>

            <div class="flex px-6 border-b border-pru-border bg-white pt-2 shrink-0">
                <button class="px-4 py-2 border-b-2 border-pru-red text-pru-red text-[13px] font-bold">Profile</button>
                <button class="px-4 py-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700 text-[13px] font-bold transition-colors">Email</button>
            </div>

            <div class="p-8 overflow-y-auto flex-grow bg-white">
                
                <div class="mb-8">
                    <div class="flex items-center gap-2 mb-4">
                        <h3 class="text-[11px] font-bold text-[#b89569] uppercase tracking-widest">Contact</h3>
                        <button onclick="toggleEditMode(this, 'leads', '${leadId}')" class="text-gray-400 hover:text-[#bd1512] transition"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                    </div>
                    <div class="grid grid-cols-2 gap-y-6 gap-x-12">
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Full Name</p>${editableVal(fullName, 'full_name')}</div>
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Email Address</p>${editableVal(lead.email, 'email')}</div>
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Mobile Number</p>${editableVal(lead.mobile_number, 'mobile_number')}</div>
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Source</p>${editableVal(lead.source, 'source')}</div>
                    </div>
                </div>

                <div class="mb-8">
                    <div class="flex items-center gap-2 mb-4">
                        <h3 class="text-[11px] font-bold text-[#b89569] uppercase tracking-widest">Basic Info</h3>
                        <button onclick="toggleEditMode(this, '${isAgent ? 'recruit_profile' : 'client_profile'}', '${leadId}')" class="text-gray-400 hover:text-[#bd1512] transition"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg></button>
                    </div>
                    <div class="grid grid-cols-2 gap-y-6 gap-x-12">
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Date of Birth</p>${editableVal(dobStr, 'date_of_birth')}</div>
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Age</p>${safeVal(age)}</div>
                        <div><p class="text-[12px] font-bold text-gray-900 mb-1">Area of Residence</p>${editableProfile('area_of_residence')}</div>
                    </div>
                </div>

                ${specificSectionHTML}
            </div>

            <div class="p-6 border-t border-pru-border flex justify-end gap-3 bg-gray-50">
                <button onclick="deleteLeadProfile('${leadId}')" class="px-6 py-2.5 text-[13px] font-bold text-pru-red border border-pru-border rounded-full hover:bg-red-50 transition shadow-sm bg-white">
                    Delete Profile
                </button>
                
                <button onclick="closeModals();" class="px-6 py-2.5 text-[13px] font-bold text-white bg-[#bd1512] rounded-full hover:bg-red-900 transition shadow-sm">
                    Done
                </button>
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
        // CHANGED to .onclick to prevent ghost duplications on re-login
        prevBtn.onclick = (e) => {
            e.preventDefault(); // Prevents page reload
            adminNavDate.setMonth(adminNavDate.getMonth() - 1);
            renderAdminCalendar();
        };
    }
    
    if (nextBtn) {
        // CHANGED to .onclick to prevent ghost duplications on re-login
        nextBtn.onclick = (e) => {
            e.preventDefault(); // Prevents page reload
            adminNavDate.setMonth(adminNavDate.getMonth() + 1);
            renderAdminCalendar();
        };
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
async function renderAdminCalendar() {
  const monthYearEl = document.getElementById('admin-calendar-month');
  const gridEl = document.getElementById('admin-calendar-grid');
  if (!monthYearEl || !gridEl) return;
  const year = adminNavDate.getFullYear();
  const month = adminNavDate.getMonth();
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  monthYearEl.textContent = `${monthNames[month]} ${year}`;

  const startStr = `${year}-${String(month+1).padStart(2,'0')}-01`;
  const endStr = `${year}-${String(month+1).padStart(2,'0')}-31`;
  const { data: slotsData, error } = await supabase
    .from('availability_slots')
    .select('slot_date, is_open')
    .eq('track', currentAdminTrack)
    .gte('slot_date', startStr)
    .lte('slot_date', endStr);

  if (error) console.error('SUPABASE ERROR', error);

  const openDatesSet = new Set(
    (slotsData || []).map(row => row.slot_date)
  );

  gridEl.innerHTML = '';
  const firstDayIndex = new Date(year, month, 1).getDay();
  const startDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < startDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'aspect-square';
    gridEl.appendChild(blank);
  }

// FETCH BOOKED DATES FOR RED DOT
  const { data: bookedData } = await supabase
    .from('appointments')
    .select('availability_slots!inner(slot_date, track)')
    .or('status.neq.cancelled,status.is.null')
    .eq('availability_slots.track', currentAdminTrack);
  const bookedDates = bookedData ? bookedData.map(appt => appt.availability_slots?.slot_date) : [];

  for (let i = 1; i <= daysInMonth; i++) {
    const dayDiv = document.createElement('div');
    const dbDate = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    dayDiv.dataset.date = dbDate;

    const isOpenDay = openDatesSet.has(dbDate);
    const hasBooking = bookedDates.includes(dbDate);
    
    // We added 'relative' to the classes so the absolute dot positions correctly inside the square
    dayDiv.className = isOpenDay
      ? 'relative aspect-square flex items-center justify-center rounded-xl bg-[#e2f1e7] text-[13px] font-bold text-gray-900 cursor-pointer hover:shadow-md transition-transform border border-green-200'
      : 'relative aspect-square flex items-center justify-center rounded-xl bg-[#fdf4f2] text-[13px] text-gray-500 cursor-pointer hover:border-pru-red hover:border transition-all';
    
    // Inject the Red Dot if booked
    let redDotHTML = hasBooking 
        ? `<span class="absolute top-1.5 w-1.5 h-1.5 bg-[#bd1512] rounded-full"></span>` 
        : ``;
        
    dayDiv.innerHTML = `${redDotHTML}${i}`;

    dayDiv.addEventListener('click', (e) => {
      selectedDayEl = e.currentTarget;
      const isOpen = selectedDayEl.classList.contains('bg-[#e2f1e7]');
      
      // Load the available time pills
      loadTimeSlots(selectedDayEl.dataset.date, currentAdminTrack);
      
      // Fetch the booked leads for this specific date!
      loadScheduledLeads(selectedDayEl.dataset.date, currentAdminTrack);
      
      // Update the right-side panel UI
      showDayDetails(isOpen ? 'booked' : 'empty', i, monthNames[month], year);

      const bookingSwitch = document.getElementById('booking-switch');
      if (isOpen && bookingSwitch) {
        bookingSwitch.className = 'w-12 h-6 bg-[#00875a] rounded-full relative cursor-pointer border border-[#00875a] shadow-sm';
        bookingSwitch.innerHTML = '<div class="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>';
      } else if (bookingSwitch) {
        bookingSwitch.className = 'w-12 h-6 bg-fbf4f2 rounded-full relative cursor-pointer border border-gray-200 shadow-sm';
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
                bookingSwitch.className = "w-12 h-6 bg-[#fdf4f2] rounded-full relative cursor-pointer border border-gray-200 shadow-sm";
                bookingSwitch.innerHTML = '<div class="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 shadow-sm border border-gray-200"></div>';
                selectedDayEl.classList.remove('bg-[#e2f1e7]', 'text-gray-900', 'font-bold');
                selectedDayEl.classList.add('bg-[#fdf4f2]', 'text-gray-500');

                // REMOVED 'window.' here
                const { error } = await supabase.from('availability_slots').delete().eq('slot_date', dbDate).eq('track', currentAdminTrack);
                if (error) throw error;
            } else {
                bookingSwitch.className = "w-12 h-6 bg-[#00875a] rounded-full relative cursor-pointer border border-[#00875a] shadow-sm";
                bookingSwitch.innerHTML = '<div class="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>';
                selectedDayEl.classList.remove('bg-[#fdf4f2]', 'text-gray-500', 'border-pru-border');
                selectedDayEl.classList.add('bg-[#e2f1e7]', 'text-gray-900', 'font-bold');

                // REMOVED 'window.' here
                const { error } = await supabase.from('availability_slots').upsert(
                    { slot_date: dbDate, track: currentAdminTrack, is_open: true, slot_time: '09:00:00' },
                    { onConflict: 'slot_date, track, slot_time' }
                    );
                if (error) throw error;
            }
            loadTimeSlots(dbDate, currentAdminTrack);
        } catch (error) {
            console.error("SUPABASE ERROR:", error);
            alert("Database Error: " + error.message + "\n(Hint: Check if RLS is blocking this or if a unique constraint is missing)");
            renderAdminCalendar(); // Revert visually if DB fails
        }
    });
}

async function loadTimeSlots(dbDate, track) {
  const pillsContainer = document.getElementById('time-slot-pills');
  if (!pillsContainer) return;
  pillsContainer.innerHTML = '<span class="text-11px text-gray-400">Loading...</span>';

  const { data, error } = await supabase
    .from('availability_slots')
    .select('slot_id, slot_time, is_open')
    .eq('slot_date', dbDate)
    .eq('track', track)
    .order('slot_time', { ascending: true });

  if (error) { console.error('SUPABASE ERROR', error); return; }

  pillsContainer.innerHTML = '';
  if (!data || data.length === 0) {
    pillsContainer.innerHTML = '<span class="text-11px text-gray-400 italic">No time slots yet.</span>';
    return;
  }

  function formatSlotTime(timeStr) {
    const [h, m] = timeStr.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
}

data.forEach(slot => {
    const pill = document.createElement('span');
    pill.className = 'px-3 py-1 bg-[#fbeaea] text-[#bd1512] text-[11px] font-bold rounded-full flex items-center gap-1.5 cursor-pointer hover:bg-red-100 transition-colors';
    pill.innerHTML = `
        ${formatSlotTime(slot.slot_time)}
        <svg data-slot-id="${slot.slot_id}" class="remove-slot-btn w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
        </svg>`;
    pillsContainer.appendChild(pill);
});

  document.querySelectorAll('.remove-slot-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const slotId = e.currentTarget.dataset.slotId;
      
      if (!confirm("Remove this available time slot?")) return;

      const { error } = await supabase.from('availability_slots').delete().eq('slot_id', slotId);
      
      if (error) {
          console.error("Delete blocked by database:", error);
          alert("Cannot delete this slot! It is likely already booked by a lead. You must cancel the appointment first. \nError: " + error.message);
      }
      
      loadTimeSlots(dbDate, track);
    });
  });
}

function initAddSlotButton() {
  const addBtn = document.getElementById('add-slot-btn');
  const input = document.getElementById('new-slot-time-input');
  if (!addBtn || !input) return;

  addBtn.addEventListener('click', async () => {
    if (!selectedDayEl) { alert('Please click a date first!'); return; }
    const timeVal = input.value; // The HTML time picker returns format "HH:MM" natively!
    if (!timeVal) return;

    const dbDate = selectedDayEl.dataset.date;
    const track = currentAdminTrack;

    // Supabase needs "HH:MM:SS", so we just slap ":00" onto the end.
    const formattedTime = timeVal + ':00';

    const { error } = await supabase
      .from('availability_slots')
      .insert({ slot_date: dbDate, track: track, slot_time: formattedTime, is_open: true });

    if (error) { 
        alert('Add failed: ' + error.message); 
        return; 
    }
    
    input.value = '';
    loadTimeSlots(dbDate, track);
  });
}
// ==========================================
// DYNAMIC SCHEDULED LEADS FETCH
// ==========================================
async function loadScheduledLeads(selectedDate, track) {
    // 1. Target the exact container holding the cards
    const badge = document.getElementById('booked-count-badge');
    const list = document.getElementById('scheduled-leads-container'); 
    
    // Fallback if the ID doesn't exist (prevents crashes)
    if (!list) {
        console.warn("Could not find 'scheduled-leads-container' in HTML.");
        return; 
    }

    // 2. WIPE THE SLATE CLEAN IMMEDIATELY
    list.innerHTML = '<p class="text-[13px] text-gray-500 italic py-2">Checking schedule...</p>';

    // Revert UI to Gray & dynamically swap the text based on the active tab
        const trackLabel = document.getElementById('panel-track-label');
        if (trackLabel) {
            trackLabel.className = "text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-1";
            trackLabel.textContent = currentAdminTrack === 'future_client' 
                ? 'Track: Financial Conversation (Client)' 
                : 'Track: Career Preview (Agent)';
        }

    try {
        // 3. Find slots for this date
        const { data: slots } = await supabase
            .from('availability_slots')
            .select('slot_id, slot_time')
            .eq('slot_date', selectedDate)
            .eq('track', track);

        if (!slots || slots.length === 0) {
            if (badge) badge.textContent = '0';
            list.innerHTML = '<div class="text-center py-6"><p class="text-[13px] text-gray-500 font-medium">No scheduled leads today.</p><p class="text-[11px] text-gray-400 mt-1">Open slots to accept bookings.</p></div>';
            return;
        }

        const slotIds = slots.map(s => s.slot_id);

        // 4. Find appointments linked to those slots
        const { data: appointments } = await supabase
            .from('appointments')
            .select('appointment_id, lead_id, slot_id')
            .in('slot_id', slotIds)
            .or('status.neq.cancelled,status.is.null');

        if (!appointments || appointments.length === 0) {
            if (badge) badge.textContent = "0";
            list.innerHTML = '<div class="text-center py-6"><p class="text-[13px] text-gray-500 font-medium">No scheduled leads today.</p><p class="text-[11px] text-gray-400 mt-1">Slots are open but empty.</p></div>';
            return;
        }

        const leadIds = appointments.map(a => a.lead_id);

        // 5. Get Lead Data
        const { data: leads } = await supabase
            .from('leads')
            .select('lead_id, full_name, email, mobile_number')
            .in('lead_id', leadIds);

        // 6. BUILD THE UI
        list.innerHTML = ''; // Clear the "Checking schedule" text
        
        // Update the red notification badge with the real number of appointments
        if (badge) {
            badge.textContent = appointments.length;
            badge.classList.remove('hidden');
        }
        
        appointments.forEach(appt => {
            const lead = leads.find(l => l.lead_id === appt.lead_id);
            const slot = slots.find(s => s.slot_id === appt.slot_id);
            
            if (lead && slot) {
                // Force raw database time to AM/PM without timezone shifting
                const rawTime = slot.slot_time; // Looks like "09:00:00"
                const [hours, minutes] = rawTime.split(':');
                const hourNum = parseInt(hours, 10);
                const ampm = hourNum >= 12 ? 'PM' : 'AM';
                const formattedHour = hourNum % 12 || 12;
                const timeStr = `${formattedHour}:${minutes} ${ampm}`;

                const initials = lead.full_name ? lead.full_name.substring(0, 2).toUpperCase() : '??';

                list.innerHTML += `
                    <div class="bg-[#fbf4f2] border border-pru-border rounded-xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:border-pru-red transition mb-3 group relative"
                         onclick="window.openLeadModal('${appt.appointment_id}', '${lead.lead_id}', '${track}')">
                        
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-[#fce8e8] text-pru-red font-bold flex items-center justify-center text-[10px] border border-pru-border flex-shrink-0">${initials}</div>
                            <div>
                                <p class="text-[13px] font-bold text-gray-900">${lead.full_name || 'Unknown'}</p>
                                <p class="text-[11px] text-gray-500 mt-0.5">${lead.email || 'No email'} · ${lead.mobile_number || 'No number'}</p>
                            </div>
                        </div>
                        
                        <div class="flex items-center gap-2">
                            <span class="bg-white border border-pru-border text-[#bd1512] text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm whitespace-nowrap">${timeStr}</span>
                            
                            <button onclick="event.preventDefault(); event.stopPropagation(); window.cancelAppointment('${appt.appointment_id}', '${slot.slot_date}')"
                                    class="hidden group-hover:flex w-6 h-6 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                                    title="Cancel Appointment">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
            }
        });

    } catch (err) {
        console.error("Schedule fetch error:", err);
        list.innerHTML = '<p class="text-xs text-red-500 py-2">Error loading leads.</p>';
    }
}

// ==========================================
// CANCEL APPOINTMENT LOGIC
// ==========================================
window.cancelAppointment = async (appointmentId, slotDate) => {
    if (!confirm("Are you sure you want to cancel this appointment? The lead will remain in the database.")) return;

    try {
        // 1. Update the status in Supabase to 'cancelled'
        const { error } = await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('appointment_id', appointmentId);

        if (error) throw error;

        // 2. Refresh the UI
        loadScheduledLeads(slotDate, currentAdminTrack);
        alert("Appointment cancelled successfully.");

    } catch (error) {
        console.error("Error cancelling appointment:", error);
        alert("Failed to cancel appointment. Check console.");
    }
};

// ==========================================
// 4. ADD LEAD MODAL LOGIC
// ==========================================

window.openAddLeadModal = function() {
    const modal = document.getElementById('new-add-lead-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.closeAddLeadModal = function() {
    const modal = document.getElementById('new-add-lead-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        // Clear the form fields when closing
        document.getElementById('add-lead-form').reset();
    }
};

window.submitNewLead = async function(event) {
    event.preventDefault(); // Prevents page from reloading
    
    const saveBtn = document.getElementById('save-lead-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    // Grab values from inputs
    const fullName = document.getElementById('new-lead-name').value.trim();
    const email = document.getElementById('new-lead-email').value.trim();
    const phone = document.getElementById('new-lead-phone').value.trim();
    const trackType = document.getElementById('new-lead-type').value;
    const notes = document.getElementById('new-lead-notes').value.trim();

    try {
            // 1. Insert into Database and ask Supabase to return the newly created row (.select().single())
            const { data: newLead, error: leadError } = await supabase
                .from('leads')
                .insert([{
                    full_name: fullName,
                    email: email,
                    mobile_number: phone,
                    track: trackType,
                    source: 'Admin Dashboard', // Hardcoded so you know it was manually added
                    current_stage: 'new',
                    notes: notes 
                }])
                .select()
                .single();

            if (leadError) throw leadError;

            // 2. Create the blank profile row immediately so the pencil icons have a row to edit!
            const targetTable = (trackType === 'future_advisor') ? 'recruit_profile' : 'client_profile';
            const { error: profileError } = await supabase
                .from(targetTable)
                .insert([{ lead_id: newLead.lead_id }]);
                
            if (profileError) throw profileError;

            // Success! Close modal and refresh UI
            closeAddLeadModal();
            
            // This function from Part 1 will refresh the table and update the 4 Dashboard Cards instantly!
            loadAdminLeads(); 
            
            // Small success alert
            setTimeout(() => alert("Lead successfully added to the pipeline!"), 300);

        } catch (err) {
            console.error("Error adding lead:", err.message);
            alert("Failed to add lead. Check console for details.");
        } finally {
        // Reset button state
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
};

// ==========================================
// INLINE EDITING ENGINE & CHECKBOX LOGIC
// ==========================================

async function toggleEditMode(btn, defaultTableName, leadId) {
    const sectionContainer = btn.parentElement.parentElement; 
    const editableFields = sectionContainer.querySelectorAll('[data-column]');
    const isEditing = sectionContainer.classList.toggle('is-editing');

    if (isEditing) {
        // TURN ON EDIT MODE
        btn.innerHTML = `<svg class="w-4 h-4 text-[#00875a]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
            
        editableFields.forEach(field => {
            field.contentEditable = "true";
            field.classList.add('border-b', 'border-[#b89569]', 'outline-none', 'bg-gray-50', 'px-1');
            field.focus();
        });
    } else {
        // TURN OFF EDIT MODE & SAVE TO SUPABASE
        btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>`;
            
        let updatesByTable = {};
        
        editableFields.forEach(field => {
            field.contentEditable = "false";
            field.classList.remove('border-b', 'border-[#b89569]', 'outline-none', 'bg-gray-50', 'px-1');
            
            const dbColumn = field.getAttribute('data-column');
            const targetTable = field.getAttribute('data-table') || defaultTableName; 
            
            let rawValue = field.innerText.trim();
            let finalValue = rawValue === "" ? null : rawValue;

            // SMART CLEANERS: Bulletproof formatting
            if (finalValue !== null) {
                if (dbColumn === 'monthly_budget') {
                    // Strips absolutely everything except numbers and decimals
                    let cleanNum = String(finalValue).replace(/[^0-9.]/g, "");
                    finalValue = cleanNum === "" ? null : parseFloat(cleanNum);
                } 
                else if (dbColumn === 'years_working' || dbColumn === 'no_of_dependents') {
                    // Strips letters and decimals (e.g. changes "5 years" into just 5)
                    let cleanNum = String(finalValue).replace(/[^0-9]/g, "");
                    finalValue = cleanNum === "" ? null : parseInt(cleanNum, 10);
                } 
                else if (dbColumn === 'has_life_insurance') {
                    // Converts boolean values safely
                    let lower = String(finalValue).toLowerCase();
                    finalValue = (lower === 'yes' || lower === 'true' || lower === '1');
                } 
                else if (dbColumn === 'date_of_birth') {
                    // Parses standard text dates back into DB format "YYYY-MM-DD"
                    let d = new Date(finalValue);
                    finalValue = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : null;
                }
            }

            // Organize updates into their respective table objects
            if (!updatesByTable[targetTable]) updatesByTable[targetTable] = {};
            updatesByTable[targetTable][dbColumn] = finalValue;
        });

        try {
            // Loop through and fire an update for every table involved in this section
            for (const [table, data] of Object.entries(updatesByTable)) {
                if (Object.keys(data).length > 0) {
                    
                    // Add .select() so Supabase tells us if it actually found a row to update
                    const { data: updatedRows, error } = await supabase
                        .from(table)
                        .update(data)
                        .eq('lead_id', leadId)
                        .select();
                        
                    if (error) throw error;
                    
                    // SMART FALLBACK: If Supabase updated 0 rows, the profile table row is missing! 
                    // (This fixes any broken leads you created before today). Let's create it on the fly!
                    if (updatedRows && updatedRows.length === 0 && table !== 'leads') {
                        data.lead_id = leadId; // Add the foreign key required for insertion
                        const { error: insertError } = await supabase
                            .from(table)
                            .insert([data]);
                            
                        if (insertError) throw insertError;
                    }
                }
            }
            
            console.log("Successfully routed and saved edits:", updatesByTable);
            loadAdminLeads(); // Refresh background UI
            viewLeadDetails(leadId); // Re-render modal to instantly format the new peso sign / age
            
        } catch (err) {
            console.error("Error saving lead edit:", err.message);
            alert("Failed to save changes. " + err.message);
        }
    }
}

async function updateLeadStage(checkboxElem, clickedStage, leadId) {
    // 1. Sync the visual checkboxes up or down based on what was checked/unchecked
    if (checkboxElem.checked) {
        if (clickedStage === 'converted') {
            document.getElementById('checkbox-meeting').checked = true;
            document.getElementById('checkbox-email').checked = true;
        } else if (clickedStage === 'email_created') {
            document.getElementById('checkbox-meeting').checked = true;
        }
    } else {
        // If unchecking, uncheck dependencies above it
        if (clickedStage === 'meeting') {
            document.getElementById('checkbox-email').checked = false;
            document.getElementById('checkbox-converted').checked = false;
        } else if (clickedStage === 'email_created') {
            document.getElementById('checkbox-converted').checked = false;
        }
    }

    // 2. Determine the TRUE highest stage based on the current UI state
    let finalStage = 'new';
    if (document.getElementById('checkbox-converted').checked) finalStage = 'converted';
    else if (document.getElementById('checkbox-email').checked) finalStage = 'email_created';
    else if (document.getElementById('checkbox-meeting').checked) finalStage = 'meeting';

    // 3. Save the final calculated stage to Supabase
    try {
        const { error } = await supabase
            .from('leads')
            .update({ current_stage: finalStage })
            .eq('lead_id', leadId);

        if (error) throw error;
        console.log(`Stage correctly synced to: ${finalStage}`);
        
        // Instantly reload dashboard cards and background table
        loadAdminLeads(); 
    } catch (err) {
        console.error("Error updating stage:", err.message);
        alert("Failed to update lead stage. Check database rules.");
        // Revert visual if it fails
        checkboxElem.checked = !checkboxElem.checked; 
    }
}

// ==========================================
// MODAL DELETE FUNCTION
// ==========================================
async function deleteLeadProfile(leadId) {
    if (!confirm("Are you sure you want to completely delete this lead? This cannot be undone.")) return;
    
    try {
        const { error } = await supabase.from('leads').delete().eq('lead_id', leadId);
        if (error) throw error;
        
        closeModals();
        loadAdminLeads(); // Refresh UI instantly
        console.log("Lead deleted successfully.");
    } catch (err) {
        console.error("Delete failed:", err.message);
        alert("Failed to delete lead. Check console.");
    }
}

function openTemplateModal(mode, leadType = 'Unassigned') {
    const modalTypeInput = document.getElementById('template-modal-type');
    
    if (mode === 'new') {
        // You could change this to a <select> dropdown later if you want them to choose
        modalTypeInput.value = "Select later / General"; 
    } else {
        // Locks it to Agent or Client based on where they clicked
        modalTypeInput.value = leadType;
    }
    
    openModal('edit-template-modal');
}

// ==========================================
// 6. EMAIL TEMPLATES ENGINE
// ==========================================

async function loadEmailTemplates() {
    const agentGrid = document.getElementById('agent-templates-grid');
    const clientGrid = document.getElementById('client-templates-grid');
    if (!agentGrid || !clientGrid) return;
    
    agentGrid.innerHTML = '<p class="text-[13px] text-gray-500 col-span-2 py-4">Fetching templates...</p>';
    clientGrid.innerHTML = '<p class="text-[13px] text-gray-500 col-span-2 py-4">Fetching templates...</p>';

    try {
        const { data: templates, error } = await supabase
            .from('email_templates')
            .select('*')
            .order('template_name', { ascending: true });

        if (error) throw error;

        agentGrid.innerHTML = '';
        clientGrid.innerHTML = '';

        const agentTemplates = templates.filter(t => t.track === 'future_advisor');
        const clientTemplates = templates.filter(t => t.track === 'future_client');
        
        const renderCard = (t) => `
            <div class="border border-pru-border rounded-xl p-6 flex flex-col justify-between bg-white shadow-sm hover:border-gray-300 transition-colors">
                <div>
                    <h3 class="text-[14px] font-bold text-gray-900 mb-1">${t.template_name}</h3>
                    <p class="text-[12px] text-gray-500 mb-6 truncate" title="${t.subject}">${t.subject}</p>
                </div>
                <div class="flex gap-3">
                    <button onclick="openTemplateModal('edit', '${t.template_id}')" class="px-4 py-1.5 text-[11px] font-bold text-gray-700 border border-pru-border rounded-full hover:bg-gray-50 transition-colors">Edit</button>
                    <button onclick="deleteTemplate('${t.template_id}')" class="px-4 py-1.5 text-[11px] font-bold text-pru-red border border-pru-border rounded-full hover:bg-[#fbf4f2] transition-colors">Delete</button>
                </div>
            </div>
        `;

        if (agentTemplates.length === 0) agentGrid.innerHTML = '<p class="text-[12px] text-gray-400 italic col-span-2">No agent templates found.</p>';
        else agentTemplates.forEach(t => agentGrid.innerHTML += renderCard(t));
        
        if (clientTemplates.length === 0) clientGrid.innerHTML = '<p class="text-[12px] text-gray-400 italic col-span-2">No client templates found.</p>';
        else clientTemplates.forEach(t => clientGrid.innerHTML += renderCard(t));

    } catch (err) {
        console.error("Error loading templates:", err);
        agentGrid.innerHTML = '<p class="text-[12px] text-red-500 col-span-2">Database error. Check console.</p>';
        clientGrid.innerHTML = '<p class="text-[12px] text-red-500 col-span-2">Database error. Check console.</p>';
    }
}

window.openTemplateModal = async function(mode, templateId = null) {
    const modal = document.getElementById('edit-template-modal');
    const form = document.getElementById('template-form');
    const title = document.getElementById('template-modal-title');
    const trackSelect = document.getElementById('modal-template-track');
    
    form.reset();
    document.getElementById('modal-template-id').value = '';
    
    if (mode === 'new') {
        title.textContent = "New Template";
        // Unlocks dropdown for a brand new template
        trackSelect.disabled = false;
        trackSelect.classList.remove('bg-gray-100', 'cursor-not-allowed', 'text-gray-500');
        trackSelect.classList.add('bg-white', 'text-gray-800');
    } else {
        title.textContent = "Edit Template";
        // Locks the dropdown to the template's designated track
        trackSelect.disabled = true;
        trackSelect.classList.add('bg-gray-100', 'cursor-not-allowed', 'text-gray-500');
        trackSelect.classList.remove('bg-white', 'text-gray-800');
        
        try {
            const { data, error } = await supabase
                .from('email_templates')
                .select('*')
                .eq('template_id', templateId)
                .single();
                
            if (error) throw error;
            
            // Populate the modal fields directly from the database row
            document.getElementById('modal-template-id').value = data.template_id;
            document.getElementById('modal-template-name').value = data.template_name;
            trackSelect.value = data.track;
            document.getElementById('modal-template-subject').value = data.subject;
            document.getElementById('modal-template-body').value = data.message_body;
            
        } catch (err) {
            console.error("Fetch template error:", err);
            return;
        }
    }
    
    document.getElementById('modal-overlay').classList.remove('hidden');
    modal.classList.remove('hidden');
};

window.saveTemplate = async function(event) {
    event.preventDefault();
    const saveBtn = document.getElementById('save-template-btn');
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    const id = document.getElementById('modal-template-id').value;
    
    const payload = {
        template_name: document.getElementById('modal-template-name').value,
        track: document.getElementById('modal-template-track').value,
        subject: document.getElementById('modal-template-subject').value,
        message_body: document.getElementById('modal-template-body').value
    };
    
    try {
        if (id) {
            // Edit Existing
            const { error } = await supabase.from('email_templates').update(payload).eq('template_id', id);
            if (error) throw error;
        } else {
            // Create New
            const { error } = await supabase.from('email_templates').insert([payload]);
            if (error) throw error;
        }
        
        closeModals();
        loadEmailTemplates(); // Instant reload of UI
    } catch (err) {
        alert("Failed to save: " + err.message);
        console.error(err);
    } finally {
        saveBtn.textContent = 'Save Template';
        saveBtn.disabled = false;
    }
};

window.deleteTemplate = async function(templateId) {
    if (!confirm("Are you sure you want to delete this template? This cannot be undone.")) return;
    
    try {
        const { error } = await supabase.from('email_templates').delete().eq('template_id', templateId);
        if (error) throw error;
        loadEmailTemplates(); 
    } catch(err) {
        alert("Delete failed: " + err.message);
        console.error(err);
    }
};

// ==========================================
// GOD-MODE TAB SWITCHING ENGINE
// ==========================================
window.switchTab = function(tabId) {
    try {
        // 1. Master array of your 5 tabs and their matching navigation buttons
        const tabs = [
            { view: 'view-leads', btn: 'nav-leads' },
            { view: 'view-analytics', btn: 'nav-analytics' },
            { view: 'view-calendar', btn: 'nav-calendar' },
            { view: 'view-email-templates', btn: 'nav-email-templates' },
            { view: 'view-settings', btn: 'nav-settings' }
        ];

        // 2. Safely hide EVERYTHING and reset all button colors
        tabs.forEach(tab => {
            // Hide the view container safely
            const viewEl = document.getElementById(tab.view);
            if (viewEl) {
                viewEl.classList.add('hidden');
                viewEl.classList.remove('block');
                viewEl.style.display = 'none'; // Force hide just in case
            }

            // Reset sidebar buttons to gray/inactive
            const btnEl = document.getElementById(tab.btn);
            if (btnEl) {
                btnEl.classList.remove('bg-[#3a2727]', 'text-white');
                btnEl.classList.add('text-gray-300', 'hover:bg-[#3a2727]', 'hover:text-white');
                
                // Turn the little dot gray
                const dot = btnEl.querySelector('span');
                if (dot) {
                    dot.classList.remove('bg-[#b89569]');
                    dot.classList.add('bg-[#6b7280]');
                }
            }
        });

        // 3. FORCE SHOW the one you actually clicked
        const targetView = document.getElementById(tabId);
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.classList.add('block');
            targetView.style.display = 'block'; // Force show to kill the white screen
        }

        // 4. Highlight the active sidebar button
        const activeBtnId = tabId.replace('view-', 'nav-'); // e.g., turns 'view-leads' into 'nav-leads'
        const activeBtn = document.getElementById(activeBtnId);
        if (activeBtn) {
            // Make button dark background with white text
            activeBtn.classList.add('bg-[#3a2727]', 'text-white');
            activeBtn.classList.remove('text-gray-300', 'hover:bg-[#3a2727]', 'hover:text-white');
            
            // Light up the gold dot!
            const activeDot = activeBtn.querySelector('span');
            if (activeDot) {
                activeDot.classList.remove('bg-[#6b7280]');
                activeDot.classList.add('bg-[#b89569]');
            }
        }

    } catch (err) {
        console.error("CRITICAL: Tab switch failed:", err);
    }
};

// ==========================================
// CSV EXPORT ENGINE
// ==========================================

// Helper function to turn JSON objects into clean CSV text
function convertToCSV(objArray) {
    if (!objArray || objArray.length === 0) return '';
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
    let str = '';
    
    // Extract headers
    const headers = Object.keys(array[0]);
    str += headers.join(',') + '\r\n';

    // Loop through rows
    for (let i = 0; i < array.length; i++) {
        let line = '';
        for (let index in array[i]) {
            if (line !== '') line += ',';
            
            // Catch nulls and clean up quotes/commas so it doesn't break Excel
            let cellValue = array[i][index] === null || array[i][index] === undefined ? '' : String(array[i][index]);
            cellValue = cellValue.replace(/"/g, '""');
            if (cellValue.search(/("|,|\n)/g) >= 0) {
                cellValue = '"' + cellValue + '"';
            }
            line += cellValue;
        }
        str += line + '\r\n';
    }
    return str;
}

// Helper function to force browser download
function triggerDownload(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 1. Export Leads Function
window.exportLeadsCSV = async function(event) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = "Exporting...";
    btn.disabled = true;

    try {
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        if (!data || data.length === 0) {
            alert("No leads found in the database to export.");
            return;
        }

        const csvData = convertToCSV(data);
        const dateStr = new Date().toISOString().split('T')[0];
        triggerDownload(csvData, `IASLIA_Leads_Export_${dateStr}.csv`);

    } catch (err) {
        console.error("Export error:", err.message);
        alert("Failed to export leads: " + err.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};

// 2. Export Appointments Function
window.exportAppointmentsCSV = async function(event) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = "Exporting...";
    btn.disabled = true;

    try {
        // Fetch appointments AND join the related lead and slot data!
        const { data, error } = await supabase
            .from('appointments')
            .select(`
                appointment_id,
                reference_code,
                status,
                admin_notes,
                leads ( full_name, email, mobile_number, track ),
                availability_slots ( slot_date, slot_time )
            `);

        if (error) throw error;
        
        if (!data || data.length === 0) {
            alert("No appointments found in the database to export.");
            return;
        }

        // Flatten the nested JSON so the CSV is perfectly readable for the boss
        const formattedData = data.map(appt => ({
            reference_code: appt.reference_code,
            client_name: appt.leads?.full_name || 'Unknown',
            client_email: appt.leads?.email || 'Unknown',
            client_phone: appt.leads?.mobile_number || 'Unknown',
            track: appt.leads?.track === 'future_advisor' ? 'Agent' : 'Client',
            date: appt.availability_slots?.slot_date || 'Unscheduled',
            time: appt.availability_slots?.slot_time || 'N/A',
            status: appt.status,
            admin_notes: appt.admin_notes || ''
        }));

        const csvData = convertToCSV(formattedData);
        const dateStr = new Date().toISOString().split('T')[0];
        triggerDownload(csvData, `IASLIA_Appointments_Export_${dateStr}.csv`);

    } catch (err) {
        console.error("Export error:", err.message);
        alert("Failed to export appointments: " + err.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};