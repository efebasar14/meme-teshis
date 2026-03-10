// Meme Kanseri Ön Teşhis - Script

// DOM Elements
const uploadBtn = document.getElementById('uploadBtn');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImage = document.getElementById('previewImage');
const removeImageBtn = document.getElementById('removeImage');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingSection = document.getElementById('loading');
const resultSection = document.getElementById('result');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');

// State
let selectedImage = null;
let isAnalyzing = false;

// Event Listeners
uploadBtn.addEventListener('click', () => {
    imageInput.click();
});

imageInput.addEventListener('change', handleImageSelect);
removeImageBtn.addEventListener('click', removeImage);
analyzeBtn.addEventListener('click', analyzeImage);
newAnalysisBtn.addEventListener('click', resetAnalysis);

// Handle Image Selection
function handleImageSelect(event) {
    const file = event.target.files[0];
    
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Lütfen bir görsel dosyası seçiniz.');
        return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('Dosya boyutu 10MB\'dan büyük olamaz.');
        return;
    }
    
    // Read and preview image
    const reader = new FileReader();
    reader.onload = (e) => {
        selectedImage = e.target.result;
        previewImage.src = selectedImage;
        imagePreview.classList.add('active');
        analyzeBtn.disabled = false;
        resultSection.classList.remove('active');
    };
    reader.readAsDataURL(file);
}

// Remove Selected Image
function removeImage() {
    selectedImage = null;
    previewImage.src = '';
    imagePreview.classList.remove('active');
    imageInput.value = '';
    analyzeBtn.disabled = true;
    resultSection.classList.remove('active');
}

// Analyze Image
async function analyzeImage() {
    if (!selectedImage || isAnalyzing) return;
    
    isAnalyzing = true;
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span class="icon">⏳</span> Analiz Ediliyor...';
    
    // Show loading
    loadingSection.classList.add('active');
    resultSection.classList.remove('active');
    
    // Simulate AI analysis (2-3 seconds)
    await simulateAnalysis();
    
    // Get result
    const result = generateAnalysisResult();
    
    // Display result
    displayResult(result);
    
    // Reset state
    isAnalyzing = false;
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '<span class="icon">🔍</span> Analiz Et';
    loadingSection.classList.remove('active');
}

// Simulate AI Analysis
function simulateAnalysis() {
    return new Promise((resolve) => {
        const delay = 2000 + Math.random() * 1000;
        setTimeout(resolve, delay);
    });
}

// Generate Random Analysis Result
function generateAnalysisResult() {
    const random = Math.random();
    let riskLevel, riskClass, icon, title, description;
    
    // Risk distribution: 60% low, 25% medium, 15% high
    if (random < 0.60) {
        riskLevel = 'low';
        riskClass = 'Düşük';
        icon = '✅';
        title = 'Düşük Risk';
        description = 'Fotoğrafta herhangi bir şüpheli lezyon veya anormallik tespit edilmemiştir. ' +
                     'Meme sağlığınız için düzenli kontrollerinizi ihmal etmeyiniz.';
    } else if (random < 0.85) {
        riskLevel = 'medium';
        riskClass = 'Orta';
        icon = '⚠️';
        title = 'Orta Risk';
        description = 'Fotoğrafta hafif düzeyde anormallik tespit edilmiştir. ' +
                     'Kesin teşhis için bir kadın hastalıkları ve doğum uzmanına danışmanız önerilir.';
    } else {
        riskLevel = 'high';
        riskClass = 'Yüksek';
        icon = '🚨';
        title = 'Yüksek Risk';
        description = 'Fotoğrafta şüpheli lezyon belirtileri tespit edilmiştir. ' +
                     'Acilen bir kadın hastalıkları ve doğum uzmanına başvurmanızı strongly öneriyoruz.';
    }
    
    const confidence = Math.floor(60 + Math.random() * 35);
    
    return {
        riskLevel,
        riskClass,
        icon,
        title,
        description,
        confidence,
        doctors: riskLevel !== 'low' ? getDoctors() : []
    };
}

// Get Doctors List
function getDoctors() {
    const doctors = [
        {
            name: 'Dr. Ayşe Yılmaz',
            specialty: 'Kadın Hastalıkları ve Doğum',
            hospital: 'Acıbadem Hastanesi',
            address: 'İstanbul Cad. No:123, İstanbul',
            phone: '+90 212 123 45 67'
        },
        {
            name: 'Dr. Fatma Demir',
            specialty: 'Kadın Hastalıkları ve Doğum',
            hospital: 'Memorial Şişli Hastanesi',
            address: 'Şişli Mahallesi, Vatan Cad., İstanbul',
            phone: '+90 212 234 56 78'
        },
        {
            name: 'Dr. Merim Koçbaş',
            specialty: 'Kadın Hastalıkları ve Doğum',
            hospital: 'Ankara Üniversitesi Tıp Fakültesi',
            address: 'Sihhiye, Ankara',
            phone: '+90 312 508 20 30'
        },
        {
            name: 'Dr. Zeynep Aydın',
            specialty: 'Kadın Hastalıkları ve Doğum',
            hospital: 'Florence Nightingale',
            address: 'Alsancak, İzmir',
            phone: '+90 232 277 65 80'
        }
    ];
    
    // Shuffle and return 3 doctors
    return doctors.sort(() => Math.random() - 0.5).slice(0, 3);
}

// Display Result
function displayResult(result) {
    // Set result class
    resultSection.className = 'result active ' + result.riskLevel;
    
    // Build result HTML
    let html = `
        <div class="result-header">
            <span class="result-icon">${result.icon}</span>
            <h3 class="result-title">${result.title}</h3>
        </div>
        <p class="result-description">${result.description}</p>
        <span class="confidence">Güven: %${result.confidence}</span>
    `;
    
    // Add doctors if needed
    if (result.doctors.length > 0) {
        html += `
            <div class="doctor-list">
                <h4>📍 En Yakın Doktorlar</h4>
                ${result.doctors.map(doctor => `
                    <div class="doctor-item">
                        <div class="doctor-name">${doctor.name}</div>
                        <div class="doctor-info">${doctor.hospital}</div>
                        <div class="doctor-info">${doctor.address}</div>
                        <a href="tel:${doctor.phone}" class="doctor-phone">📞 ${doctor.phone}</a>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    resultSection.innerHTML = html;
    resultSection.classList.add('active');
}

// Reset Analysis
function resetAnalysis() {
    removeImage();
    resultSection.classList.remove('active');
}

// Initialize
console.log('Meme Kanseri Ön Teşhis App initialized');
