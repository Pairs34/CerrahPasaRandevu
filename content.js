// LocalStorage'dan gerekli bilgileri alma
function getCredentials() {
  const credentials = JSON.parse(localStorage.getItem("credentials"));
  if (credentials) {
    return credentials;
  }
  console.error(
    "Credentials bulunamadı. Lütfen localStorage içeriğini kontrol edin."
  );
  return null;
}

// Randevu işlemlerinin durumu
let isRunning = false;
let intervalId;

// Floating Action Button (FAB) ekleme
function createFloatingButton() {
  const button = document.createElement("button");
  button.id = "start-button";
  button.textContent = "Başlat";
  document.body.appendChild(button);

  // Başlat/Durdur fonksiyonunu düğmeye bağlama
  button.addEventListener("click", toggleAppointments);
}

// Sayfa yüklendiğinde FAB oluşturma
window.addEventListener("load", () => {
  createFloatingButton();
});

// Başlat/Durdur kontrolü
function toggleAppointments() {
  const button = document.getElementById("start-button");

  if (isRunning) {
    isRunning = false;
    button.textContent = "Başlat"; // Durduruldu
    clearInterval(intervalId); // Döngüyü durdur
    console.log("Randevu işlemleri durduruldu.");
  } else {
    isRunning = true;
    button.textContent = "Durdur"; // Başlatıldı
    startAppointmentLoop(); // Döngüyü başlat
    console.log("Randevu işlemleri başlatıldı.");
  }
}

// Uygun saatleri sorgulama
async function fetchAvailableTimes() {
  const token = getCredentials()?.token;
  if (!token) {
    console.error("Token bulunamadı.");
    return [];
  }

  const url =
    "https://ishopweb.isuzem.com/proxy/api/2.0/MobileAppointmentApi/GetVisits/CTF/1060";
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    // CORS ve network hatalarını yakalamak için ek kontrol
    if (!response.ok) {
      console.error(
        "Saat sorgulama hatası:",
        response.status,
        response.statusText
      );
      const errorText = await response.text(); // Body kısmını debug için al
      console.error("Hata Detayı:", errorText);
      return [];
    }

    // Gelen JSON'u kontrol et
    const contentType = response.headers.get("Content-Type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("Beklenmeyen içerik tipi:", contentType);
      return [];
    }

    // JSON parse işlemi
    const data = await response.json();
    console.log("API'den Gelen Veri:", data);

    // Saatleri ayıklama
    return data.flatMap((day) =>
      day.items.filter((item) => item.verilebilir).map((item) => item.saat)
    );
  } catch (error) {
    console.error("Saat sorgulama başarısız:", error);
    return [];
  }
}

// Randevu alma
async function makeAppointment(appointmentTime) {
  const credentials = getCredentials();
  if (!credentials) return false;

  const url =
    "https://ishopweb.isuzem.com/proxy/api/2.0/MobileAppointmentApi/GetAppointment";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${credentials.token}`,
  };
  const body = {
    foundationCode: "CTF",
    reservation_result_model: {
      appointment_time: appointmentTime,
    },
    user: {
      name: credentials.name,
      surname: credentials.surname,
      identity_number: credentials.identity_number,
      phone_number: credentials.phone_number,
      father_name: credentials.father_name,
      birth_year: credentials.birth_year,
      birth_date: credentials.birth_date,
      gender: credentials.gender,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`Randevu sonucu (${appointmentTime}):`, data);

      if (data.is_appointment_setted) {
        return true; // Randevu alındı
      }
    } else {
      console.error("Randevu hatası:", response.statusText);
    }
  } catch (error) {
    console.error("Randevu başarısız:", error);
  }
  return false; // Randevu alınamadı
}

// Sürekli randevu kontrol döngüsü
function startAppointmentLoop() {
  intervalId = setInterval(async () => {
    const availableTimes = await fetchAvailableTimes();

    if (availableTimes.length === 0) {
      console.log("Uygun randevu bulunamadı.");
      return;
    }

    console.log("Randevu alınmaya çalışılan saatler:", availableTimes);

    for (const time of availableTimes) {
      const isAppointmentSet = await makeAppointment(time);
      if (isAppointmentSet) {
        alert("Randevu alındı! İşlemler durduruluyor.");
        clearInterval(intervalId); // Döngüyü durdur
        isRunning = false;
        document.getElementById("start-button").textContent = "Başlat";
        return;
      }
    }
  }, 1000); // 1 saniyelik döngü
}
