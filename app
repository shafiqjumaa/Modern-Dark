// قائمة الـ 18 دولة المعتمدة بالشرق الأوسط
const countriesList = [
    "المملكة العربية السعودية", "الإمارات العربية المتحدة", "قطر", "الكويت", 
    "البحرين", "عُمان", "اليمن", "سوريا", "لبنان", "الأردن", 
    "العراق", "فلسطين", "إسرائيل", "مصر", "تركيا", "إيران", "قبرص", "السودان"
];

// داتا قواعد السرعة والأدوار للوحدات
const unitBlueprints = {
    motorized: { name: "مشاة آلية", speed: "متوسطة", role: "احتلال المدن المفتوحة وتأمين الحدود" },
    mechanized: { name: "مشاة ميكانيكية", speed: "بطيئة", role: "مرافقة الدبابات والدفاع عن المدن الحيوية" },
    special_forces: { name: "قوات خاصة", speed: "سريعة", role: "التسلل خلف خطوط العدو واغتيال الرادارات" },
    airborne: { name: "المظليون", speed: "فائقة جوياً", role: "ضرب المدن البعيدة وصناعة عنصر المفاجأة" },
    recon: { name: "مدرعات استطلاع", speed: "سريعة جداً", role: "كشف الخريطة وتحديد مواقع العدو" },
    mbt: { name: "دبابات قتالية MBT", speed: "بطيئة", role: "المعارك المفتوحة وسحق التحصينات" },
    artillery: { name: "مدفعية صاروخية", speed: "بطيئة جداً", role: "قصف المدن والجيوش عن بعد دون احتكاك" },
    aa: { name: "مضادات طيران عسكرية", speed: "متوسطة", role: "مرافقة الجيش البري وحمايته من الغارات" },
    jets: { name: "مقاتلات نفاثة", speed: "خارقة السرعة", role: "السيطرة الجوية واصطياد قاذفات العدو" },
    helis: { name: "مروحيات هجومية", speed: "سريعة", role: "حرية الحركة الكاملة وتدمير الدبابات" },
    navy: { name: "سفن ومدمرات", speed: "سريعة (بحرأ)", role: "تأمين المضائق البحرية وقصف السواحل" },
    officer: { name: "قوات النخبة / القادة", speed: "تطابق الفيلق", role: "تقديم ميزات تشجيعية Buffs للجيوش" }
};

let gamePlayers = [];
let activePlayerIndex = 0;

// توليد قائمة الدول في واجهة الاختيار
const selectElement = document.getElementById('country-select');
countriesList.forEach(country => {
    let opt = document.createElement('option');
    opt.value = country;
    opt.textContent = country;
    selectElement.appendChild(opt);
});

// إضافة لاعب جديد
document.getElementById('add-player-btn').addEventListener('click', () => {
    const pName = document.getElementById('player-name').value.trim();
    const pCountry = document.getElementById('country-select').value;

    if(!pName) { alert('الرجاء إدخال اسم القائد أولاً'); return; }
    
    // التحقق من عدم تكرار الدولة
    if(gamePlayers.some(p => p.country === pCountry)) {
        alert('هذه الدولة محجوزة للاعب آخر!'); return;
    }

    let newPlayer = {
        name: pName,
        country: pCountry,
        resources: { oil: 100, iron: 150, rare: 50, industrial: 40, logistics: 40, cash: 200, manpower: 100 },
        buildings: { mobilization: 1, military_base: 0, industry: 1, bunker: 0, highway: 0, airfield: 0 },
        army: { motorized: 2, mechanized: 0, special_forces: 0, airborne: 0, recon: 1, mbt: 0, artillery: 0, aa: 0, jets: 0, helis: 0, navy: 0, officer: 0 }
    };

    gamePlayers.push(newPlayer);
    updatePlayersSetupList();
    document.getElementById('player-name').value = '';
    
    if(gamePlayers.length >= 1) {
        document.getElementById('start-game-btn').style.display = 'block';
    }
});

function updatePlayersSetupList() {
    const list = document.getElementById('players-list');
    list.innerHTML = '';
    gamePlayers.forEach(p => {
        let li = document.createElement('li');
        li.textContent = `القائد: ${p.name} | القيادة العامة: ${p.country}`;
        list.appendChild(li);
    });
}

// بدء اللعبة
document.getElementById('start-game-btn').addEventListener('click', () => {
    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('main-game-screen').style.display = 'block';
    renderTurn();
});

// تحديث واجهة الدور الحالي والبيانات
function renderTurn() {
    let player = gamePlayers[activePlayerIndex];
    document.getElementById('current-player-display').textContent = player.name;
    document.getElementById('current-country-display').textContent = player.country;

    // تحديث عدادات الموارد بالواجهة
    document.getElementById('res-oil').textContent = player.resources.oil;
    document.getElementById('res-iron').textContent = player.resources.iron;
    document.getElementById('res-rare').textContent = player.resources.rare;
    document.getElementById('res-industrial').textContent = player.resources.industrial;
    document.getElementById('res-logistics').textContent = player.resources.logistics;
    document.getElementById('res-cash').textContent = player.resources.cash;
    document.getElementById('res-manpower').textContent = player.resources.manpower;

    // تحديث حالة المنشآت
    const bStatus = document.getElementById('buildings-status');
    bStatus.innerHTML = `
        <li>قواعد التجنيد والمشاة: مستوى ${player.buildings.mobilization}</li>
        <li>القواعد العسكرية للآليات: مستوى ${player.buildings.military_base}</li>
        <li>المصانع والمباني الاقتصادية: مستوى ${player.buildings.industry}</li>
        <li>المخابئ والمستشفيات الميدانية: مستوى ${player.buildings.bunker}</li>
        <li>شبكة الطرق السريعة المستحدثة: مستوى ${player.buildings.highway}</li>
        <li>المطارات العسكرية النشطة: مستوى ${player.buildings.airfield}</li>
    `;

    // تحديث جدول الجيوش والسرعات
    const tbody = document.getElementById('army-table-body');
    tbody.innerHTML = '';
    for(let key in player.army) {
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${unitBlueprints[key].name}</strong></td>
            <td>${player.army[key]}</td>
            <td><span class="highlight">${unitBlueprints[key].speed}</span></td>
            <td>${unitBlueprints[key].role}</td>
        `;
        tbody.appendChild(tr);
    }
}

// نظام البناء وتطوير المنشآت
function buildStructure(type) {
    let player = gamePlayers[activePlayerIndex];
    if(type === 'mobilization' && player.resources.iron >= 50) { player.resources.iron -= 50; player.buildings.mobilization++; }
    else if(type === 'military_base' && player.resources.iron >= 80 && player.resources.rare >= 20) { player.resources.iron -= 80; player.resources.rare -= 20; player.buildings.military_base++; }
    else if(type === 'industry' && player.resources.iron >= 60) { player.resources.iron -= 60; player.buildings.industry++; }
    else if(type === 'bunker' && player.resources.iron >= 40) { player.resources.iron -= 40; player.buildings.bunker++; }
    else if(type === 'highway' && player.resources.iron >= 30) { player.resources.iron -= 30; player.buildings.highway++; }
    else if(type === 'airfield' && player.resources.iron >= 70 && player.resources.rare >= 30) { player.resources.iron -= 70; player.resources.rare -= 30; player.buildings.airfield++; }
    else { alert('الموارد غير كافية لإتمام عملية البناء العسكري العاجل!'); return; }
    renderTurn();
}

// نظام التجنيد وإنتاج العتاد
function trainUnit(type) {
    let player = gamePlayers[activePlayerIndex];
    if(player.resources.cash >= 30 && player.resources.manpower >= 10) {
        player.resources.cash -= 30;
        player.resources.manpower -= 10;
        player.army[type]++;
        renderTurn();
    } else {
        alert('النقد أو القوة البشرية غير كافية لتدريب وتجهيز الفيلق الجديد!');
    }
}

// إنهاء الدور وتدوير المحرك الاقتصادي واللوجستي لإنتاج الموارد
document.getElementById('end-turn-btn').addEventListener('click', () => {
    let player = gamePlayers[activePlayerIndex];
    
    // معادلة إنتاج الموارد بناء على مستوى المصانع والمباني الاقتصادية
    player.resources.oil += 20 * player.buildings.industry;
    player.resources.iron += 25 * player.buildings.industry;
    player.resources.rare += 5 * player.buildings.industry;
    player.resources.industrial += 10 * player.buildings.industry;
    player.resources.logistics += 15 * player.buildings.industry;
    player.resources.cash += 40 * player.buildings.industry;
    player.resources.manpower += 15 * player.buildings.mobilization; // التجنيد يرفع العنصر البشري

    // الانتقال للاعب التالي (محاكاة الأونلاين Pass-and-Play التكتيكية)
    activePlayerIndex = (activePlayerIndex + 1) % gamePlayers.length;
    renderTurn();
    alert(`انتقل الأمر العسكري الآن إلى القائد التالي!`);
});
