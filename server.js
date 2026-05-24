require('dotenv').config();
const express = require('express');
const db = require('./database');
const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
const app = express();

app.use(express.json());
app.use(express.static('public'));

// SECURITY MIDDLEWARE
const protect = (req, res, next) => {
    const token = req.query.token || req.headers['x-token'];
    if (token === process.env.ADMIN_PASSWORD) return next();
    res.status(401).send('Unauthorized');
};

// 1. API: Get All Stops (Used by all views)
app.get('/api/stops', (req, res) => {
    const stops = db.prepare('SELECT * FROM stops ORDER BY route_order ASC').all();
    res.json(stops);
});

// 2. API: User Flags Pickup
app.post('/api/scan', (req, res) => {
    const { stopId, phone } = req.body;
    db.prepare('UPDATE stops SET is_flagged = 1 WHERE id = ?').run(stopId);
    if (phone) db.prepare('INSERT INTO notifications (phone_number, stop_id) VALUES (?, ?)').run(phone, stopId);
    res.json({ success: true });
});

// 3. API: Courier GPS Ping
app.post('/api/courier/ping', async (req, res) => {
    const { lat, lng } = req.body;
    const threshold = 0.0005; // ~50 meter radius

    try {
        const stops = db.prepare('SELECT * FROM stops ORDER BY route_order ASC').all();
        if (stops.length === 0) return res.json({ status: "error", message: "No route layout seeded." });

        const startingStop = stops[0];                  
        const finalDropOffStop = stops[stops.length - 1]; 

        for (let stop of stops) {
            const dist = Math.sqrt(Math.pow(lat - stop.lat, 2) + Math.pow(lng - stop.lng, 2));
            
            if (dist < threshold) {
                if (!stop.is_visited) {
                    db.prepare('UPDATE stops SET is_visited = 1, arrival_time = CURRENT_TIMESTAMP WHERE id = ?').run(stop.id);
                    stop.is_visited = 1; 
                }
                
                if (stop.id === startingStop.id) {
                    const finalDropOffCurrentState = db.prepare('SELECT is_visited FROM stops WHERE id = ?').get(finalDropOffStop.id);

                    if (finalDropOffCurrentState && finalDropOffCurrentState.is_visited === 1) {
                        console.log(`[ROUTE LOOP] Driver returned to starting station (${startingStop.name}) after completing drop-offs. Flushing system...`);
                        await triggerEndRoute();
                        
                        return res.json({ 
                            status: "success", 
                            message: "Dynamic loop completed. State synchronized back to baseline." 
                        });
                    }
                }
            }
        }
        
        res.json({ status: "success" });
    } catch (error) {
        console.error("[CRITICAL] Ping processing exception caught:", error);
        res.status(500).json({ status: "error", message: "Internal telemetry processing error." });
    }
});

// API: Allows the courier terminal to clear data for a new day
app.post('/api/courier/reset-shift', (req, res) => {
    try {
        // Master reset action: Clear everything safely when the driver confirms
        db.prepare('UPDATE stops SET is_flagged = 0, is_visited = 0, arrival_time = NULL').run();
        db.prepare('DELETE FROM notifications').run();
        
        console.log("[SYSTEM] Driver initialized a new shift. Data flushed clean.");
        return res.json({ status: "success" });
    } catch (err) {
        console.error("[CRITICAL] Driver shift initialization failure:", err);
        res.status(500).json({ status: "error", message: "Database failure." });
    }
});

// 4. API: Manual Clear (Owner)
app.post('/api/admin/clear', protect, (req, res) => {
    db.prepare('UPDATE stops SET is_visited = 1, arrival_time = CURRENT_TIMESTAMP WHERE id = ?').run(req.body.id);
    res.json({ success: true });
});

// New API: Flush the boards and prepare the system for a fresh work day
app.post('/api/admin/reset-route', (req, res) => {
    const token = req.query.token;
    if (token !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ status: "error", message: "Unauthorized" });
    }

    try {
        db.prepare('UPDATE stops SET is_flagged = 0, is_visited = 0, arrival_time = NULL').run();
        db.prepare('DELETE FROM notifications').run();
        
        console.log("[SYSTEM] Active route data flushed. System prepared for next day.");
        res.json({ status: "success", message: "Database cleared for next shift." });
    } catch (err) {
        res.status(500).json({ status: "error", message: "Failed to reset database." });
    }
});

async function triggerEndRoute() {
    console.log("[LOGISTICS] Van arrived back at origin. Archiving run and notifying users...");

    const contacts = db.prepare('SELECT DISTINCT phone_number FROM notifications').all();
    
    for (let c of contacts) {
        try {
            await twilio.messages.create({
                body: 'Route Complete: The courier has completed the loop and returned to MSD.',
                from: process.env.TWILIO_PHONE,
                to: c.phone_number
            });
        } catch (e) { console.error("SMS Error", e); }
    }

    db.prepare(`
        INSERT INTO route_history (date, location_name, was_flagged, arrival_time) 
        SELECT DATE('now', 'localtime'), name, is_flagged, arrival_time FROM stops
    `).run();
}

app.listen(3000, () => console.log('Logistics Server Online'));