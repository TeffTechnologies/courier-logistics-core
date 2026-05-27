const Database = require('better-sqlite3');
const db = new Database('courier.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS stops (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE,
    lat REAL,
    lng REAL,
    route_order INTEGER,
    is_flagged BOOLEAN DEFAULT 0,
    is_visited BOOLEAN DEFAULT 0,
    arrival_time DATETIME
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY,
    phone_number TEXT,
    stop_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS route_history (
    id INTEGER PRIMARY KEY,
    date TEXT,
    location_name TEXT,
    was_flagged BOOLEAN,
    arrival_time TEXT
  );
`);

const locations = [
  ['MSD: Start', 38.63047928077876, -90.21520019117548, 1],
  ['DEC', 38.67699302842445, -90.19435068626728, 2], 
  ['Bissell Pump', 38.67473314050265, -90.1943345204317, 3],
  ['Bissel TP', 38.67401232646086, -90.19491835467207, 4],
  ['Mintert', 38.736164030720374, -90.29190574009263, 5],
  ['Cold Water', 38.81249577971514, -90.26882628568998, 6],
  ['Missouri River', 38.73770845963484, -90.48937750509643, 7],
  ['Grand Glaize Pump', 38.56019918536918, -90.47382963748042, 8],
  ['Grand Glaize TP', 38.561946062001915, -90.4716925197502, 9],
  ['Lower Meramec', 38.41617300314983, -90.33942902143438, 10], // Radius should be larger here
  ['Lemay TP', 38.53326272352995, -90.26899371872153, 11],
  ['Lemay Pump', 38.54295325596668, -90.26856632361287, 12],
  ['Sulfur Yard', 38.62105404894554, -90.28646001664981, 13],
  ['MSD: End', 38.63047928077876, -90.21520019117548, 14],
];

const insert = db.prepare('INSERT OR IGNORE INTO stops (name, lat, lng, route_order) VALUES (?, ?, ?, ?)');
locations.forEach(loc => insert.run(loc));

module.exports = db;