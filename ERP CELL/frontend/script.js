class CollegeERP {
  constructor() {
    this.baseURL = window.location.hostname === "localhost" 
      ? "http://localhost:5000/api"
      : "https://college-erp-jhzi.onrender.com/api";

    console.log('🚀 ERP Base URL:', this.baseURL);

    this.token = sessionStorage.getItem("token");
    this.userRole = sessionStorage.getItem("userRole");
    this.userEmail = sessionStorage.getItem("userEmail");
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
          errorMsg = errorData.error || errorData.message || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async getBranches() {
    try {
      const branches = await this.request('/api/branches');
      console.log('✅ Branches loaded:', branches);
      return branches;
    } catch (error) {
      console.error('❌ Branches fetch failed:', error);
      return { branches: ['MCA', 'BCA', 'CSE'] };
    }
  }

  async getAllSubjects(branch = '', semester = '') {
    const params = new URLSearchParams();
    if (branch) params.append('branch', branch);
    if (semester) params.append('semester', semester);
    const query = params.toString() ? `?${params.toString()}` : '';
    try {
      return await this.request(`/api/subjects/all${query}`);
    } catch (err) {
      return { success: false, data: [] };
    }
  }

  async login(email, password) {
    try {
      console.log('🔍 Login attempt:', { email, password: '***' });
      const data = await this.request('/api/login', { 
        method: 'POST', 
        body: JSON.stringify({ email, password }) 
      });
      
      console.log('✅ Login success:', data);
      
      this.token = data.token;
      this.userRole = data.role;
      this.userEmail = data.email;
      
      sessionStorage.setItem('token', this.token);
      sessionStorage.setItem('userRole', this.userRole);
      sessionStorage.setItem('userEmail', this.userEmail);
      
      return data;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  }

  // ADMIN
  async createTeacher(data) { return this.request('/api/admin/create-teacher', { method: 'POST', body: JSON.stringify(data) }); }
  async createStudent(data) { return this.request('/api/admin/create-student', { method: 'POST', body: JSON.stringify(data) }); }
  async createSubjectConfig(data) { return this.request('/api/admin/subjects', { method: 'POST', body: JSON.stringify(data) }); }
  async getTeachers() { return this.request('/api/admin/teachers'); }
  async getStudents() { return this.request('/api/admin/students'); }

  // TEACHER  
  async getClasses() { return this.request('/api/teacher/classes'); }
  async createClass(data) { return this.request('/api/teacher/classes', { method: 'POST', body: JSON.stringify(data) }); }
  async getStudentsByBranch() { return this.request('/api/teacher/students'); }
  async markAttendance(classId, attendances) { return this.request('/api/teacher/attendance', { method: 'POST', body: JSON.stringify({ classId, attendances }) }); }
  async addMarks(classId, marksData) { return this.request('/api/teacher/marks', { method: 'POST', body: JSON.stringify({ classId, marksData }) }); }

  // STUDENT
  async getAttendance() { return this.request('/api/student/attendance'); }
  async getMarks() { return this.request('/api/student/marks'); }

  // PROFILE (role-based)
  async getProfile() {
    const endpoints = { 
      'admin': '/api/admin/profile', 
      'teacher': '/api/teacher/profile', 
      'student': '/api/student/profile' 
    };
    const endpoint = endpoints[this.userRole] || '/api/admin/profile';
    return this.request(endpoint);
  }
}

const erp = new CollegeERP();
let currentClasses = [], currentStudents = [], selectedClassId = null;

// 🔥 UTILITY FUNCTIONS
function safeGetElement(id) { return document.getElementById(id); }

function showMessage(msg, type = 'success') {
  const msgEl = safeGetElement('message');
  if (msgEl) {
    msgEl.textContent = msg;
    msgEl.className = `message ${type}`;
    msgEl.style.display = 'block';
    setTimeout(() => msgEl.style.display = 'none', 3000);
  }
}

function redirectToDashboard(loginResult) {
  const role = erp.userRole || loginResult?.role;
  const roleDashboards = { 
    'admin': '/admin.html', 
    'teacher': '/teacher.html', 
    'student': '/student.html' 
  };
  const redirectUrl = roleDashboards[role] || '/login';
  console.log('🚀 Redirecting to:', redirectUrl);
  window.location.href = redirectUrl;
}

// 🔥 FIXED populateDynamicBranches (NO LOGIN HANDLER HERE!)
window.populateDynamicBranches = async () => {
  try {
    const branchData = await erp.getBranches();
    const branches = branchData.branches || ['MCA', 'BCA', 'CSE'];
    
    const dropdowns = ['teacherBranch', 'studentBranch', 'subjectBranch', 'classBranch'];
    dropdowns.forEach(dropdownId => {
      const el = safeGetElement(dropdownId);
      if (el) {
        el.innerHTML = '<option value="">Select Branch</option>' + 
          branches.map(b => `<option value="${b}">${b}</option>`).join('');
      }
    });
    
    showMessage(`Loaded ${branches.length} branches!`, 'success');
    return branches;
  } catch (err) {
    console.error('Branches failed:', err);
    const fallback = ['MCA', 'BCA', 'CSE'];
    // Populate fallback
    ['teacherBranch', 'studentBranch', 'subjectBranch', 'classBranch'].forEach(id => {
      const el = safeGetElement(id);
      if (el) el.innerHTML = '<option value="">Select Branch</option>' + fallback.map(b => `<option value="${b}">${b}</option>`).join('');
    });
  }
};

// 🔥 ALL OTHER FUNCTIONS (loadClassSubjectsPreview, etc. - keep your existing ones)
window.loadClassSubjectsPreview = async () => {
  const branch = safeGetElement('classBranch')?.value;
  const previewEl = safeGetElement('classSubjectsPreview');
  if (!branch || !previewEl) return;
  
  try {
    previewEl.innerHTML = 'Loading...';
    previewEl.style.borderLeftColor = '#f59e0b';
    const allSubjects = await erp.getAllSubjects(branch);
    const config = allSubjects.data?.[0];
    const subjects = config?.subjects || [];
    
    if (subjects.length) {
      previewEl.innerHTML = `Subjects (${subjects.length}): ${subjects.join(', ')}`;
      previewEl.style.borderLeftColor = '#10b981';
    } else {
      previewEl.innerHTML = 'No subjects configured';
      previewEl.style.borderLeftColor = '#f59e0b';
    }
  } catch (err) {
    previewEl.innerHTML = 'Error loading';
    previewEl.style.borderLeftColor = '#ef4444';
  }
};

// 🔥 MASTER INIT - PROPER STRUCTURE
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Page loaded:', window.location.pathname);
  
  // 🔥 1. AUTO-LOGIN CHECK
  if (erp.token && erp.userRole && window.location.pathname.includes('login')) {
    redirectToDashboard({ role: erp.userRole });
    return;
  }
  
  // 🔥 2. LOGIN PAGE (SEPARATE!)
  if (window.location.pathname.includes('login')) {
    const loginForm = safeGetElement('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = safeGetElement('loginEmail')?.value;
        const password = safeGetElement('loginPassword')?.value;
        
        if (!email || !password) return showMessage('Enter email & password!', 'error');
        
        try {
          await erp.login(email, password);
          setTimeout(() => redirectToDashboard({ role: erp.userRole }), 500);
        } catch (err) {
          showMessage(err.message, 'error');
        }
      });
    }
    return;
  }
  
  // 🔥 3. DASHBOARDS
  await window.populateDynamicBranches();
  
  // 🔥 4. ALL YOUR FORM HANDLERS + EVENT LISTENERS (keep existing code here)
  // ... [your existing form handlers, button listeners, etc.] ...
  
  // 🔥 5. AUTH CHECK - LOAD DATA
  if (erp.token && erp.userRole) {
    try {
      await loadProfileData(); // You'll need to define this
      
      if (window.location.pathname.includes('admin')) {
        await Promise.all([loadAdminTables(), window.loadAllSubjects()]);
      } else if (window.location.pathname.includes('teacher')) {
        await loadTeacherClasses();
      }
    } catch (err) {
      console.log('Token expired, logging out...');
      sessionStorage.clear();
      window.location.href = '/login';
    }
  }
  
  // 🔥 6. LOGOUT
  const logoutBtn = safeGetElement('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.clear();
      window.location.href = '/login';
    });
  }
});
