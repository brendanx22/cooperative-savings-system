const { query } = require('../database/connection');
const bcrypt = require('bcryptjs');

class Member {
  static async create(memberData) {
    const {
      first_name,
      last_name,
      email,
      phone,
      address,
      date_of_birth,
      password
    } = memberData;

    // Generate member number
    const member_number = await this.generateMemberNumber();
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO members (member_number, first_name, last_name, email, phone, address, date_of_birth, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, member_number, first_name, last_name, email, phone, address, date_of_birth, join_date, status
    `;

    const values = [
      member_number,
      first_name,
      last_name,
      email,
      phone,
      address,
      date_of_birth,
      password_hash
    ];

    try {
      const result = await query(sql, values);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to create member: ${error.message}`);
    }
  }

  static async generateMemberNumber() {
    const year = new Date().getFullYear();
    const prefix = `MEM${year}`;
    
    // Get the last member number for this year
    const sql = 'SELECT member_number FROM members WHERE member_number LIKE $1 ORDER BY member_number DESC LIMIT 1';
    const result = await query(sql, [`${prefix}%`]);
    
    let sequence = 1;
    if (result.rows.length > 0) {
      const lastNumber = result.rows[0].member_number;
      const lastSequence = parseInt(lastNumber.slice(-4));
      sequence = lastSequence + 1;
    }
    
    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }

  static async findById(id) {
    const sql = 'SELECT * FROM members WHERE id = $1';
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  static async findByMemberNumber(member_number) {
    const sql = 'SELECT * FROM members WHERE member_number = $1';
    const result = await query(sql, [member_number]);
    return result.rows[0];
  }

  static async findByEmail(email) {
    const sql = 'SELECT * FROM members WHERE email = $1';
    const result = await query(sql, [email]);
    return result.rows[0];
  }

  static async findAll(page = 1, limit = 10, status = null) {
    const offset = (page - 1) * limit;
    let sql = 'SELECT id, member_number, first_name, last_name, email, phone, join_date, status FROM members';
    let countSql = 'SELECT COUNT(*) FROM members';
    const params = [];

    if (status) {
      sql += ' WHERE status = $1';
      countSql += ' WHERE status = $1';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const [membersResult, countResult] = await Promise.all([
      query(sql, params),
      query(countSql, status ? [status] : [])
    ]);

    return {
      members: membersResult.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    };
  }

  static async update(id, updateData) {
    const allowedFields = ['first_name', 'last_name', 'email', 'phone', 'address', 'date_of_birth', 'status'];
    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    const sql = `
      UPDATE members 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, member_number, first_name, last_name, email, phone, address, date_of_birth, join_date, status
    `;

    values.push(id);

    try {
      const result = await query(sql, values);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to update member: ${error.message}`);
    }
  }

  static async updatePassword(id, newPassword) {
    const password_hash = await bcrypt.hash(newPassword, 10);
    const sql = 'UPDATE members SET password_hash = $1 WHERE id = $2';
    await query(sql, [password_hash, id]);
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async delete(id) {
    // Check if member has accounts or loans
    const accountCheck = await query('SELECT id FROM accounts WHERE member_id = $1 LIMIT 1', [id]);
    const loanCheck = await query('SELECT id FROM loans WHERE member_id = $1 LIMIT 1', [id]);

    if (accountCheck.rows.length > 0 || loanCheck.rows.length > 0) {
      throw new Error('Cannot delete member with existing accounts or loans');
    }

    const sql = 'DELETE FROM members WHERE id = $1 RETURNING *';
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  static async getMemberStats() {
    const sql = `
      SELECT 
        COUNT(*) as total_members,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_members,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_members,
        COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_members,
        COUNT(CASE WHEN join_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_members_this_month
      FROM members
    `;
    
    const result = await query(sql);
    return result.rows[0];
  }
}

module.exports = Member;
