// ============= SUPABASE INITIALIZATION =============
const SUPABASE_URL = "https://refufwvilgtgqpcnejhs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlZnVmd3ZpbGd0Z3FwY25lamhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4Nzk4MTMsImV4cCI6MjEwMDQ1NTgxM30.lPL_AWB1uMHS8Bac7jNtuPJJD7FUDpPNiuP0J7v6DII";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============= FORM REFERENCES (Global Scope) =============
window.agentForm = document.getElementById("appointment-form");
window.clientForm = document.getElementById("client-appointment-form");

// ============= TRACK SWITCHING =============
window.switchTrack = function(trackType) {
    const agentContainer = document.getElementById("agent-form-container");
    const clientContainer = document.getElementById("client-form-container");
    const bookingSection = document.getElementById("booking-section");

    agentContainer.classList.toggle("hidden", trackType === "client");
    clientContainer.classList.toggle("hidden", trackType === "agent");

    bookingSection.scrollIntoView({ behavior: "smooth", block: "start" });
};

// ============= DYNAMIC CALENDAR =============
const calendarState = new WeakMap(); 
const calendarDates = new WeakMap(); 

async function fetchAvailableDates(trackStr) {
    try {
        const { data, error } = await supabaseClient
            .from('availability_slots')
            .select('slot_date')
            .eq('track', trackStr)
            .eq('is_open', true);

        if (error) throw error;
        return data.map(row => row.slot_date);
    } catch (err) {
        console.error(`Error fetching dates for ${trackStr}:`, err);
        return []; 
    }
}

function renderCalendar(form, availableDates) {
    calendarDates.set(form, availableDates);

    const grid = form.querySelector(".calendar-grid");
    const title = form.querySelector(".calendar-title");
    const dateInput = form.querySelector(".appt-date-input");

    let state = calendarState.get(form);
    if (!state) {
        const today = new Date();
        state = { year: today.getFullYear(), month: today.getMonth() }; 
        calendarState.set(form, state);
    }

    const { year, month } = state;
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ];
    if (title) title.textContent = `${monthNames[month]} ${year}`;

    const firstWeekday = new Date(year, month, 1).getDay(); 
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (grid) grid.innerHTML = "";

    for (let i = 0; i < firstWeekday; i++) {
        const empty = document.createElement("div");
        empty.className = "day-cell empty";
        if (grid) grid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, month, day);
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const fullDateLabel = `${monthNames[month]} ${day}, ${year}`;

        const cell = document.createElement("div");
        cell.textContent = day;
        cell.dataset.fullDate = fullDateLabel;

        const isPast = cellDate < today;
        const isAvailable = availableDates.includes(dateKey);
        const isSelected = dateInput && dateInput.value === fullDateLabel;

        if (isPast || !isAvailable) {
            cell.className = "day-cell unavailable";
        } else if (isSelected) {
            cell.className = "day-cell selected";
        } else {
            cell.className = "day-cell available";
        }

        if (grid) grid.appendChild(cell);
    }

    attachDayCellListeners(form);
}

// Exported to window so your inline HTML onclicks actually work
window.changeMonth = function(form, direction) {
    const state = calendarState.get(form);
    if (!state) return;
    state.month += direction;
    if (state.month > 11) { state.month = 0; state.year++; }
    if (state.month < 0) { state.month = 11; state.year--; }

    const availableDates = calendarDates.get(form) || [];
    renderCalendar(form, availableDates);
};

async function fetchSlotTimesForDate(dbDate, trackStr) {
    try {
        const { data, error } = await supabaseClient
            .from('availability_slots')
            .select('slot_time')
            .eq('slot_date', dbDate)
            .eq('track', trackStr)
            .eq('is_open', true)
            .order('slot_time', { ascending: true });
            
        if (error) throw error;
        return (data || []).map(row => row.slot_time.slice(0,5));
    } catch (err) {
        console.error('Error fetching slot times', err);
        return [];
    }
}

function formatTo12Hour(timeStr) {
    const [h, m] = timeStr.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
}

function convert12HourTo24Hour(time12h) {
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  hours = parseInt(hours, 10);
  if (modifier === 'PM' && hours !== 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}:00`;
}

function attachDayCellListeners(form) {
    const dayCells = form.querySelectorAll('.day-cell.available, .day-cell.selected');
    const dateInput = form.querySelector('.appt-date-input');
    const timesHint = form.querySelector('.times-hint');
    const timesGrid = form.querySelector('.times-grid');
    const timeInput = form.querySelector('.appt-time-input');
    const trackStr = form.id === 'appointment-form' ? 'future_advisor' : 'future_client';

    dayCells.forEach(cell => {
        cell.addEventListener('click', async () => {
            dayCells.forEach(c => { c.classList.remove('selected'); c.classList.add('available'); });
            cell.classList.remove('available'); cell.classList.add('selected');
            
            if (dateInput) dateInput.value = cell.dataset.fullDate;
            if (timesHint) timesHint.textContent = `Choose a time for ${cell.dataset.fullDate}.`;
            if (timesGrid) { 
                timesGrid.classList.remove('times-disabled', 'times-error'); 
                timesGrid.innerHTML = "<p class='text-[12px] text-gray-500 col-span-2 py-2 text-center'>Loading times...</p>";
            }
            form.querySelector('.calendar-grid')?.classList.remove('calendar-error');
            if (timeInput) timeInput.value = '';

            const apptDateObj = new Date(cell.dataset.fullDate);
            const tzOffset = apptDateObj.getTimezoneOffset() * 60000;
            const dbDate = new Date(apptDateObj - tzOffset).toISOString().split('T')[0];

            const openTimes = await fetchSlotTimesForDate(dbDate, trackStr);
            const openTimesFormatted = [...new Set(openTimes.map(formatTo12Hour))];

            if (timesGrid) {
                timesGrid.innerHTML = ""; // Clear loader
                if (openTimesFormatted.length === 0) {
                    timesGrid.innerHTML = "<p class='text-[12px] text-gray-500 col-span-2 py-2 text-center'>No available times for this date.</p>";
                } else {
                    openTimesFormatted.forEach(timeStr => {
                        const btn = document.createElement("button");
                        btn.type = "button";
                        btn.className = "time-btn w-full"; // Automatically grabs your style.css properties!
                        btn.textContent = timeStr;
                        
                        btn.addEventListener('click', () => {
                            const allBtns = timesGrid.querySelectorAll('.time-btn');
                            allBtns.forEach(b => b.classList.remove('selected'));
                            btn.classList.add('selected');
                            if (timeInput) timeInput.value = timeStr;
                            timesGrid.classList.remove('times-error');
                        });

                        timesGrid.appendChild(btn);
                    });
                }
            }
        });
    });
}

// ============= YES/NO TOGGLE =============
window.selectToggle = function(button, hiddenInputId, value) {
    document.getElementById(hiddenInputId).value = value;
    button.parentElement
        .querySelectorAll(".toggle-btn")
        .forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    button.closest(".toggle-group").classList.remove("toggle-error");
};

// ============= VALIDATION =============
function validateForm(form) {
    let isValid = true;
    let firstInvalidEl = null;

    const requiredFields = form.querySelectorAll(
        "input[required]:not([type=hidden]), select[required]"
    );
    requiredFields.forEach((field) => {
        if (!field.value || !field.value.trim()) {
            isValid = false;
            field.classList.add("field-error");
            if (!firstInvalidEl) firstInvalidEl = field;
        } else {
            field.classList.remove("field-error");
        }
    });

    const dateInput = form.querySelector(".appt-date-input");
    const timeInput = form.querySelector(".appt-time-input");
    const calendarGrid = form.querySelector(".calendar-grid");
    const timesGrid = form.querySelector(".times-grid");

    if (!dateInput.value) {
        isValid = false;
        calendarGrid?.classList.add("calendar-error");
        if (!firstInvalidEl) firstInvalidEl = calendarGrid;
    } else {
        calendarGrid?.classList.remove("calendar-error");
    }

    if (!timeInput.value) {
        isValid = false;
        timesGrid?.classList.add("times-error");
        if (!firstInvalidEl) firstInvalidEl = timesGrid;
    } else {
        timesGrid?.classList.remove("times-error");
    }

    const insuranceInput = form.querySelector("#has_insurance");
    if (insuranceInput) {
        const toggleGroup = insuranceInput.closest(".toggle-group");
        if (!insuranceInput.value) {
            isValid = false;
            toggleGroup?.classList.add("toggle-error");
            if (!firstInvalidEl) firstInvalidEl = toggleGroup;
        } else {
            toggleGroup?.classList.remove("toggle-error");
        }
    }

    if (firstInvalidEl) {
        firstInvalidEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return isValid;
}

function attachLiveValidation(form) {
    const requiredFields = form.querySelectorAll(
        "input[required]:not([type=hidden]), select[required]"
    );
    requiredFields.forEach((field) => {
        const clear = () => {
            if (field.value && field.value.trim()) {
                field.classList.remove("field-error");
            }
        };
        field.addEventListener("input", clear);
        field.addEventListener("change", clear);
    });
}

// ============= RESET =============
function resetBookingForm(form) {
    form.reset();

    form.querySelectorAll(".day-cell.selected").forEach((cell) => {
        cell.classList.remove("selected");
        cell.classList.add("available");
    });
    form.querySelector(".appt-date-input").value = "";
    form.querySelector(".appt-time-input").value = "";

    const timesGrid = form.querySelector(".times-grid");
    if(timesGrid) {
        timesGrid.classList.add("times-disabled");
        timesGrid.classList.remove("times-error");
        timesGrid.innerHTML = ""; // Clears the dynamic buttons!
    }
    form.querySelector(".times-hint").textContent = "Select a highlighted date to see open times.";

    const insuranceInput = form.querySelector("#has_insurance");
    if (insuranceInput) {
        insuranceInput.value = "";
        form.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("active"));
        insuranceInput.closest(".toggle-group")?.classList.remove("toggle-error");
    }

    form.querySelectorAll(".field-error").forEach((el) => el.classList.remove("field-error"));
    form.querySelector(".calendar-grid")?.classList.remove("calendar-error");
}

// ============= FORM SUBMIT HANDLERS (SUPABASE) =============

// 1. RECRUITMENT (AGENT) FUNNEL
window.agentForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    // ==========================================
    // CLOUDFLARE TURNSTILE SECURITY CHECK
    // ==========================================
    const formData = new FormData(e.target);
    const turnstileResponse = formData.get('cf-turnstile-response');

    if (!turnstileResponse) {
        alert("Security Check Failed: Please verify you are human before submitting.");
        return; // Kills the function instantly
    }
    if (!validateForm(window.agentForm)) return;

    const submitBtn = window.agentForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
        const leadData = {
            full_name: window.agentForm.querySelector("input[name='full_name']").value,
            email: window.agentForm.querySelector("input[name='email']").value,
            mobile_number: window.agentForm.querySelector("input[name='mobile']").value,
            track: "future_advisor", 
            source: "Website Funnel",
            current_stage: "new",
            date_of_birth: window.agentForm.querySelector("input[name='dob']")?.value || null
        };

        const { data: lead, error: leadError } = await supabaseClient
            .from("leads")
            .insert([leadData])
            .select()
            .single();

			if (leadError) {
			if (leadError.code === '23505') {
				alert("Hold up! It looks like you've already registered with this email address.");
				
				
				submitBtn.disabled = false; 
				submitBtn.textContent = "Confirm My Slot"; 
				
				return; // Stops the script completely
			}
			throw leadError; 
		}

			
		if (leadError) {
			if (leadError.code === '23505') {
				alert("Hold up! It looks like you've already registered with this email address.");
				
				
				submitBtn.disabled = false; 
				submitBtn.textContent = "Confirm My Slot"; 
				
				return; // Stops the script completely
			}
			throw leadError; 
		}

        if (leadError) throw leadError;

        const recruitData = {
            lead_id: lead.lead_id, 
            area_of_residence: window.agentForm.querySelector("input[name='residence']").value,
            university_college: window.agentForm.querySelector("input[name='university']").value,
            degree: window.agentForm.querySelector("input[name='degree']").value,
            area_of_employment: window.agentForm.querySelector("input[name='employment_field']").value,
            work_experience: window.agentForm.querySelector("input[name='work_exp']").value,
            years_working: parseInt(window.agentForm.querySelector("input[name='years_working']").value) || 0,
            attended_byb_session: window.agentForm.querySelector("select[name='attended_byb']").value === 'yes'
        };

        const { error: profileError } = await supabaseClient
            .from("recruit_profile")
            .insert([recruitData]);

        if (profileError) throw profileError;

        const rawDate = window.agentForm.querySelector(".appt-date-input").value; 
        const apptDateObj = new Date(rawDate);
        const tzOffset = apptDateObj.getTimezoneOffset() * 60000;
        const dbDate = (new Date(apptDateObj - tzOffset)).toISOString().split('T')[0];
        
        const apptTime = window.agentForm.querySelector(".appt-time-input").value;
        const formattedTime24 = convert12HourTo24Hour(apptTime);

        const { data: slotData, error: slotError } = await supabaseClient
        .from('availability_slots')
        .select('slot_id')
        .eq('slot_date', dbDate)
        .eq('track', 'future_advisor')
        .eq('slot_time', formattedTime24)
        .eq('is_open', true)
        .single();

        if (slotError || !slotData) throw new Error("Could not find an open slot for this date in the database.");

        const { error: appointmentError } = await supabaseClient
            .from('appointments')
            .insert([{
                lead_id: lead.lead_id,
                slot_id: slotData.slot_id,
                status: 'pending',
                admin_notes: `Time requested: ${apptTime}` 
            }]);

        if (appointmentError) throw appointmentError;

        alert("Success! Your Agent Career Preview slot has been reserved.");
        resetBookingForm(window.agentForm);

    } catch (error) {
        console.error("Supabase Error:", error);
        alert("Error saving booking. Please try again. Check console for details.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirm My Slot";
    }
});

// 2. CLIENT FUNNEL
window.clientForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    // ==========================================
    // CLOUDFLARE TURNSTILE SECURITY CHECK
    // ==========================================
    const formData = new FormData(e.target);
    const turnstileResponse = formData.get('cf-turnstile-response');

    if (!turnstileResponse) {
        alert("Security Check Failed: Please verify you are human before submitting.");
        return; // Kills the function instantly
    }
    if (!validateForm(window.clientForm)) return;

    const submitBtn = window.clientForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
        const leadData = {
            full_name: window.clientForm.querySelector("input[name='full_name']").value,
            email: window.clientForm.querySelector("input[name='email']").value,
            mobile_number: window.clientForm.querySelector("input[name='mobile']").value,
            track: "future_client",
            source: "Website Funnel",
            current_stage: "new",
            date_of_birth: window.clientForm.querySelector("input[name='dob']")?.value || null
        };

        const { data: lead, error: leadError } = await supabaseClient
            .from("leads")
            .insert([leadData])
            .select()
            .single();

			if (leadError) {
			if (leadError.code === '23505') {
				alert("Hold up! It looks like you've already registered with this email address.");
				
				
				submitBtn.disabled = false; 
				submitBtn.textContent = "Confirm My Slot"; 
				
				return; // Stops the script completely
			}
			throw leadError; 
		}

        if (leadError) throw leadError;

        const insuranceInput = window.clientForm.querySelector("#has_insurance") ? window.clientForm.querySelector("#has_insurance").value : "";
        let hasInsuranceBool = null;
        if (insuranceInput === "yes") hasInsuranceBool = true;
        if (insuranceInput === "no") hasInsuranceBool = false;

        const clientData = {
            lead_id: lead.lead_id,
            has_life_insurance: hasInsuranceBool,
            current_employment: window.clientForm.querySelector("input[name='employment']").value,
            marital_status: window.clientForm.querySelector("input[name='marital_status']").value,
            no_of_dependents: parseInt(window.clientForm.querySelector("input[name='dependents']").value) || 0,
            monthly_budget: parseFloat(window.clientForm.querySelector("input[name='budget']").value.replace(/[^0-9.-]+/g,"")) || 0,
            area_of_residence: window.clientForm.querySelector("input[name='residence']").value,
        };

        const { error: profileError } = await supabaseClient
            .from("client_profile")
            .insert([clientData]);

        if (profileError) throw profileError;

        const rawDate = window.clientForm.querySelector(".appt-date-input").value; 
        const apptDateObj = new Date(rawDate);
        const tzOffset = apptDateObj.getTimezoneOffset() * 60000;
        const dbDate = (new Date(apptDateObj - tzOffset)).toISOString().split('T')[0];
        
        const apptTime = window.clientForm.querySelector(".appt-time-input").value;
        const formattedTime24 = convert12HourTo24Hour(apptTime);

        const { data: slotData, error: slotError } = await supabaseClient
        .from('availability_slots')
        .select('slot_id')
        .eq('slot_date', dbDate)
        .eq('track', 'future_client')
        .eq('slot_time', formattedTime24)
        .eq('is_open', true)
        .single();

        if (slotError || !slotData) throw new Error("Could not find an open slot for this date in the database.");

        const { error: appointmentError } = await supabaseClient
            .from('appointments')
            .insert([{
                lead_id: lead.lead_id,
                slot_id: slotData.slot_id,
                status: 'pending',
                admin_notes: `Time requested: ${apptTime}` 
            }]);

        if (appointmentError) throw appointmentError;

        alert("Success! Your Financial Conversation slot has been reserved.");
        resetBookingForm(window.clientForm);

    } catch (error) {
        console.error("Supabase Error:", error);
        alert("Error saving booking. Please try again. Check console for details.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirm My Slot";
    }
});

// ============= INIT =============
document.querySelectorAll(".booking-form").forEach((form) => {
    attachLiveValidation(form);
});

async function initializeCalendars() {
    const agentDates = await fetchAvailableDates('future_advisor');
    const clientDates = await fetchAvailableDates('future_client');
    
    renderCalendar(window.agentForm, agentDates);
    renderCalendar(window.clientForm, clientDates);
}

initializeCalendars();