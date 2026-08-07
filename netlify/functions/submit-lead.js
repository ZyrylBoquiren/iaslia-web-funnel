exports.handler = async (event) => {
    // 1. Only allow POST requests (Reject snooping browsers)
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // 2. Grab the Master Key we just saved in Netlify
    const SUPABASE_URL = 'https://refufwvilgtgqpcnejhs.supabase.co';
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; 
    
    if (!SUPABASE_SERVICE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error.' }) };
    }

    try {
        // 3. Unpack the data sent by your frontend
        const payload = JSON.parse(event.body);
        const { leadData, profileData, appointmentData } = payload;

        // --- HELPER: The Universal "Master Key" Headers ---
        const headers = {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation' // Forces Supabase to hand the data back after inserting
        };

        // ==========================================
        // STEP A: INSERT LEAD
        // ==========================================
        const leadRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(leadData)
        });
        const leadResponseData = await leadRes.json();
        
        // Catch duplicate emails (Error 23505)
        if (!leadRes.ok) {
            if (leadResponseData.code === '23505') {
                return { statusCode: 409, body: JSON.stringify({ error: 'Email already exists' }) };
            }
            throw new Error(leadResponseData.message || 'Failed to insert lead');
        }
        
        const leadId = leadResponseData[0].lead_id;

        // ==========================================
        // STEP B: INSERT PROFILE
        // ==========================================
        profileData.lead_id = leadId; 
        const targetTable = leadData.track === 'future_advisor' ? 'recruit_profile' : 'client_profile';
        
        const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/${targetTable}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(profileData)
        });
        if (!profileRes.ok) throw new Error('Failed to insert profile');

        // ==========================================
        // STEP C: FIND OPEN SLOT & BOOK IT
        // ==========================================
        // 1. Search for the specific slot ID
        const slotQuery = new URLSearchParams({
            slot_date: `eq.${appointmentData.dbDate}`,
            track: `eq.${leadData.track}`,
            slot_time: `eq.${appointmentData.formattedTime24}`,
            is_open: 'eq.true',
            select: 'slot_id'
        });
        
        const slotRes = await fetch(`${SUPABASE_URL}/rest/v1/availability_slots?${slotQuery.toString()}`, {
            method: 'GET',
            headers: headers
        });
        const slotData = await slotRes.json();
        
        if (!slotRes.ok || slotData.length === 0) {
            throw new Error("Could not find an open slot for this date.");
        }

        // 2. Book the Appointment
        const appointmentRes = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                lead_id: leadId,
                slot_id: slotData[0].slot_id,
                status: 'pending',
                admin_notes: appointmentData.adminNotes
            })
        });
        if (!appointmentRes.ok) throw new Error('Failed to save appointment');

        // ==========================================
        // STEP D: SUCCESS!
        // ==========================================
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Successfully booked!" })
        };

    } catch (error) {
        console.error("Backend Error:", error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message || "Internal Server Error" }) 
        };
    }
};