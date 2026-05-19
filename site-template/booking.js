(function () {
  const slug = document.body.dataset.siteSlug;
  if (!slug) return;

  const dateInput = document.getElementById("appt-date");
  const slotsGrid = document.getElementById("slots-grid");
  const bookingForm = document.getElementById("booking-form");
  const selectedLabel = document.getElementById("selected-slot-label");
  const messageEl = document.getElementById("booking-message");

  let selectedDate = "";
  let selectedTime = "";

  const today = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 60);
  dateInput.min = today.toISOString().slice(0, 10);
  dateInput.max = maxDate.toISOString().slice(0, 10);
  dateInput.value = dateInput.min;

  function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = `booking-message ${type}`;
    messageEl.hidden = false;
  }

  function hideForm() {
    bookingForm.hidden = true;
    selectedTime = "";
  }

  async function loadSlots() {
    selectedDate = dateInput.value;
    hideForm();
    slotsGrid.innerHTML = '<p class="slots-hint">Yükleniyor...</p>';

    try {
      const res = await fetch(`/api/sites/${encodeURIComponent(slug)}/slots?date=${selectedDate}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Saatler yüklenemedi.");

      if (!data.slots.length) {
        slotsGrid.innerHTML = '<p class="slots-hint">Bu tarihte müsait saat yok (kapalı gün veya dolu).</p>';
        return;
      }

      const available = data.slots.filter((s) => s.available);
      if (!available.length) {
        slotsGrid.innerHTML = '<p class="slots-hint">Bu tarihte boş saat kalmadı. Başka bir gün deneyin.</p>';
        return;
      }

      slotsGrid.innerHTML = data.slots
        .map(
          (slot) => `
        <button type="button" class="slot-btn ${slot.available ? "" : "slot-busy"}"
          data-time="${slot.time}" ${slot.available ? "" : "disabled"}>
          ${slot.time}
        </button>
      `
        )
        .join("");

      slotsGrid.querySelectorAll(".slot-btn:not(.slot-busy)").forEach((btn) => {
        btn.addEventListener("click", () => {
          slotsGrid.querySelectorAll(".slot-btn").forEach((b) => b.classList.remove("slot-selected"));
          btn.classList.add("slot-selected");
          selectedTime = btn.dataset.time;
          selectedLabel.textContent = `${formatDateTr(selectedDate)} — ${selectedTime}`;
          bookingForm.hidden = false;
          messageEl.hidden = true;
        });
      });
    } catch (err) {
      slotsGrid.innerHTML = `<p class="slots-hint slots-error">${err.message}</p>`;
    }
  }

  function formatDateTr(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }

  dateInput.addEventListener("change", loadSlots);

  bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime) {
      showMessage("Lütfen tarih ve saat seçin.", "error");
      return;
    }

    const payload = {
      date: selectedDate,
      time: selectedTime,
      customerName: document.getElementById("customerName").value,
      customerPhone: document.getElementById("customerPhone").value,
      customerEmail: document.getElementById("customerEmail").value,
      note: document.getElementById("customerNote").value,
    };

    try {
      const res = await fetch(`/api/sites/${encodeURIComponent(slug)}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Randevu oluşturulamadı.");

      showMessage(
        `Randevunuz oluşturuldu! ${formatDateTr(selectedDate)} saat ${selectedTime}. Teşekkürler.`,
        "success"
      );
      bookingForm.reset();
      bookingForm.hidden = true;
      loadSlots();
    } catch (err) {
      showMessage(err.message, "error");
    }
  });

  loadSlots();
})();
