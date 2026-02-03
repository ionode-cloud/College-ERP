class CollegeERP {
  constructor() {
    this.baseURL =
      window.location.hostname === "localhost"
        ? "http://localhost:5000/api"
        : "https://college-erp-jhzi.onrender.com/api";

    this.token = sessionStorage.getItem("token");
    this.userRole = sessionStorage.getItem("role");
    this.user = JSON.parse(sessionStorage.getItem("user") || "{}");
  }
  async request(endpoint, options = {}) {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers
      },
      ...options
    };
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${this.baseURL}${endpoint}`, config);
      clearTimeout(timeout);
      
      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  //  PUBLIC APIs (no auth)
  async getBranches() {
    return fetch('${this.baseURL}/branches')
      .then(res => res.json())
      .catch(err => ({ success: false, branches: [] }));
  }

  async getAllSubjects(branch = '', semester = '') {
    const params = new URLSearchParams();
    if (branch) params.append('branch', branch);
    if (semester) params.append('semester', semester);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetch(`${this.baseURL}/subjects/all${query}`)
      .then(res => res.json())
      .catch(err => ({ success: false, data: [] }));
  }

  // AUTH
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('role', data.role);
    sessionStorage.setItem('user', JSON.stringify(data.user));
    this.token = data.token;
    this.userRole = data.role;
    this.user = data.user;
    return data;
  }

  // ADMIN
  async createTeacher(data) { return this.request('/admin/create-teacher', { method: 'POST', body: JSON.stringify(data) }); }
  async createStudent(data) { return this.request('/admin/create-student', { method: 'POST', body: JSON.stringify(data) }); }
  async createSubjectConfig(data) { 
    return this.request('/admin/subjects', { method: 'POST', body: JSON.stringify(data) }); 
  }
  async getTeachers() { return this.request('/admin/teachers'); }
  async getStudents() { return this.request('/admin/students'); }
  async getSubjects(branch, semester) { return this.request(`/admin/subjects/${branch}/${semester}`); }
  async updateUser(id, data) { return this.request(`/admin/update/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteUser(id) { return this.request(`/admin/delete/${id}`, { method: 'DELETE' }); }

  // PROFILE
  async getProfile() {
    const endpoints = { 'admin': '/admin/profile', 'teacher': '/teacher/profile', 'student': '/student/profile' };
    const endpoint = endpoints[this.userRole] || '/admin/profile';
    return this.request(endpoint);
  }

  // TEACHER  COMPLETE
  async getStudentsByBranch() { return this.request('/teacher/students'); }
  async getClasses() { return this.request('/teacher/classes'); }
  async createClass(data) { return this.request('/teacher/classes', { method: 'POST', body: JSON.stringify(data) }); }
  async markAttendance(classId, attendances) {
    return this.request('/teacher/attendance', { method: 'POST', body: JSON.stringify({ classId, attendances }) });
  }
  async addMarks(classId, marksData) {
    return this.request('/teacher/marks', { method: 'POST', body: JSON.stringify({ classId, marksData }) });
  }

  // STUDENT
  async getAttendance() { return this.request('/student/attendance'); }
  async getMarks() { return this.request('/student/marks'); }
}

const erp = new CollegeERP();
let currentClasses = [];
let currentStudents = [];
let selectedClassId = null;
let allSubjectsData = [];

function safeGetElement(id) { return document.getElementById(id); }

function showMessage(msg, type = 'success') {
  const msgEl = safeGetElement('message');
  if (msgEl) {
    msgEl.textContent = msg;
    msgEl.className = `message ${type}`;
    msgEl.style.display = 'block';
    setTimeout(() => msgEl.style.display = 'none', 5522);
  }
}

function getGrade(marks) {
  if (!marks || marks < 0) return 'F';
  if (marks >= 90) return 'A+';
  if (marks >= 80) return 'A';
  if (marks >= 70) return 'B';
  if (marks >= 60) return 'C';
  if (marks >= 50) return 'D';
  return 'F';
}

function getGradeColor(grade) {
  const colors = { 'A+': '#10b981', 'A': '#10b981', 'B': '#3b82f6', 'C': '#f59e0b', 'D': '#f59e0b', 'F': '#ef4444' };
  return colors[grade] || '#ef4444';
}

function redirectToDashboard(data) {
  const roleDashboards = { 'admin': '/admin', 'teacher': '/teacher', 'student': '/student' };
  window.location.href = data.redirect || roleDashboards[data.role];
}

//  GLOBAL STATE
window.toggleSubmitBtn = (btnId, enable) => {
  const btn = safeGetElement(btnId);
  if (btn) {
    btn.disabled = !enable;
    if (enable) {
      btn.classList.add('submit-ready');
    } else {
      btn.classList.remove('submit-ready');
    }
  }
};

//  DYNAMIC BRANCHES
window.populateDynamicBranches = async () => {
  if (window.location.pathname.includes('login')) {
    console.log('Login page - skipping branches');
    return [];
  }

  try {
    const branchData = await erp.getBranches();
    const branches = branchData.branches || [];
    
    // console.log(` Loaded ${branches.length} branches:`, branches);
    
    const dropdowns = ['teacherBranch', 'studentBranch', 'subjectBranch', 'classBranch'];
    dropdowns.forEach(dropdownId => {
      const el = safeGetElement(dropdownId);
      if (el) {
        el.innerHTML = '<option value=""> Select Branch</option>';
        branches.forEach(branch => {
          const option = document.createElement('option');
          option.value = branch;
          option.textContent = branch;
          el.appendChild(option);
        });
      }
    });
    
    if (!window.location.pathname.includes('login') && safeGetElement('message')) {
      showMessage(`Loaded ${branches.length} branches!`, 'success');
    }
    return branches;
  } catch (err) {
    console.error('Branches load failed:', err);
    if (!window.location.pathname.includes('login')) {
      const fallback = ['MCA', 'BCA', 'CSE'];
      ['teacherBranch', 'studentBranch', 'subjectBranch', 'classBranch'].forEach(id => {
        const el = safeGetElement(id);
        if (el) {
          el.innerHTML = '<option value=""> Select Branch</option>' + 
            fallback.map(b => `<option value="${b}">${b}</option>`).join('');
        }
      });
    }
  }
};

//  CREATE CLASS SUBJECTS PREVIEW - ALL SUBJECTS
window.loadClassSubjectsPreview = async () => {
  const branch = safeGetElement('classBranch')?.value;
  const previewEl = safeGetElement('classSubjectsPreview');
  
  if (!branch || !previewEl) return;
  
  try {
    previewEl.innerHTML = 'Loading subjects...';
    previewEl.style.borderLeftColor = '#f59e0b';
    
    const allSubjects = await erp.getAllSubjects(branch);
    const config = allSubjects.data?.[0];
    const subjects = config?.subjects || [];
    
    if (subjects.length) {
      previewEl.innerHTML = ` ALL Subjects (${subjects.length}): ${subjects.join(', ')}`;
      previewEl.style.borderLeftColor = '#10b981';
      previewEl.style.fontSize = '14px';
      previewEl.style.lineHeight = '1.4';
    } else {
      previewEl.innerHTML = ' No subjects configured for this branch';
      previewEl.style.borderLeftColor = '#f59e0b';
    }
  } catch (err) {
    previewEl.innerHTML = ' Error loading subjects';
    previewEl.style.borderLeftColor = '#ef4444';
  }
};

// TEACHER SUBJECTS PREVIEW (ONLY FOR TEACHER PAGE)
window.loadTeacherSubjectsPreview = async () => {
  const branch = safeGetElement('teacherBranch')?.value;
  const previewEl = safeGetElement('teacherSubjectsPreview');
  
  if (!branch || !previewEl) return;
  
  try {
    previewEl.innerHTML = ' Loading subjects...';
    previewEl.style.borderLeftColor = '#f59e0b';
    
    const allSubjects = await erp.getAllSubjects(branch);
    const config = allSubjects.data?.[0];
    const subjects = config?.subjects || [];
    
    if (subjects.length) {
      previewEl.innerHTML = ` ALL Subjects (${subjects.length}): ${subjects.join(', ')}`;
      previewEl.style.borderLeftColor = '#10b981';
      previewEl.style.fontSize = '14px';
      previewEl.style.lineHeight = '1.4';
    } else {
      previewEl.innerHTML = 'No subjects configured for this branch';
      previewEl.style.borderLeftColor = '#f59e0b';
    }
  } catch (err) {
    previewEl.innerHTML = ' Error loading subjects';
    previewEl.style.borderLeftColor = '#ef4444';
  }
};

// STUDENT SUBJECTS
window.loadSubjectsForBranch = async () => {
  const branch = safeGetElement('studentBranch')?.value;
  const semester = safeGetElement('studentSemester')?.value || '1st';
  const subjectsListEl = safeGetElement('subjectsList');
  
  if (!branch || !subjectsListEl) {
    subjectsListEl.textContent = '-- Select Branch + Semester --';
    return;
  }
  
  try {
    subjectsListEl.textContent = 'Loading subjects...';
    const allSubjects = await erp.getAllSubjects(branch, semester);
    const config = allSubjects.data?.[0];
    subjectsListEl.textContent = config?.subjects?.join(', ') || 'No subjects configured';
  } catch (err) {
    subjectsListEl.textContent = 'Error loading subjects';
  }
};

// TEACHER CLASS FUNCTIONS
window.selectClassForAttendance = async (classId) => {
  selectedClassId = classId;
  console.log(' Selected class for attendance:', classId);
  
  const className = currentClasses.find(c => c._id === classId)?.name || 'Unknown';
  const displayEl = safeGetElement('attendanceClassDisplay');
  if (displayEl) displayEl.textContent = `"${className}"`;
  
  try {
    currentStudents = await erp.getStudentsByBranch();
    
    const attBody = safeGetElement('attendanceStudentsBody');
    if (attBody) {
      attBody.innerHTML = currentStudents.map(student => `
        <tr>
          <td>${student.rollNo || 'N/A'}</td>
          <td>${student.name}</td>
          <td style="text-align:center;">
            <label class="attendance-radio">
              <input type="radio" name="status_${student._id}" value="present"> Present
            </label>
            <label class="attendance-radio">
              <input type="radio" name="status_${student._id}" value="absent"> Absent
            </label>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="3">No students found</td></tr>';
    }
    
    toggleSubmitBtn('submitAttendanceBtn', true);
    safeGetElement('attendanceSection')?.scrollIntoView({ behavior: 'smooth' });
    showMessage(`"${className}" attendance ready for ${currentStudents.length} students!`, 'success');
  } catch (err) {
    showMessage('Failed to load students: ' + err.message, 'error');
  }
};

window.selectClassForMarks = async (classId) => {
  selectedClassId = classId;
  console.log('Selected class for marks:', classId);
  
  const className = currentClasses.find(c => c._id === classId)?.name || 'Unknown';
  const displayEl = safeGetElement('marksClassDisplay');
  if (displayEl) displayEl.textContent = `"${className}"`;
  
  try {
    currentStudents = await erp.getStudentsByBranch();
    
    const marksBody = safeGetElement('marksStudentsBody');
    if (marksBody) {
      marksBody.innerHTML = currentStudents.map(student => `
        <tr>
          <td>${student.rollNo || 'N/A'}</td>
          <td>${student.name}</td>
          <td>
            <input type="number" class="marks-input" data-student-id="${student._id}" 
                   min="0" max="100" step="1" placeholder="0-100">
          </td>
        </tr>
      `).join('') || '<tr><td colspan="3">No students found</td></tr>';
    }
    
    toggleSubmitBtn('submitMarksBtn', true);
    safeGetElement('marksSection')?.scrollIntoView({ behavior: 'smooth' });
    showMessage(`"${className}" marks ready! Type manually (0-100).`, 'success');
  } catch (err) {
    showMessage('Failed to load students: ' + err.message, 'error');
  }
};

// FIXED SUBMIT FUNCTIONS
window.submitAttendance = async () => {
  if (!selectedClassId) {
    return showMessage('Please select a class first!', 'error');
  }
  
  const attendances = [];
  let hasSelection = false;
  
  currentStudents.forEach(student => {
    const selected = document.querySelector(`input[name="status_${student._id}"]:checked`);
    if (selected) {
      attendances.push({ studentId: student._id, status: selected.value });
      hasSelection = true;
    }
  });
  
  if (!hasSelection) {
    return showMessage('Please select Present/Absent for at least one student!', 'error');
  }
  
  try {
    const result = await erp.markAttendance(selectedClassId, attendances);
    showMessage(result.message || ` ${attendances.length} attendance records saved!`, 'success');
    
    safeGetElement('attendanceStudentsBody').innerHTML = 
      '<tr><td colspan="3" style="text-align:center; color:#10b981; padding:2rem;"> Attendance Submitted Successfully!</td></tr>';
    toggleSubmitBtn('submitAttendanceBtn', false);
    if (safeGetElement('attendanceClassDisplay')) {
      safeGetElement('attendanceClassDisplay').textContent = 'No class selected';
    }
  } catch (err) {
    showMessage('Attendance failed: ' + err.message, 'error');
  }
};

window.submitMarks = async () => {
  if (!selectedClassId) {
    return showMessage('Please select a class first!', 'error');
  }
  
  const marksData = [];
  let validMarks = 0;
  
  document.querySelectorAll('.marks-input').forEach(input => {
    const studentId = input.dataset.studentId;
    const marks = parseInt(input.value) || 0;
    if (marks >= 0 && marks <= 100) {
      marksData.push({ studentId, subject: 'General', marks });
      validMarks++;
    }
  });
  
  if (validMarks === 0) {
    return showMessage('Please enter valid marks (0-100) for at least one student!', 'error');
  }
  
  try {
    const result = await erp.addMarks(selectedClassId, marksData);
    showMessage(result.message || ` ${validMarks} marks saved successfully!`, 'success');
    
    safeGetElement('marksStudentsBody').innerHTML = 
      '<tr><td colspan="3" style="text-align:center; color:#10b981; padding:2rem;">Marks Submitted Successfully!</td></tr>';
    toggleSubmitBtn('submitMarksBtn', false);
    if (safeGetElement('marksClassDisplay')) {
      safeGetElement('marksClassDisplay').textContent = 'No class selected';
    }
  } catch (err) {
    showMessage('Marks failed: ' + err.message, 'error');
  }
};

// CREATE CLASS
window.createTeacherClass = async () => {
  const className = safeGetElement('className')?.value.trim();
  const branch = safeGetElement('classBranch')?.value.trim();
  
  if (!className || className.length < 2) return showMessage('Class name must be 2+ characters!', 'error');
  if (!branch) return showMessage('Please select branch!', 'error');
  
  const submitBtn = safeGetElement('createClassBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';
  }
  
  try {
    const result = await erp.createClass({ name: className, branch });
    const displayEl = safeGetElement('classIdDisplay');
    if (displayEl) {
      displayEl.textContent = `"${className}" created! ID: ${result._id?.slice(-8) || 'N/A'}`;
    }
    safeGetElement('className').value = '';
    safeGetElement('classBranch').value = '';
    safeGetElement('classSubjectsPreview').innerHTML = '';
    
    await loadTeacherClasses();
    showMessage(`Class "${className}" created for ${branch}!`, 'success');
  } catch (err) {
    showMessage('Class creation failed: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '➕ Create Class';
    }
  }
};

//  LOAD FUNCTIONS
async function loadTeacherClasses() {
  try {
    currentClasses = await erp.getClasses();
    
    const classesBody = safeGetElement('classesTableBody');
    if (classesBody) {
      if (currentClasses.length === 0) {
        classesBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #718096; padding: 2rem;">No classes created yet. Create one above! </td></tr>';
      } else {
        classesBody.innerHTML = currentClasses.map(c => `
          <tr>
            <td><strong>${c.name}</strong></td>
            <td><code style="font-size: 0.9em; color: #666;">${c._id?.slice(-8) || 'N/A'}</code></td>
            <td>${c.studentCount || 0}</td>
            <td><span class="badge">${c.branch || 'N/A'}</span></td>
            <td>${new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
            <td>
              <button onclick="selectClassForAttendance('${c._id}')" class="btn btn-secondary" style="margin-right: 5px; padding: 6px 12px; font-size: 14px;"> Attendance</button>
              <button onclick="selectClassForMarks('${c._id}')" class="btn btn-primary" style="padding: 6px 12px; font-size: 14px;">Marks</button>
            </td>
          </tr>
        `).join('');
      }
    }
    
    showMessage(` Loaded ${currentClasses.length} classes!`, 'success');
  } catch (err) {
    console.error('Load classes error:', err);
    showMessage('Failed to load classes: ' + err.message, 'error');
  }
}

async function loadAdminTables() {
  try {
    const [teachers, students] = await Promise.all([erp.getTeachers(), erp.getStudents()]);
    
    if (safeGetElement('teachersTableBody')) {
      safeGetElement('teachersTableBody').innerHTML = teachers.map(t => `
        <tr>
          <td>${t.name || 'N/A'}</td>
          <td>${t.email}</td>
          <td><span class="badge">${t.branch || 'N/A'}</span></td>
          <td title="${t.subjects?.join(', ') || 'No subjects'}">${t.subjects?.slice(0,2).join(', ') || 'No subjects'} ${t.subjects?.length > 2 ? '...' : ''}</td>
          <td>₹${t.salary || 0}</td>
          <td>
            <button onclick="updateUser('${t._id}')" style="margin-right:5px; padding:4px 8px; font-size:12px;">Edit</button>
            <button onclick="deleteUser('${t._id}')" style="padding:4px 8px; font-size:12px;">Delete</button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="6" style="text-align:center;color:#718096;">No teachers</td></tr>';
    }
    
    if (safeGetElement('studentsTableBody')) {
      safeGetElement('studentsTableBody').innerHTML = students.map(s => `
        <tr>
          <td>${s.name || 'N/A'}</td>
          <td>${s.rollNo || 'N/A'}</td>
          <td><span class="badge">${s.branch || 'N/A'}</span></td>
          <td><span class="badge">${s.semester || 'N/A'}</span></td>
          <td title="${s.subjects?.join(', ') || 'None'}">${s.subjects?.slice(0,2).join(', ') || 'General'} ${s.subjects?.length > 2 ? '...' : ''}</td>
          <td>
            <button onclick="updateUser('${s._id}')" style="margin-right:5px; padding:4px 8px; font-size:12px;">Edit</button>
            <button onclick="deleteUser('${s._id}')" style="padding:4px 8px; font-size:12px;">Delete</button>
          </td>
        </tr>
      `).join('') || '<tr><td colspan="6" style="text-align:center;color:#718096;">No students</td></tr>';
    }
  } catch (err) {
    showMessage('Load failed: ' + err.message, 'error');
  }
}

window.updateUser = async (id) => {
  const name = prompt('New name:');
  if (name) {
    try {
      await erp.updateUser(id, { name });
      loadAdminTables();
      showMessage('User updated!');
    } catch (err) {
      showMessage('Update failed: ' + err.message, 'error');
    }
  }
};

window.deleteUser = async (id) => {
  if (confirm('Delete this user?')) {
    try {
      await erp.deleteUser(id);
      loadAdminTables();
      showMessage('User deleted!');
    } catch (err) {
      showMessage('Delete failed: ' + err.message, 'error');
    }
  }
};

async function loadProfileData() {
  try {
    const profile = await erp.getProfile();
    
    ['profileName', 'profileEmail', 'profileBranch','profileRollNo'].forEach(id => {
      const el = safeGetElement(id);
      if (el) el.textContent = profile[id.replace('profile', '').toLowerCase()] || 'N/A';
    });
    
    if (safeGetElement('profileSalary')) safeGetElement('profileSalary').textContent = `₹${profile.salary || 0}`;
    if (safeGetElement('teacherName')) safeGetElement('teacherName').textContent = profile.name || 'Teacher';
     if (safeGetElement('profileRollNo')) safeGetElement('profileRollNo').textContent = profile.rollNo || 'Student Roll Number';
  } catch (err) {
    console.error('Profile error:', err);
  }
}

async function loadStudentData() {
  try {
    await loadProfileData();
    
    const attendance = await erp.getAttendance();
    const attBody = safeGetElement('attendanceBody');
    if (attBody) {
      attBody.innerHTML = attendance.map(a => `
        <tr>
          <td>${new Date(a.date).toLocaleDateString('en-IN')}</td>
          <td><strong style="color: ${a.status === 'present' ? '#10b981' : '#ef4444'}">${a.status.toUpperCase()}</strong></td>
        </tr>
      `).join('') || '<tr><td colspan="2">No attendance records</td></tr>';
    }
    
    const marks = await erp.getMarks();
    const marksBody = safeGetElement('marksBody');
    if (marksBody) {
      if (marks.length === 0) {
        marksBody.innerHTML = '<tr><td colspan="4">No marks recorded yet</td></tr>';
      } else {
        const marksBySubject = {};
        marks.forEach(m => {
          const key = `${m.subject || 'General'}`;
          if (!marksBySubject[key]) marksBySubject[key] = [];
          marksBySubject[key].push(m.marks);
        });
        
        marksBody.innerHTML = Object.entries(marksBySubject).map(([subject, scores]) => {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          const grade = getGrade(avg);
          return `
            <tr>
              <td>${subject}</td>
              <td>${avg.toFixed(1)}/100</td>
              <td><span style="color: ${getGradeColor(grade)}; font-weight: bold;">${grade}</span></td>
              <td>${scores.length}</td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    showMessage('Data load failed: ' + err.message, 'error');
  }
}

//  ADMIN SUBJECTS TABLE
window.loadAllSubjects = async () => {
  const subjectsTableBody = safeGetElement('subjectsTableBody');
  if (!subjectsTableBody) return;
  
  try {
    subjectsTableBody.innerHTML = '<tr><td colspan="4">Loading subjects...</td></tr>';
    allSubjectsData = await erp.getAllSubjects();
    
    if (allSubjectsData.data?.length === 0) {
      subjectsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#718096;">No subjects configured yet</td></tr>';
      return;
    }
    
    subjectsTableBody.innerHTML = allSubjectsData.data.map((config) => `
      <tr>
        <td><strong>${config.branch}</strong></td>
        <td><span class="badge">${config.semester}</span></td>
        <td style="max-width: 300px; word-break: break-word;">
           (${config.subjects}) 
          <br>
        </td>
        <td>${new Date(config.createdAt).toLocaleDateString('en-IN')}</td>
      </tr>
    `).join('');
  
    showMessage(` Loaded ${allSubjectsData.data.length} subject configs!`, 'success');
  } catch (err) {
    subjectsTableBody.innerHTML = '<tr><td colspan="4" style="color:#ef4444;">Failed to load subjects</td></tr>';
    showMessage('Subjects load failed: ' + err.message, 'error');
  }
};

//  MASTER INIT - FULLY FUNCTIONAL ADMIN DASHBOARD
document.addEventListener('DOMContentLoaded', async () => {  
  // LOGIN PAGE
  if (window.location.pathname.includes('login')) {
    console.log('Login page detected');
    const loginForm = safeGetElement('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = safeGetElement('loginEmail')?.value;
        const password = safeGetElement('loginPassword')?.value;
        
        if (!email || !password) return showMessage('Please enter email & password!', 'error');
        
        try {
          await erp.login(email, password);
          redirectToDashboard({ role: erp.userRole });
        } catch (err) {
          showMessage(err.message, 'error');
        }
      });
    }
    return;
  }
  
  //  DASHBOARDS - Load branches FIRST
  await populateDynamicBranches();
  
  //  FORM 1: CREATE SUBJECTS
  const subjectForm = safeGetElement('createSubjectForm');
  if (subjectForm) {
    subjectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const subjects = safeGetElement('subjectNames')?.value.split(',').map(s => s.trim()).filter(Boolean);
      const data = {
        branch: safeGetElement('subjectBranch')?.value,
        semester: safeGetElement('subjectSemester')?.value,
        subjects
      };

      if (!data.branch || !data.semester || !data.subjects.length) {
        return showMessage('Please fill all fields with valid data!', 'error');
      }

      try {
        await erp.createSubjectConfig(data);
        showMessage(`Subjects added for ${data.branch} ${data.semester}!`, 'success');
        subjectForm.reset();
        safeGetElement('subjectPreview').innerHTML = '';
        await loadAllSubjects();
      } catch (err) {
        showMessage('Subject creation failed: ' + err.message, 'error');
      }
    });
  }

  //  FORM 2: CREATE TEACHER
  const teacherForm = safeGetElement('createTeacherForm');
  if (teacherForm) {
    teacherForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const data = {
        name: safeGetElement('teacherName')?.value.trim(),
        email: safeGetElement('teacherEmail')?.value.trim(),
        password: safeGetElement('teacherPassword')?.value,
        branch: safeGetElement('teacherBranch')?.value,
        salary: parseInt(safeGetElement('teacherSalary')?.value) || 0
      };

      if (!data.name || !data.email || !data.password || !data.branch) {
        return showMessage('Please fill all required fields!', 'error');
      }

      try {
        await erp.createTeacher(data);
        showMessage(`Teacher "${data.name}" created successfully!`, 'success');
        teacherForm.reset();
        safeGetElement('teacherSubjectsPreview').innerHTML = '';
        await loadAdminTables();
      } catch (err) {
        showMessage('Teacher creation failed: ' + err.message, 'error');
      }
    });
  }

  //  FORM 3: CREATE STUDENT
  const studentForm = safeGetElement('createStudentForm');
  if (studentForm) {
    studentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const data = {
        name: safeGetElement('studentName')?.value.trim(),
        email: safeGetElement('studentEmail')?.value.trim(),
        password: safeGetElement('studentPassword')?.value,
        rollNo: safeGetElement('studentRollNo')?.value.trim(),
        branch: safeGetElement('studentBranch')?.value,
        semester: safeGetElement('studentSemester')?.value
      };

      if (!data.name || !data.email || !data.password || !data.rollNo || !data.branch) {
        return showMessage('Please fill all required fields!', 'error');
      }

      try {
        await erp.createStudent(data);
        showMessage(`Student "${data.name}" created successfully!`, 'success');
        studentForm.reset();
        safeGetElement('subjectsPreview').innerHTML = '-- Select Branch + Semester --';
        await loadAdminTables();
      } catch (err) {
        showMessage('Student creation failed: ' + err.message, 'error');
      }
    });
  }

  //  DYNAMIC LISTENERS
  if (safeGetElement('classBranch')) {
    safeGetElement('classBranch').addEventListener('change', loadClassSubjectsPreview);
  }
  
  if (safeGetElement('teacherBranch')) {
    safeGetElement('teacherBranch').addEventListener('change', loadTeacherSubjectsPreview);
  }
  
  if (safeGetElement('studentBranch')) {
    safeGetElement('studentBranch').addEventListener('change', loadSubjectsForBranch);
  }
  if (safeGetElement('studentSemester')) {
    safeGetElement('studentSemester').addEventListener('change', loadSubjectsForBranch);
  }

  //  BUTTON LISTENERS
  safeGetElement('createClassBtn')?.addEventListener('click', createTeacherClass);
  safeGetElement('submitAttendanceBtn')?.addEventListener('click', submitAttendance);
  safeGetElement('submitMarksBtn')?.addEventListener('click', submitMarks);

  //  REFRESH BUTTONS
  safeGetElement('refreshTeachersBtn')?.addEventListener('click', loadAdminTables);
  safeGetElement('refreshStudentsBtn')?.addEventListener('click', loadAdminTables);
  safeGetElement('refreshSubjectsBtn')?.addEventListener('click', loadAllSubjects);

  //  AUTHENTICATED FEATURES
  if (erp.token) {
    await loadProfileData();
    
    if (window.location.pathname.includes('teacher')) {
      await loadTeacherClasses();
    } else if (window.location.pathname.includes('admin')) {
      await loadAdminTables();
      await loadAllSubjects();
    } else if (window.location.pathname.includes('student')) {
      await loadStudentData();
    }
  }

  //  LOGOUT
  const logoutBtn = safeGetElement('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.clear();
      window.location.href = '/login';
    });
  }
});
