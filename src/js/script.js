

// Demo Submission
// document
// 	.getElementById("appointment-form")
// 	.addEventListener("submit", function (e) {
// 		e.preventDefault();
// 		alert(
// 			"Success! (Demo Mode): Your Agent Career Preview slot has been reserved.",
// 		);
// 	});
// document
// 	.getElementById("client-appointment-form")
// 	.addEventListener("submit", function (e) {
// 		e.preventDefault();
// 		alert(
// 			"Success! (Demo Mode): Your Financial Conversation slot has been reserved.",
// 		);
// 	});

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
// Format: "YYYY-M-D" (no leading zeros needed)
// Remove this to fetch actual data from the backend

const AGENT_AVAILABLE_DATES = [
	"2026-8-3", "2026-8-6", "2026-8-10", "2026-8-13",
	"2026-8-17", "2026-8-20", "2026-8-24", "2026-8-27", "2026-8-31",
];
const CLIENT_AVAILABLE_DATES = [
	"2026-8-3", "2026-8-6", "2026-8-10", "2026-8-13",
	"2026-8-17", "2026-8-20", "2026-8-24", "2026-8-27", "2026-8-31",
];


// ============= TRACK SWITCHING =============
function switchTrack(trackType) {
	const agentContainer = document.getElementById("agent-form-container");
	const clientContainer = document.getElementById("client-form-container");
	const bookingSection = document.getElementById("booking-section");

	agentContainer.classList.toggle("hidden", trackType === "client");
	clientContainer.classList.toggle("hidden", trackType === "agent");

	bookingSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ============= DYNAMIC CALENDAR =============
const calendarState = new WeakMap(); // tracks each form's currently-viewed month/year
const calendarDates = new WeakMap(); // tracks each form's available-dates list

function renderCalendar(form, availableDates) {
	calendarDates.set(form, availableDates);

	const grid = form.querySelector(".calendar-grid");
	const title = form.querySelector(".calendar-title");
	const dateInput = form.querySelector(".appt-date-input");

	let state = calendarState.get(form);
	if (!state) {
		const today = new Date();
		state = { year: today.getFullYear(), month: today.getMonth() }; // month is 0-indexed
		calendarState.set(form, state);
	}

	const { year, month } = state;
	const monthNames = [
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December",
	];
	title.textContent = `${monthNames[month]} ${year}`;

	const firstWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
	const daysInMonth = new Date(year, month + 1, 0).getDate();

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	grid.innerHTML = "";

	// Empty leading cells so day 1 lands on the correct weekday column
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

// Click handling for calendar day cells (re-attached every time the grid re-renders)
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

	// Standard required text/email/tel/date/number/select fields
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

	// Date + time (hidden inputs, checked manually since hidden fields can't use native validation)
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

	// Client form only: insurance Yes/No toggle
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

	// Show/hide the top-of-form error banner
	const summary = form.querySelector(".form-error-summary");
	if (summary) summary.classList.toggle("show", !isValid);

	if (firstInvalidEl) {
		firstInvalidEl.scrollIntoView({ behavior: "smooth", block: "center" });
	}

	return isValid;
}

// Live-clear a field's red border as soon as the user starts fixing it
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

	// Clear calendar selection back to "available" (nothing selected)
	form.querySelectorAll(".day-cell.selected").forEach((cell) => {
		cell.classList.remove("selected");
		cell.classList.add("available");
	});
	form.querySelector(".appt-date-input").value = "";
	form.querySelector(".appt-time-input").value = "";

	// Disable + reset the time picker until a new date is chosen
	const timesGrid = form.querySelector(".times-grid");
	timesGrid.classList.add("times-disabled");
	timesGrid.classList.remove("times-error");
	form.querySelectorAll(".time-btn").forEach((b) => b.classList.remove("selected"));
	form.querySelector(".times-hint").textContent = "Select a highlighted date to see open times.";

	// Reset any Yes/No toggle
	const insuranceInput = form.querySelector("#has_insurance");
	if (insuranceInput) {
		insuranceInput.value = "";
		form.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("active"));
		insuranceInput.closest(".toggle-group").classList.remove("toggle-error");
	}

	// Clear any leftover error highlighting
	form.querySelectorAll(".field-error").forEach((el) => el.classList.remove("field-error"));
	form.querySelector(".calendar-grid").classList.remove("calendar-error");

	const summary = form.querySelector(".form-error-summary");
	if (summary) summary.classList.remove("show");
}

// ============= FORM SUBMIT HANDLERS =============
agentForm.addEventListener("submit", function (e) {
	e.preventDefault();
	if (!validateForm(agentForm)) return;
	resetBookingForm(agentForm);
});

clientForm.addEventListener("submit", function (e) {
	e.preventDefault();
	if (!validateForm(clientForm)) return;
	resetBookingForm(clientForm);
});

// ============= INIT =============
document.querySelectorAll(".booking-form").forEach((form) => {
	initTimeButtons(form);
	attachLiveValidation(form);
});

renderCalendar(agentForm, AGENT_AVAILABLE_DATES);
renderCalendar(clientForm, CLIENT_AVAILABLE_DATES);