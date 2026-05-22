import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_FILE || path.join(__dirname, '..', 'hostel.db');

let dbInstance = null;

export async function getDb() {
  if (dbInstance) return dbInstance;

  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Enable foreign key constraints
  await dbInstance.exec('PRAGMA foreign_keys = ON;');

  return dbInstance;
}

export async function initDb() {
  const db = await getDb();

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'warden', 'maintenance', 'admin')),
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      academic_details TEXT
    );

    CREATE TABLE IF NOT EXISTS hostel_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number TEXT UNIQUE NOT NULL,
      block_name TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      room_type TEXT NOT NULL CHECK(room_type IN ('Single', 'Double', 'Triple')),
      occupancy_status TEXT NOT NULL DEFAULT 'Available' CHECK(occupancy_status IN ('Available', 'Full'))
    );

    CREATE TABLE IF NOT EXISTS room_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      room_id INTEGER NOT NULL REFERENCES hostel_rooms(id) ON DELETE CASCADE,
      allocation_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Transferred', 'Vacated')),
      roommate_preference TEXT
    );

    CREATE TABLE IF NOT EXISTS complaint_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES complaint_categories(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS maintenance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status_before TEXT NOT NULL,
      status_after TEXT NOT NULL,
      action_taken TEXT NOT NULL,
      logged_at TEXT NOT NULL
    );
  `);

  console.log('Database tables verified/created successfully.');

  // Seed default data if empty
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    console.log('Database is empty. Seeding initial test data...');

    // Seed Users
    await db.run(`
      INSERT INTO users (username, role, full_name, email, academic_details) VALUES
      ('admin', 'admin', 'Super Administrator', 'admin@hostel.edu', 'Hostel Operations Dept'),
      ('warden_alice', 'warden', 'Alice Jenkins (Warden A)', 'alice.j@hostel.edu', 'Warden - Block A'),
      ('warden_bob', 'warden', 'Bob Martinez (Warden B)', 'bob.m@hostel.edu', 'Warden - Block B'),
      ('maint_elec', 'maintenance', 'Electrician Dan', 'dan.elec@hostel.edu', 'Specialization: Electricity'),
      ('maint_plumb', 'maintenance', 'Plumber Paul', 'paul.plumb@hostel.edu', 'Specialization: Water & Plumbing'),
      ('student_john', 'student', 'John Doe', 'john.doe@student.edu', 'Roll: 2024CS01, B.Tech CSE, 2nd Year'),
      ('student_jane', 'student', 'Jane Smith', 'jane.smith@student.edu', 'Roll: 2024EC14, B.Tech ECE, 2nd Year'),
      ('student_alex', 'student', 'Alex Wong', 'alex.wong@student.edu', 'Roll: 2024ME08, B.Tech Mech, 2nd Year'),
      ('student_lisa', 'student', 'Lisa Vance', 'lisa.vance@student.edu', 'Roll: 2024EE22, B.Tech EEE, 2nd Year')
    `);

    // Seed Hostel Rooms
    await db.run(`
      INSERT INTO hostel_rooms (room_number, block_name, capacity, room_type, occupancy_status) VALUES
      ('101', 'Block A', 1, 'Single', 'Available'),
      ('102', 'Block A', 2, 'Double', 'Available'),
      ('103', 'Block A', 2, 'Double', 'Available'),
      ('201', 'Block B', 1, 'Single', 'Available'),
      ('202', 'Block B', 3, 'Triple', 'Available'),
      ('203', 'Block B', 2, 'Double', 'Available')
    `);

    // Seed Complaint Categories
    await db.run(`
      INSERT INTO complaint_categories (name) VALUES
      ('Electricity'),
      ('Water'),
      ('Cleanliness'),
      ('Internet'),
      ('Maintenance')
    `);

    // Fetch rooms and students to seed active allocations
    const john = await db.get("SELECT id FROM users WHERE username = 'student_john'");
    const jane = await db.get("SELECT id FROM users WHERE username = 'student_jane'");
    const alex = await db.get("SELECT id FROM users WHERE username = 'student_alex'");
    
    const r102 = await db.get("SELECT id FROM hostel_rooms WHERE room_number = '102'");
    const r103 = await db.get("SELECT id FROM hostel_rooms WHERE room_number = '103'");

    const todayStr = new Date().toISOString().split('T')[0];

    // Seed room allocations
    // John in 102
    await db.run(`
      INSERT INTO room_allocations (student_id, room_id, allocation_date, status, roommate_preference)
      VALUES (?, ?, ?, 'Active', 'None')
    `, [john.id, r102.id, todayStr]);

    // Jane and Alex in 103
    await db.run(`
      INSERT INTO room_allocations (student_id, room_id, allocation_date, status, roommate_preference)
      VALUES (?, ?, ?, 'Active', 'Alex Wong')
    `, [jane.id, r103.id, todayStr]);

    await db.run(`
      INSERT INTO room_allocations (student_id, room_id, allocation_date, status, roommate_preference)
      VALUES (?, ?, ?, 'Active', 'Jane Smith')
    `, [alex.id, r103.id, todayStr]);

    // Update room occupancy status based on capacity
    // Room 102: capacity 2, occupied 1 -> Available
    // Room 103: capacity 2, occupied 2 -> Full
    await db.run(`
      UPDATE hostel_rooms SET occupancy_status = 'Full' WHERE id = ?
    `, [r103.id]);

    // Seed initial complaints
    const categoryWater = await db.get("SELECT id FROM complaint_categories WHERE name = 'Water'");
    const categoryElec = await db.get("SELECT id FROM complaint_categories WHERE name = 'Electricity'");
    const categoryInternet = await db.get("SELECT id FROM complaint_categories WHERE name = 'Internet'");

    // Water complaint for John (Open)
    await db.run(`
      INSERT INTO complaints (student_id, category_id, description, status, created_at, updated_at)
      VALUES (?, ?, 'Water tap is dripping continuously in room bathroom, causing water wastage.', 'Open', ?, ?)
    `, [john.id, categoryWater.id, todayStr, todayStr]);

    // Electricity complaint for Jane (In Progress)
    const elecComplaint = await db.run(`
      INSERT INTO complaints (student_id, category_id, description, status, created_at, updated_at)
      VALUES (?, ?, 'The ceiling fan in our room runs extremely slowly and makes a loud squeaking sound.', 'In Progress', ?, ?)
    `, [jane.id, categoryElec.id, todayStr, todayStr]);

    const elecComplaintId = elecComplaint.lastID;
    const maintElec = await db.get("SELECT id FROM users WHERE username = 'maint_elec'");

    // Insert maintenance log for In Progress state
    await db.run(`
      INSERT INTO maintenance_logs (complaint_id, staff_id, status_before, status_after, action_taken, logged_at)
      VALUES (?, ?, 'Open', 'In Progress', 'Assigned to Electrician Dan. Inspected the fan, motor winding seems overheated. Ordered a replacement capacitor.', ?)
    `, [elecComplaintId, maintElec.id, todayStr]);

    // Seed a resolved complaint for Alex (Internet, Resolved)
    const netComplaint = await db.run(`
      INSERT INTO complaints (student_id, category_id, description, status, created_at, updated_at)
      VALUES (?, ?, 'WiFi keeps disconnecting every 5 minutes in Room 103.', 'Resolved', ?, ?)
    `, [alex.id, categoryInternet.id, todayStr, todayStr]);

    const netComplaintId = netComplaint.lastID;
    
    // Insert resolved log
    await db.run(`
      INSERT INTO maintenance_logs (complaint_id, staff_id, status_before, status_after, action_taken, logged_at)
      VALUES (?, ?, 'In Progress', 'Resolved', 'Replaced the local router RJ-45 wall port connector and reset the DHCP lease. Stable connection verified.', ?)
    `, [netComplaintId, maintElec.id, todayStr]);

    console.log('Database successfully seeded!');
  }
}
