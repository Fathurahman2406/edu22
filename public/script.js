/* ==========================================================
   1. GLOBAL VARIABLES & CONFIG
   ========================================================== */
let selectedRole = 'siswa';
let registerRole = 'siswa'; // Default ke siswa agar aman
let quizTimer; 

const firebaseConfig = {
    apiKey: "AIzaSyC8-ugSgkGk37dNP-htNVlB8FG5NkE2p4U",
    authDomain: "edusmart-8696e.firebaseapp.com",
    projectId: "edusmart-8696e",
    storageBucket: "edusmart-8696e.firebasestorage.app",
    messagingSenderId: "600335013389",
    appId: "1:600335013389:web:2ca195b7593cd76455e744",
    measurementId: "G-MGY3W2SJ5X"
};  

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

/* ==========================================================
   2. AUTH FUNCTIONS (LOGIN & REGISTER)
   ========================================================== */

window.setRole = function(role) { 
    selectedRole = role; 
    document.querySelectorAll('#roleSwitch .role-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.role === role);
    });
};

window.setRegisterRole = function(role) {
    registerRole = role;
    document.querySelectorAll('#registerRoleSwitch .role-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('onclick').includes(role));
    });
};

window.register = async function() {
    const fullName = document.getElementById('fullName')?.value.trim();
    const email = document.getElementById('registerEmail')?.value.trim();
    const pass = document.getElementById('regPass')?.value;
    
    if (!fullName || !email || !pass) return alert('Data wajib lengkap.');
    
    const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;
    if (!passwordRegex.test(pass)) {
        return alert("Password wajib 8+ karakter, mengandung Angka & Huruf Besar.");
    }

    try {
        await db.collection("users").add({
            nama_lengkap: fullName,
            email: email,
            password: pass, 
            role: registerRole,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert(`Pendaftaran Berhasil sebagai ${registerRole}!`);
        window.showLogin(); 
    } catch (e) { alert("Gagal simpan data: " + e.message); }
};

window.login = async function() {
    const email = document.getElementById('loginEmail')?.value.trim();
    const pass = document.getElementById('loginPass')?.value;
    if (!email || !pass) return alert("Email/Password kosong.");

    try {
        const snapshot = await db.collection("users")
            .where("email", "==", email)
            .where("password", "==", pass)
            .where("role", "==", selectedRole)
            .get();

        if (snapshot.empty) return alert("Login Gagal: Akun tidak ditemukan atau Role salah.");

        snapshot.forEach(doc => {
            localStorage.setItem('edusmartUser', JSON.stringify({
                name: doc.data().nama_lengkap,
                email: doc.data().email,
                role: doc.data().role
            }));
        });
        window.location.href = 'dashboard.html';
    } catch (e) { alert("Error koneksi: " + e.message); }
};

/* ==========================================================
   3. UI NAVIGATION (FORM TOGGLE)
   ========================================================== */
window.showRegister = function() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
};

window.showLogin = function() {
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
};

window.togglePass = function(id, btn) {
    const input = document.getElementById(id);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🔒';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
};

/* ==========================================================
   4. SISTEM MATERI & KELAS
   ========================================================== */
window.muatMateri = async function() {
    const grid = document.getElementById('materiGrid');
    if (!grid) return;
    const user = JSON.parse(localStorage.getItem('edusmartUser') || '{}');

    try {
        const snapshot = await db.collection("materi").orderBy("createdAt", "desc").get();
        grid.innerHTML = "";
        snapshot.forEach((doc) => {
            const data = doc.data();
            const id = doc.id;
            const isOwner = user.role === 'guru' && user.email === data.email_pengunggah;

            grid.innerHTML += `
                <article class="card-subject">
                    <div class="subject-tag">${data.kategori}</div>
                    <h3>${data.judul}</h3>
                    <p>${data.deskripsi}</p>
                    <div class="card-footer-row" style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
                        <a href="${data.link_sumber}" target="_blank" class="btn-buka">Buka</a>
                        ${isOwner ? `<button onclick="hapusMateri('${id}')" style="cursor:pointer; border:none; background:none;">🗑️</button>` : ''}
                    </div>
                </article>`;
        });
    } catch (e) { console.error("Gagal muat materi:", e); }
};

window.initKelasUI = function() {
    const user = JSON.parse(localStorage.getItem('edusmartUser') || '{}');
    const controls = document.getElementById('classControls');
    if(!controls) return;

    if (user.role === 'guru') {
        controls.innerHTML = `<button onclick="toggleModal('modalTambahKelas')" class="btn-buka">+ Buat Kelas Baru</button>`;
    } else {
        controls.innerHTML = `
            <div style="display:flex; gap:10px;">
                <input type="text" id="inputKodeGabung" placeholder="Kode 6 Digit" style="text-transform:uppercase; padding:8px;">
                <button onclick="gabungKeKelas()" class="btn-buka">Gabung</button>
            </div>`;
    }
    muatDaftarKelas();
};

window.simpanKelasBaru = async function() {
    const user = JSON.parse(localStorage.getItem('edusmartUser'));
    const nama = document.getElementById('inputNamaKelas').value;
    const kode = Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
        await db.collection("kelas").add({
            nama_kelas: nama,
            kode_kelas: kode,
            guru_email: user.email,
            guru_nama: user.name,
            siswa_terdaftar: [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert(`Kelas Dibuat! KODE: ${kode}`);
        location.reload();
    } catch (e) { alert("Gagal."); }
};

/* ==========================================================
   5. SISTEM QUIZ
   ========================================================== */
window.simpanQuizBaru = async function() {
    const user = JSON.parse(localStorage.getItem('edusmartUser'));
    const data = {
        judul_quiz: document.getElementById('quizTitle').value,
        kode_kelas: document.getElementById('quizClassCode').value.toUpperCase(),
        durasi: parseInt(document.getElementById('quizDuration').value) || 10,
        pembuat: user.email,
        pertanyaan: [{
            soal: document.getElementById('soalText').value,
            a: document.getElementById('optA').value,
            b: document.getElementById('optB').value,
            c: document.getElementById('optC').value,
            kunci: document.getElementById('kunciJawaban').value
        }],
        hasil_siswa: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("quizzes").add(data);
        alert("Quiz Terbit!");
        location.reload();
    } catch (e) { alert("Gagal."); }
};

/* ==========================================================
   6. INITIALIZATION
   ========================================================== */
window.toggleModal = function(id) { 
    const m = document.getElementById(id);
    if(m) m.classList.toggle('hidden'); 
};

document.addEventListener('DOMContentLoaded', () => {
    const isDashboard = window.location.pathname.includes('dashboard.html') || window.location.pathname.includes('kelas.html');
    
    if (isDashboard) {
        const userData = localStorage.getItem('edusmartUser');
        if (!userData) {
            window.location.href = 'index.html';
            return;
        }
        muatMateri();
        initKelasUI();
    }
});