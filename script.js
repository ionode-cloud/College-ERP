// 🔥 College ERP Database (LocalStorage) - FIRST
class CollegeERP {
    constructor() {
        this.students = JSON.parse(localStorage.getItem('students')) || [];
        this.teachers = JSON.parse(localStorage.getItem('teachers')) || [];
        this.nextStudentId = parseInt(localStorage.getItem('nextStudentId')) || 1001;
        this.nextTeacherId = parseInt(localStorage.getItem('nextTeacherId')) || 5001;
    }

    generatePassword(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    generateStudentId() {
        const id = this.nextStudentId;
        this.nextStudentId++;
        localStorage.setItem('nextStudentId', this.nextStudentId);
        return `STU${id.toString().padStart(4, '0')}`;
    }

    generateTeacherId() {
        const id = this.nextTeacherId;
        this.nextTeacherId++;
        localStorage.setItem('nextTeacherId', this.nextTeacherId);
        return `TCH${id.toString().padStart(4, '0')}`;
    }

    addStudent(data) {
        const student = {
            id: this.generateStudentId(),
            password: this.generatePassword(),
            name: data.name,
            email: data.email,
            phone: data.phone,
            age: data.age,
            course: data.course,
            createdAt: new Date().toISOString()
        };
        this.students.push(student);
        localStorage.setItem('students', JSON.stringify(this.students));
        return student;
    }

    addTeacher(data) {
        const teacher = {
            id: this.generateTeacherId(),
            password: this.generatePassword(),
            name: data.name,
            email: data.email,
            phone: data.phone,
            subject: data.subject,
            createdAt: new Date().toISOString()
        };
        this.teachers.push(teacher);
        localStorage.setItem('teachers', JSON.stringify(this.teachers));
        return teacher;
    }

    findUser(id, password, role) {
        if (role === 'student') {
            return this.students.find(s => s.id === id && s.password === password);
        } else if (role === 'teacher') {
            return this.teachers.find(t => t.id === id && t.password === password);
        }
        return null;
    }

    getStats() {
        return {
            totalStudents: this.students.length,
            totalTeachers: this.teachers.length
        };
    }
}

// 🔥 Initialize ERP System
const erp = new CollegeERP();

// 🔥 UTILITY FUNCTIONS
function updateStats() {
    const stats = erp.getStats();
    const totalStudentsEl = document.getElementById('totalStudents');
    const totalTeachersEl = document.getElementById('totalTeachers');
    if (totalStudentsEl) totalStudentsEl.textContent = stats.totalStudents;
    if (totalTeachersEl) totalTeachersEl.textContent = stats.totalTeachers;
    
    // Update course students count for student dashboard
    const courseStudentsEl = document.getElementById('courseStudents');
    if (courseStudentsEl) {
        const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
        const courseStudents = erp.students.filter(s => s.course === userData.course).length;
        courseStudentsEl.textContent = courseStudents;
    }
}

function renderUsers() {
    // 🔥 FIXED - Students List (Cards + Grid)
    const studentsList = document.getElementById('studentsList') || document.getElementById('allStudentsList');
    if (studentsList) {
        if (studentsList.classList.contains('students-grid')) {
            // Student Dashboard Grid Style
            studentsList.innerHTML = erp.students.map((student) => `
                <div class="student-card">
                    <h4>${student.name}</h4>
                    <div class="info-row">
                        <span class="label">ID</span>
                        <span class="value">${student.id}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Course</span>
                        <span class="value">${student.course}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Email</span>
                        <span class="value">${student.email}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Age</span>
                        <span class="value">${student.age || 'N/A'}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">Phone</span>
                        <span class="value">${student.phone || 'N/A'}</span>
                    </div>
                </div>
            `).reverse().join('');
        } else {
            // Admin Dashboard Card Style
            studentsList.innerHTML = erp.students.map(student => `
                <div class="user-card">
                    <div>
                        <h4>${student.name}</h4>
                        <p>ID: ${student.id}</p>
                        <p>${student.course} | ${student.email}</p>
                    </div>
                </div>
            `).reverse().join('');
        }
        
        // Update students count
        const studentsCount = document.getElementById('studentsCount');
        if (studentsCount) studentsCount.textContent = erp.students.length;
    }

    // Teachers List
    const teachersList = document.getElementById('teachersList') || document.getElementById('allTeachersList');
    if (teachersList) {
        teachersList.innerHTML = erp.teachers.map(teacher => `
            <div class="user-card">
                <div>
                    <h4>${teacher.name}</h4>
                    <p>ID: ${teacher.id}</p>
                    <p>${teacher.subject} | ${teacher.email}</p>
                </div>
            </div>
        `).reverse().join('');
    }

    renderRecoveryTables();
}

function renderRecoveryTables() {
    const studentsTbody = document.querySelector('#studentsTable tbody');
    if (studentsTbody) {
        studentsTbody.innerHTML = erp.students.map(student => `
            <tr>
                <td>${student.id}</td>
                <td>${student.name}</td>
                <td>${student.course}</td>
                <td>${student.email}</td>
                <td>${student.password}</td>
            </tr>
        `).reverse().join('');
    }

    const teachersTbody = document.querySelector('#teachersTable tbody');
    if (teachersTbody) {
        teachersTbody.innerHTML = erp.teachers.map(teacher => `
            <tr>
                <td>${teacher.id}</td>
                <td>${teacher.name}</td>
                <td>${teacher.subject}</td>
                <td>${teacher.email}</td>
                <td>${teacher.password}</td>
            </tr>
        `).reverse().join('');
    }
}

function showCredentials(elementId, user) {
    const el = document.getElementById(elementId);
    el.innerHTML = `
        <div class="credentials success">
            ✅ <strong>New ${user.id.includes('STU') ? 'Student' : 'Teacher'} Created!</strong><br>
            ID: <strong>${user.id}</strong><br>
            Password: <strong>${user.password}</strong><br>
            Share these credentials with ${user.name}
        </div>
    `;
    setTimeout(() => el.innerHTML = '', 10000);
}

function loadUserProfile() {
    const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
    const role = sessionStorage.getItem('userRole');
    const userId = sessionStorage.getItem('userId');
    
    // Update navbar user badge
    const userBadge = document.getElementById('currentUserId');
    if (userBadge) {
        userBadge.textContent = userId || 'User';
    }
    
    if (role === 'student' && userData.id) {
        document.getElementById('studentName').textContent = userData.name;
        document.getElementById('studentId').textContent = userData.id;
        document.getElementById('studentEmail').textContent = userData.email;
        document.getElementById('studentPhone').textContent = userData.phone || 'N/A';
        document.getElementById('studentCourse').textContent = userData.course;
        document.getElementById('studentAge').textContent = userData.age || 'N/A';
    } else if (role === 'teacher' && userData.id) {
        document.getElementById('teacherName').textContent = userData.name;
        document.getElementById('teacherId').textContent = userData.id;
        document.getElementById('teacherEmail').textContent = userData.email;
        document.getElementById('teacherPhone').textContent = userData.phone || 'N/A';
        document.getElementById('teacherSubject').textContent = userData.subject;
    }
}

// 🔥 SECURITY FUNCTIONS
function checkLoginProtection() {
    const userRole = sessionStorage.getItem('userRole');
    const userData = sessionStorage.getItem('userData');
    
    if (!userRole || !userData) {
        alert('❌ Please login first!');
        window.location.href = 'index.html';
        return false;
    }
    
    // Hide loading screen, show main content
    const loadingScreen = document.getElementById('loadingScreen');
    const mainContent = document.getElementById('mainContent');
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';
    
    return true;
}

function downloadProfile() {
    const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
    const role = sessionStorage.getItem('userRole');
    
    const profileData = {
        role: role,
        ...userData,
        loginTime: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(profileData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${role}-profile-${userData.id || 'user'}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function printCredentials() {
    window.print();
}

function resetPassword() {
    const userId = prompt('Enter Student/Teacher ID to reset password:');
    if (!userId) return;

    let user = erp.students.find(s => s.id === userId);
    if (user) {
        user.password = erp.generatePassword();
        localStorage.setItem('students', JSON.stringify(erp.students));
        alert(`✅ Password reset for ${user.name}\nNew Password: ${user.password}`);
        renderRecoveryTables();
        renderUsers();
        return;
    }

    user = erp.teachers.find(t => t.id === userId);
    if (user) {
        user.password = erp.generatePassword();
        localStorage.setItem('teachers', JSON.stringify(erp.teachers));
        alert(`✅ Password reset for ${user.name}\nNew Password: ${user.password}`);
        renderRecoveryTables();
        renderUsers();
        return;
    }

    alert('❌ User not found!');
}

// 🔥 MAIN APPLICATION (ONE SINGLE DOMContentLoaded)
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎓 College ERP Loaded');
    
    // 1. LOGIN PROTECTION (Dashboards only)
    if (document.getElementById('loadingScreen')) {
        if (!checkLoginProtection()) return;
    }
    
    // 2. STUDENT/TEACHER LOGIN (index.html)
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const id = document.getElementById('loginId').value;
            const password = document.getElementById('loginPass').value;
            const role = document.querySelector('input[name="userRole"]:checked')?.value || 
                        document.getElementById('userRole')?.value;
            const messageEl = document.getElementById('loginMessage');

            const user = erp.findUser(id, password, role);
            
            if (user) {
                sessionStorage.setItem('userId', id);
                sessionStorage.setItem('userRole', role);
                sessionStorage.setItem('userData', JSON.stringify(user));
                
                if (role === 'student') window.location.href = 'student.html';
                else if (role === 'teacher') window.location.href = 'teacher.html';
            } else {
                if (messageEl) {
                    messageEl.textContent = '❌ Invalid ID or Password!';
                    messageEl.className = 'error';
                }
            }
        });
    }
    
    // 3. ADMIN LOGIN (admin-login.html)
    const adminLoginForm = document.getElementById('adminLoginForm');
    if (adminLoginForm) {
        adminLoginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const adminId = document.getElementById('adminId').value;
            const adminPass = document.getElementById('adminPass').value;
            const messageEl = document.getElementById('adminLoginMessage');

            if (adminId === 'admin' && adminPass === 'admin') {
                sessionStorage.setItem('userId', 'admin');
                sessionStorage.setItem('userRole', 'admin');
                sessionStorage.setItem('userData', JSON.stringify({ role: 'admin', name: 'Administrator' }));
                window.location.href = 'admin.html';
            } else {
                messageEl.textContent = '❌ Invalid Admin Credentials!';
                messageEl.className = 'error';
            }
        });
    }
    
    // 4. ADMIN PANEL FORMS
    const studentForm = document.getElementById('studentForm');
    if (studentForm) {
        studentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const studentData = {
                name: document.getElementById('sName').value,
                email: document.getElementById('sEmail').value,
                phone: document.getElementById('sPhone').value,
                age: document.getElementById('sAge').value,
                course: document.getElementById('sCourse').value
            };
            const newStudent = erp.addStudent(studentData);
            showCredentials('studentCredentials', newStudent);
            studentForm.reset();
            updateStats();
            renderUsers();
        });
    }
    
    const teacherForm = document.getElementById('teacherForm');
    if (teacherForm) {
        teacherForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const teacherData = {
                name: document.getElementById('tName').value,
                email: document.getElementById('tEmail').value,
                phone: document.getElementById('tPhone').value,
                subject: document.getElementById('tSubject').value
            };
            const newTeacher = erp.addTeacher(teacherData);
            showCredentials('teacherCredentials', newTeacher);
            teacherForm.reset();
            updateStats();
            renderUsers();
        });
    }
    
    // 5. LOGOUT BUTTONS
    const logoutBtns = document.querySelectorAll('#logoutBtn');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            sessionStorage.clear();
            window.location.href = 'index.html';
        });
    });
    
    // 6. DASHBOARD DATA LOAD
    if (document.querySelector('.dashboard-container')) {
        updateStats();
        renderUsers();
        loadUserProfile();
    }
});
//admin show all data
// 🔥 NEW FUNCTIONS - Add to your script.js
function showStudentsList() {
    document.getElementById('adminStudentsList').innerHTML = erp.students.map(student => `
        <div class="admin-user-card">
            <h4>${student.name}</h4>
            <div class="info-row">
                <span class="label">ID</span>
                <span class="value">${student.id}</span>
            </div>
            <div class="info-row">
                <span class="label">Course</span>
                <span class="value">${student.course}</span>
            </div>
            <div class="info-row">
                <span class="label">Email</span>
                <span class="value">${student.email}</span>
            </div>
            <div class="info-row">
                <span class="label">Age</span>
                <span class="value">${student.age}</span>
            </div>
            <div class="info-row">
                <span class="label">Phone</span>
                <span class="value">${student.phone}</span>
            </div>
        </div>
    `).reverse().join('');
    
    document.getElementById('listsSection').style.display = 'block';
    document.getElementById('studentsTab').classList.add('active');
    document.getElementById('teachersTab').classList.remove('active');
    document.querySelector('.tab-btn').classList.remove('active');
    document.querySelector('[onclick="switchTab(\'students\')"]').classList.add('active');
}

function showTeachersList() {
    document.getElementById('adminTeachersList').innerHTML = erp.teachers.map(teacher => `
        <div class="admin-user-card">
            <h4>${teacher.name}</h4>
            <div class="info-row">
                <span class="label">ID</span>
                <span class="value">${teacher.id}</span>
            </div>
            <div class="info-row">
                <span class="label">Subject</span>
                <span class="value">${teacher.subject}</span>
            </div>
            <div class="info-row">
                <span class="label">Email</span>
                <span class="value">${teacher.email}</span>
            </div>
            <div class="info-row">
                <span class="label">Phone</span>
                <span class="value">${teacher.phone || 'N/A'}</span>
            </div>
        </div>
    `).reverse().join('');
    
    document.getElementById('listsSection').style.display = 'block';
    document.getElementById('teachersTab').classList.add('active');
    document.getElementById('studentsTab').classList.remove('active');
    document.querySelector('.tab-btn').classList.remove('active');
    document.querySelector('[onclick="switchTab(\'teachers\')"]').classList.add('active');
}

function switchTab(tab) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    document.getElementById(tab + 'Tab').classList.add('active');
    event.target.classList.add('active');
}

function hideLists() {
    document.getElementById('listsSection').style.display = 'none';
}
