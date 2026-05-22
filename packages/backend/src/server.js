import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb, getDb } from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json());

// Beautiful and colored HTTP request logger middleware
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const methodStr = `[${req.method}]`;
    const statusColor = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : res.statusCode >= 300 ? '\x1b[36m' : '\x1b[32m';
    const resetColor = '\x1b[0m';
    const boldColor = '\x1b[1m';
    
    console.log(`${boldColor}[${timestamp}]${resetColor} ${methodStr} ${req.originalUrl} -> Status: ${statusColor}${res.statusCode}${resetColor} (${duration}ms)`);
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      console.log(`   └─ Body: ${JSON.stringify(req.body)}`);
    }
  });
  
  next();
});

// Initialize Database before starting the server
try {
  await initDb();
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

// ==========================================
// 1. USERS ENDPOINTS
// ==========================================

// Get all users (students, wardens, maintenance, admin)
app.get('/api/users', async (req, res) => {
  try {
    const db = await getDb();
    const role = req.query.role;
    let query = 'SELECT * FROM users';
    const params = [];

    if (role) {
      query += ' WHERE role = ?';
      params.push(role);
    }

    const users = await db.all(query, params);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});

// Create a new user (e.g., register student/staff)
app.post('/api/users', async (req, res) => {
  const { username, role, full_name, email, academic_details } = req.body;

  if (!username || !role || !full_name || !email) {
    return res.status(400).json({ error: 'Missing required fields: username, role, full_name, email' });
  }

  if (!['student', 'warden', 'maintenance', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be one of student, warden, maintenance, admin' });
  }

  try {
    const db = await getDb();
    
    // Check if username already exists
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: `Username '${username}' is already taken.` });
    }

    const result = await db.run(
      `INSERT INTO users (username, role, full_name, email, academic_details)
       VALUES (?, ?, ?, ?, ?)`,
      [username, role, full_name, email, academic_details || '']
    );

    const newUser = await db.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
});


// ==========================================
// 2. HOSTEL ROOMS ENDPOINTS
// ==========================================

// Create a new hostel room record
app.post('/api/hostel-rooms', async (req, res) => {
  const { room_number, block_name, capacity, room_type } = req.body;

  if (!room_number || !block_name || !capacity || !room_type) {
    return res.status(400).json({ error: 'Missing required fields: room_number, block_name, capacity, room_type' });
  }

  const parsedCapacity = parseInt(capacity, 10);
  if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
    return res.status(400).json({ error: 'Capacity must be a positive integer.' });
  }

  if (!['Single', 'Double', 'Triple'].includes(room_type)) {
    return res.status(400).json({ error: 'Room type must be Single, Double, or Triple.' });
  }

  try {
    const db = await getDb();

    // Check if room number already exists
    const existing = await db.get('SELECT id FROM hostel_rooms WHERE room_number = ?', [room_number]);
    if (existing) {
      return res.status(400).json({ error: `Room number '${room_number}' already exists.` });
    }

    const result = await db.run(
      `INSERT INTO hostel_rooms (room_number, block_name, capacity, room_type, occupancy_status)
       VALUES (?, ?, ?, ?, 'Available')`,
      [room_number, block_name, parsedCapacity, room_type]
    );

    const newRoom = await db.get('SELECT * FROM hostel_rooms WHERE id = ?', [result.lastID]);
    res.status(201).json(newRoom);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create hostel room', details: error.message });
  }
});

// List hostel rooms with filters, including active occupants list
app.get('/api/hostel-rooms', async (req, res) => {
  const { block_name, room_type, occupancy_status } = req.query;

  try {
    const db = await getDb();

    let query = 'SELECT * FROM hostel_rooms WHERE 1=1';
    const params = [];

    if (block_name) {
      query += ' AND block_name = ?';
      params.push(block_name);
    }
    if (room_type) {
      query += ' AND room_type = ?';
      params.push(room_type);
    }
    if (occupancy_status) {
      query += ' AND occupancy_status = ?';
      params.push(occupancy_status);
    }

    query += ' ORDER BY block_name ASC, room_number ASC';

    const rooms = await db.all(query, params);

    // Attach active occupants information to each room
    for (const room of rooms) {
      const occupants = await db.all(
        `SELECT u.id, u.full_name, u.email, u.academic_details, ra.id as allocation_id, ra.allocation_date, ra.roommate_preference
         FROM room_allocations ra
         JOIN users u ON ra.student_id = u.id
         WHERE ra.room_id = ? AND ra.status = 'Active'`,
        [room.id]
      );
      room.occupants = occupants;
      room.current_occupancy = occupants.length;
    }

    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list rooms', details: error.message });
  }
});


// ==========================================
// 3. ROOM ALLOCATIONS ENDPOINTS
// ==========================================

// Allocate room to student
app.post('/api/room-allocations', async (req, res) => {
  const { student_id, room_id, roommate_preference } = req.body;

  if (!student_id || !room_id) {
    return res.status(400).json({ error: 'Missing required fields: student_id, room_id' });
  }

  try {
    const db = await getDb();

    // 1. Verify student exists and is a student
    const student = await db.get('SELECT * FROM users WHERE id = ? AND role = ?', [student_id, 'student']);
    if (!student) {
      return res.status(404).json({ error: 'Student not found or user role is not student.' });
    }

    // 2. Prevent duplicate active allocations for the same student
    const activeAlloc = await db.get(
      "SELECT id FROM room_allocations WHERE student_id = ? AND status = 'Active'",
      [student_id]
    );
    if (activeAlloc) {
      return res.status(400).json({ error: 'Student already has an active room allocation. Transfer student instead.' });
    }

    // 3. Verify room exists
    const room = await db.get('SELECT * FROM hostel_rooms WHERE id = ?', [room_id]);
    if (!room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    // 4. Check capacity
    const occupancyCount = await db.get(
      "SELECT COUNT(*) as count FROM room_allocations WHERE room_id = ? AND status = 'Active'",
      [room_id]
    );
    if (occupancyCount.count >= room.capacity) {
      return res.status(400).json({ error: `Room ${room.room_number} has reached its maximum capacity of ${room.capacity} occupants.` });
    }

    // 5. Insert new allocation
    const todayStr = new Date().toISOString().split('T')[0];
    const result = await db.run(
      `INSERT INTO room_allocations (student_id, room_id, allocation_date, status, roommate_preference)
       VALUES (?, ?, ?, 'Active', ?)`,
      [student_id, room_id, todayStr, roommate_preference || '']
    );

    // 6. Update occupancy status in hostel_rooms
    const newOccupancyCount = occupancyCount.count + 1;
    if (newOccupancyCount >= room.capacity) {
      await db.run("UPDATE hostel_rooms SET occupancy_status = 'Full' WHERE id = ?", [room_id]);
    } else {
      await db.run("UPDATE hostel_rooms SET occupancy_status = 'Available' WHERE id = ?", [room_id]);
    }

    const newAlloc = await db.get(
      `SELECT ra.*, u.full_name, u.email, r.room_number, r.block_name
       FROM room_allocations ra
       JOIN users u ON ra.student_id = u.id
       JOIN hostel_rooms r ON ra.room_id = r.id
       WHERE ra.id = ?`,
      [result.lastID]
    );

    res.status(201).json(newAlloc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to allocate room', details: error.message });
  }
});

// Transfer student to another room
app.put('/api/room-allocations/:id/transfer', async (req, res) => {
  const allocationId = req.params.id;
  const { new_room_id } = req.body;

  if (!new_room_id) {
    return res.status(400).json({ error: 'Missing required field: new_room_id' });
  }

  try {
    const db = await getDb();

    // 1. Get original allocation
    const originalAlloc = await db.get(
      "SELECT * FROM room_allocations WHERE id = ? AND status = 'Active'",
      [allocationId]
    );
    if (!originalAlloc) {
      return res.status(404).json({ error: 'Active room allocation not found.' });
    }

    const { student_id, room_id: oldRoomId } = originalAlloc;

    if (parseInt(oldRoomId, 10) === parseInt(new_room_id, 10)) {
      return res.status(400).json({ error: 'Student is already allocated to this room. Cannot transfer to the same room.' });
    }

    // 2. Verify new room exists and has capacity
    const newRoom = await db.get('SELECT * FROM hostel_rooms WHERE id = ?', [new_room_id]);
    if (!newRoom) {
      return res.status(404).json({ error: 'Target room not found.' });
    }

    const newOccupancyCount = await db.get(
      "SELECT COUNT(*) as count FROM room_allocations WHERE room_id = ? AND status = 'Active'",
      [new_room_id]
    );
    if (newOccupancyCount.count >= newRoom.capacity) {
      return res.status(400).json({ error: `Target Room ${newRoom.room_number} is full (capacity ${newRoom.capacity}).` });
    }

    // 3. Perform transfer inside a transaction
    console.log(`[TRANSACTION] Starting transfer transaction for allocation ID: ${allocationId} to new room ID: ${new_room_id}`);
    await db.run('BEGIN TRANSACTION');

    try {
      // Mark old allocation as Transferred
      await db.run(
        "UPDATE room_allocations SET status = 'Transferred' WHERE id = ?",
        [allocationId]
      );

      // Create new allocation in target room
      const todayStr = new Date().toISOString().split('T')[0];
      await db.run(
        `INSERT INTO room_allocations (student_id, room_id, allocation_date, status, roommate_preference)
         VALUES (?, ?, ?, 'Active', ?)`,
        [student_id, new_room_id, todayStr, originalAlloc.roommate_preference || '']
      );

      // Update old room occupancy status
      const oldRoom = await db.get('SELECT * FROM hostel_rooms WHERE id = ?', [oldRoomId]);
      const oldRoomOccupants = await db.get(
        "SELECT COUNT(*) as count FROM room_allocations WHERE room_id = ? AND status = 'Active'",
        [oldRoomId]
      );
      if (oldRoomOccupants.count >= oldRoom.capacity) {
        await db.run("UPDATE hostel_rooms SET occupancy_status = 'Full' WHERE id = ?", [oldRoomId]);
      } else {
        await db.run("UPDATE hostel_rooms SET occupancy_status = 'Available' WHERE id = ?", [oldRoomId]);
      }

      // Update new room occupancy status
      const updatedNewOccupantsCount = newOccupancyCount.count + 1;
      if (updatedNewOccupantsCount >= newRoom.capacity) {
        await db.run("UPDATE hostel_rooms SET occupancy_status = 'Full' WHERE id = ?", [new_room_id]);
      } else {
        await db.run("UPDATE hostel_rooms SET occupancy_status = 'Available' WHERE id = ?", [new_room_id]);
      }

      await db.run('COMMIT');
      console.log(`[TRANSACTION] Transfer successfully committed for allocation ID: ${allocationId}`);

      res.json({ message: 'Student room transfer completed successfully.' });
    } catch (txError) {
      console.error(`[TRANSACTION ERROR] Transfer failed for allocation ID: ${allocationId}. Rolling back.`, txError);
      await db.run('ROLLBACK');
      throw txError;
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to transfer room', details: error.message });
  }
});

// List room allocations
app.get('/api/room-allocations', async (req, res) => {
  try {
    const db = await getDb();
    const allocations = await db.all(`
      SELECT ra.*, u.full_name as student_name, u.email as student_email, u.academic_details,
             r.room_number, r.block_name, r.room_type, r.capacity
      FROM room_allocations ra
      JOIN users u ON ra.student_id = u.id
      JOIN hostel_rooms r ON ra.room_id = r.id
      ORDER BY ra.id DESC
    `);
    res.json(allocations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch allocations', details: error.message });
  }
});


// ==========================================
// 4. COMPLAINTS ENDPOINTS
// ==========================================

// Create hostel complaint
app.post('/api/complaints', async (req, res) => {
  const { student_id, category_id, description } = req.body;

  if (!student_id || !category_id || !description) {
    return res.status(400).json({ error: 'Missing required fields: student_id, category_id, description' });
  }

  try {
    const db = await getDb();

    // Verify student exists
    const student = await db.get("SELECT id FROM users WHERE id = ? AND role = 'student'", [student_id]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    // Verify category exists
    const category = await db.get("SELECT id FROM complaint_categories WHERE id = ?", [category_id]);
    if (!category) {
      return res.status(404).json({ error: 'Complaint category not found.' });
    }

    const nowStr = new Date().toISOString();
    const result = await db.run(
      `INSERT INTO complaints (student_id, category_id, description, status, created_at, updated_at)
       VALUES (?, ?, ?, 'Open', ?, ?)`,
      [student_id, category_id, description, nowStr, nowStr]
    );

    const newComplaint = await db.get(
      `SELECT c.*, u.full_name as student_name, cc.name as category_name
       FROM complaints c
       JOIN users u ON c.student_id = u.id
       JOIN complaint_categories cc ON c.category_id = cc.id
       WHERE c.id = ?`,
      [result.lastID]
    );

    res.status(201).json(newComplaint);
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit complaint', details: error.message });
  }
});

// Get complaint categories
app.get('/api/complaint-categories', async (req, res) => {
  try {
    const db = await getDb();
    const categories = await db.all('SELECT * FROM complaint_categories ORDER BY name ASC');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories', details: error.message });
  }
});

// Fetch complaint records with filters
app.get('/api/complaints', async (req, res) => {
  const { category_id, status, student_id } = req.query;

  try {
    const db = await getDb();

    let query = `
      SELECT c.*, u.full_name as student_name, u.email as student_email, cc.name as category_name,
             r.room_number, r.block_name
      FROM complaints c
      JOIN users u ON c.student_id = u.id
      JOIN complaint_categories cc ON c.category_id = cc.id
      LEFT JOIN room_allocations ra ON u.id = ra.student_id AND ra.status = 'Active'
      LEFT JOIN hostel_rooms r ON ra.room_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (category_id) {
      query += ' AND c.category_id = ?';
      params.push(category_id);
    }
    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }
    if (student_id) {
      query += ' AND c.student_id = ?';
      params.push(student_id);
    }

    query += ' ORDER BY c.id DESC';

    const complaints = await db.all(query, params);

    // Retrieve maintenance logs history for each complaint
    for (const comp of complaints) {
      const logs = await db.all(
        `SELECT ml.*, u.full_name as staff_name, u.email as staff_email
         FROM maintenance_logs ml
         JOIN users u ON ml.staff_id = u.id
         WHERE ml.complaint_id = ?
         ORDER BY ml.id ASC`,
        [comp.id]
      );
      comp.logs = logs;
    }

    res.json(complaints);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch complaints', details: error.message });
  }
});

// Update complaint status and write log in maintenance_logs
app.put('/api/complaints/:id/status', async (req, res) => {
  const complaintId = req.params.id;
  const { status, staff_id, action_taken } = req.body;

  if (!status || !staff_id || !action_taken) {
    return res.status(400).json({ error: 'Missing required fields: status, staff_id, action_taken' });
  }

  if (!['Open', 'In Progress', 'Resolved', 'Closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be Open, In Progress, Resolved, or Closed.' });
  }

  try {
    const db = await getDb();

    // 1. Verify complaint exists
    const complaint = await db.get('SELECT * FROM complaints WHERE id = ?', [complaintId]);
    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found.' });
    }

    // 2. Verify staff exists and is maintenance or warden/admin
    const staff = await db.get('SELECT * FROM users WHERE id = ?', [staff_id]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff user not found.' });
    }

    const nowStr = new Date().toISOString();

    console.log(`[TRANSACTION] Initiating complaint status update for ticket ID: ${complaintId} to: ${status}`);
    await db.run('BEGIN TRANSACTION');

    try {
      // Update complaint status
      await db.run(
        'UPDATE complaints SET status = ?, updated_at = ? WHERE id = ?',
        [status, nowStr, complaintId]
      );

      // Insert maintenance log
      await db.run(
        `INSERT INTO maintenance_logs (complaint_id, staff_id, status_before, status_after, action_taken, logged_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [complaintId, staff_id, complaint.status, status, action_taken, nowStr.split('T')[0]]
      );

      await db.run('COMMIT');
      console.log(`[TRANSACTION] Status update successfully committed for ticket ID: ${complaintId}`);

      // Fetch final complaint details
      const updatedComplaint = await db.get(
        `SELECT c.*, u.full_name as student_name, cc.name as category_name
         FROM complaints c
         JOIN users u ON c.student_id = u.id
         JOIN complaint_categories cc ON c.category_id = cc.id
         WHERE c.id = ?`,
        [complaintId]
      );

      res.json({ message: 'Complaint status updated and logged.', complaint: updatedComplaint });
    } catch (txErr) {
      console.error(`[TRANSACTION ERROR] Status update failed for ticket ID: ${complaintId}. Rolling back.`, txErr);
      await db.run('ROLLBACK');
      throw txErr;
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update complaint status', details: error.message });
  }
});


// ==========================================
// 5. DASHBOARD & ANALYTICS ENDPOINTS
// ==========================================

app.get('/api/dashboard/summary', async (req, res) => {
  try {
    const db = await getDb();

    // 1. Total rooms and occupied rooms
    const roomsCount = await db.get('SELECT COUNT(*) as total FROM hostel_rooms');
    
    // We define occupied rooms as rooms having active student allocations
    const occupiedRoomsCount = await db.get(`
      SELECT COUNT(DISTINCT room_id) as occupied
      FROM room_allocations
      WHERE status = 'Active'
    `);

    // 2. Capacity vs active occupants
    const totalCapacity = await db.get('SELECT SUM(capacity) as capacity FROM hostel_rooms');
    const activeOccupants = await db.get(`
      SELECT COUNT(*) as active
      FROM room_allocations
      WHERE status = 'Active'
    `);

    // 3. Complaint metrics
    const complaintsCount = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('Open', 'In Progress') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed
      FROM complaints
    `);

    // 4. Complaints breakdown by category
    const categoryBreakdown = await db.all(`
      SELECT cc.name as category, COUNT(c.id) as count
      FROM complaint_categories cc
      LEFT JOIN complaints c ON cc.id = c.category_id
      GROUP BY cc.id, cc.name
    `);

    // 5. Block occupancy statistics
    const blockStats = await db.all(`
      SELECT 
        r.block_name, 
        COUNT(r.id) as total_rooms,
        SUM(r.capacity) as total_capacity,
        (
          SELECT COUNT(ra.id) 
          FROM room_allocations ra 
          JOIN hostel_rooms hr ON ra.room_id = hr.id 
          WHERE hr.block_name = r.block_name AND ra.status = 'Active'
        ) as active_students
      FROM hostel_rooms r
      GROUP BY r.block_name
    `);

    res.json({
      rooms: {
        total: roomsCount.total || 0,
        occupied: occupiedRoomsCount.occupied || 0,
        capacity: totalCapacity.capacity || 0,
        allocated_students: activeOccupants.active || 0,
        occupancy_rate: totalCapacity.capacity ? Math.round((activeOccupants.active / totalCapacity.capacity) * 100) : 0
      },
      complaints: {
        total: complaintsCount.total || 0,
        pending: complaintsCount.pending || 0,
        resolved: complaintsCount.resolved || 0,
        closed: complaintsCount.closed || 0
      },
      categories: categoryBreakdown,
      blocks: blockStats
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate dashboard analytics summary', details: error.message });
  }
});

// Default status probe
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Boot listening server
app.listen(PORT, () => {
  console.log(`Hostel Backend API Server listening on http://localhost:${PORT}`);
});
