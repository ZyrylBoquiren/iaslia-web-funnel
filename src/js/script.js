// ============= SUPABASE INITIALIZATION =============
// 
const SUPABASE_URL = "https://refufwvilgtgqpcnejhs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlZnVmd3ZpbGd0Z3FwY25lamhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4Nzk4MTMsImV4cCI6MjEwMDQ1NTgxM30.lPL_AWB1uMHS8Bac7jNtuPJJD7FUDpPNiuP0J7v6DII";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============= FORM REFERENCES =============
const agentForm = document.getElementById("appointment-form");
const clientForm = document.getElementById("client-appointment-form");

// ============= TRACK SWITCHING =============
function switchTrack(trackType) {
	const agentContainer = document.getElementById("agent-form-container");
	const clientContainer = document.getElementById("client-form-container");
	const bookingSection = document.getElementById("booking-section");

	agentContainer.classList.toggle("hidden", trackType === "client");
	clientContainer.classList.toggle("hidden", trackType === "agent");

	bookingSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ============= AVAILABLE DATES (hardcoded for now) =============
const AGENT_AVAILABLE_DATES = [
	"2026-8-3", "2026-8-6", "2026-8-10", "2026-8-13",
	"2026-8-17", "2026-8-20", "2026-8-24", "2026-8-27", "2026-8-31",
];
const CLIENT_AVAILABLE_DATES = [
	"2026-8-3", "2026-8-6", "2026-8-10", "2026-8-13",
	"2026-8-17", "2026-8-20", "2026-8-24", "2026-8-27", "2026-8-31",
];

// ============= DYNAMIC CALENDAR =============
const calendarState = new WeakMap(); 
const calendarDates = new WeakMap(); 

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
	title.textContent = `${monthNames[month]} ${year}`;

	const firstWeekday = new Date(year, month, 1).getDay(); 
	const daysInMonth = new Date(year, month + 1, 0).getDate();

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	grid.innerHTML = "";

	for (let i = 0; i < firstWeekday; i++) {
		const empty = document.createElement("div");
		empty.className = "day-cell empty";
		grid.appendChild(empty);
	}

	for (let day = 1; day <= daysInMonth; day++) {
		const cellDate = new Date(year, month, day);
		const dateKey = `${year}-${month + 1}-${day}`;
		const fullDateLabel = `${monthNames[month]} ${day}, ${year}`;

		const cell = document.createElement("div");
		cell.textContent = day;
		cell.dataset.fullDate = fullDateLabel;

		const isPast = cellDate < today;
		const isAvailable = availableDates.includes(dateKey);
		const isSelected = dateInput.value === fullDateLabel;

		if (isPast || !isAvailable) {
			cell.className = "day-cell unavailable";
		} else if (isSelected) {
			cell.className = "day-cell selected";
		} else {
			cell.className = "day-cell available";
		}

		grid.appendChild(cell);
	}

	attachDayCellListeners(form);
}

function changeMonth(form, direction) {
	const state = calendarState.get(form);
	state.month += direction;
	if (state.month > 11) { state.month = 0; state.year++; }
	if (state.month < 0) { state.month = 11; state.year--; }

	const availableDates = calendarDates.get(form) || [];
	renderCalendar(form, availableDates);
}

function attachDayCellListeners(form) {
	const dayCells = form.querySelectorAll(".day-cell.available, .day-cell.selected");
	const dateInput = form.querySelector(".appt-date-input");
	const timesHint = form.querySelector(".times-hint");
	const timesGrid = form.querySelector(".times-grid");

	dayCells.forEach((cell) => {
		cell.addEventListener("click", () => {
			dayCells.forEach((c) => {
				c.classList.remove("selected");
				c.classList.add("available");
			});
			cell.classList.remove("available");
			cell.classList.add("selected");

			if (dateInput) dateInput.value = cell.dataset.fullDate;
			if (timesHint) timesHint.textContent = "Choose a time for " + cell.dataset.fullDate + ".";
			if (timesGrid) {
				timesGrid.classList.remove("times-disabled");
				timesGrid.classList.remove("times-error");
			}
			form.querySelector(".calendar-grid").classList.remove("calendar-error");
		});
	});
}

// ============= TIME BUTTONS =============
function initTimeButtons(form) {
	const buttons = form.querySelectorAll(".time-btn");
	const timeInput = form.querySelector(".appt-time-input");

	buttons.forEach((btn) => {
		btn.addEventListener("click", () => {
			buttons.forEach((b) => b.classList.remove("selected"));
			btn.classList.add("selected");
			if (timeInput) timeInput.value = btn.textContent.trim();
			form.querySelector(".times-grid").classList.remove("times-error");
		});
	});
}

// ============= YES/NO TOGGLE =============
function selectToggle(button, hiddenInputId, value) {
	document.getElementById(hiddenInputId).value = value;
	button.parentElement
		.querySelectorAll(".toggle-btn")
		.forEach((b) => b.classList.remove("active"));
	button.classList.add("active");
	button.closest(".toggle-group").classList.remove("toggle-error");
}

// ============= VALIDATION =============
function validateForm(form) {
	let isValid = true;
	let firstInvalidEl = null;

	const requiredFields = form.querySelectorAll(
		"input[required]:not([type=hidden]), select[required]",
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
		calendarGrid.classList.add("calendar-error");
		if (!firstInvalidEl) firstInvalidEl = calendarGrid;
	} else {
		calendarGrid.classList.remove("calendar-error");
	}

	if (!timeInput.value) {
		isValid = false;
		timesGrid.classList.add("times-error");
		if (!firstInvalidEl) firstInvalidEl = timesGrid;
	} else {
		timesGrid.classList.remove("times-error");
	}

	const insuranceInput = form.querySelector("#has_insurance");
	if (insuranceInput) {
		const toggleGroup = insuranceInput.closest(".toggle-group");
		if (!insuranceInput.value) {
			isValid = false;
			toggleGroup.classList.add("toggle-error");
			if (!firstInvalidEl) firstInvalidEl = toggleGroup;
		} else {
			toggleGroup.classList.remove("toggle-error");
		}
	}

	if (firstInvalidEl) {
		firstInvalidEl.scrollIntoView({ behavior: "smooth", block: "center" });
	}

	return isValid;
}

function attachLiveValidation(form) {
	const requiredFields = form.querySelectorAll(
		"input[required]:not([type=hidden]), select[required]",
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
	timesGrid.classList.add("times-disabled");
	timesGrid.classList.remove("times-error");
	form.querySelectorAll(".time-btn").forEach((b) => b.classList.remove("selected"));
	form.querySelector(".times-hint").textContent = "Select a highlighted date to see open times.";

	const insuranceInput = form.querySelector("#has_insurance");
	if (insuranceInput) {
		insuranceInput.value = "";
		form.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("active"));
		insuranceInput.closest(".toggle-group").classList.remove("toggle-error");
	}

	form.querySelectorAll(".field-error").forEach((el) => el.classList.remove("field-error"));
	form.querySelector(".calendar-grid").classList.remove("calendar-error");
}

// ============= FORM SUBMIT HANDLERS (SUPABASE) =============

// 1. RECRUITMENT (AGENT) FUNNEL
agentForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!validateForm(agentForm)) return;

    const submitBtn = agentForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
        const leadData = {
            full_name: agentForm.querySelector("input[name='full_name']").value,
            email: agentForm.querySelector("input[name='email']").value,
            mobile_number: agentForm.querySelector("input[name='mobile']").value,
            track: "future_advisor", 
            source: "Website Funnel",
            current_stage: "new"
        };

        const { data: lead, error: leadError } = await supabaseClient
            .from("leads")
            .insert([leadData])
            .select()
            .single();

        if (leadError) throw leadError;

        const recruitData = {
            lead_id: lead.lead_id, 
            area_of_residence: agentForm.querySelector("input[name='residence']").value,
			university_college: agentForm.querySelector("input[name='university']").value,
			degree: agentForm.querySelector("input[name='degree']").value,
			area_of_employment: agentForm.querySelector("input[name='employment_field']").value,
			work_experience: agentForm.querySelector("input[name='work_exp']").value,
			years_working: parseInt(agentForm.querySelector("input[name='years_working']").value) || 0,
			attended_byb_session: agentForm.querySelector("select[name='attended_byb']").value === 'yes'
        };

        const { error: profileError } = await supabaseClient
            .from("recruit_profile")
            .insert([recruitData]);

        if (profileError) throw profileError;

        alert("Success! Your Agent Career Preview slot has been reserved.");
        resetBookingForm(agentForm);

    } catch (error) {
        console.error("Supabase Error:", error);
        alert("Error saving booking. Please try again. Check console for details.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirm My Slot";
    }
});

// 2. CLIENT FUNNEL
clientForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!validateForm(clientForm)) return;

    const submitBtn = clientForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting...";

    try {
        const leadData = {
            full_name: clientForm.querySelector("input[name='full_name']").value,
            email: clientForm.querySelector("input[name='email']").value,
            mobile_number: clientForm.querySelector("input[name='mobile']").value,
            track: "future_client",
            source: "Website Funnel",
            current_stage: "new"
        };

        const { data: lead, error: leadError } = await supabaseClient
            .from("leads")
            .insert([leadData])
            .select()
            .single();

        if (leadError) throw leadError;

        const insuranceInput = clientForm.querySelector("#has_insurance") ? clientForm.querySelector("#has_insurance").value : "";
        let hasInsuranceBool = null;
        if (insuranceInput === "yes") hasInsuranceBool = true;
        if (insuranceInput === "no") hasInsuranceBool = false;

        const clientData = {
            lead_id: lead.lead_id, 
            has_life_insurance: hasInsuranceBool,
			current_employment: clientForm.querySelector("input[name='employment']").value,
			marital_status: clientForm.querySelector("input[name='marital_status']").value,
			no_of_dependents: parseInt(clientForm.querySelector("input[name='dependents']").value) || 0,
			monthly_budget: parseFloat(clientForm.querySelector("input[name='budget']").value.replace(/[^0-9.-]+/g,"")) || 0
        };

        const { error: profileError } = await supabaseClient
            .from("client_profile")
            .insert([clientData]);

        if (profileError) throw profileError;

        alert("Success! Your Financial Conversation slot has been reserved.");
        resetBookingForm(clientForm);

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
	initTimeButtons(form);
	attachLiveValidation(form);
});

renderCalendar(agentForm, AGENT_AVAILABLE_DATES);
renderCalendar(clientForm, CLIENT_AVAILABLE_DATES);