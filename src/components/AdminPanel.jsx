import { useState, useEffect, useCallback } from 'react'
import Modal from './Modal'
import { TIME_SLOTS, USERS, MONTHS_PL } from '../lib/supabase'
import { 
  getReservations, 
  getReservationsByDateRange,
  cancelReservation,
  createReservation,
  updateReservationNote,
  getEvents,
  getAuditLog,
  getAppErrors,
  getBlockedSlots,
  createBlockedSlot,
  deleteBlockedSlot,
  getStatistics,
  subscribeToReservations,
  subscribeToBlockedSlots
} from '../lib/api'
import { 
  formatDate, 
  formatDatePL, 
  formatDateTime, 
  isSameDay, 
  getStartOfDay, 
  addDays,
  parseDate 
} from '../lib/utils'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'

const DAYS_PL_FULL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota']

// Funkcja do skracania nazwy apartamentu
const shortApartmentName = (name) => {
  if (name && name.startsWith('APARTAMENT ')) {
    return name.replace('APARTAMENT ', '')
  }
  return name
}

export default function AdminPanel({ user, showToast }) {
  const [activeTab, setActiveTab] = useState('calendar')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [reservations, setReservations] = useState([])
  const [events, setEvents] = useState([])
  const [blockedSlots, setBlockedSlots] = useState([])
  
  const [analysisMonthFrom, setAnalysisMonthFrom] = useState('')
  const [analysisMonthTo, setAnalysisMonthTo] = useState('')
  const [analysisData, setAnalysisData] = useState(null)
  const [statsDateFrom, setStatsDateFrom] = useState('')
  const [statsDateTo, setStatsDateTo] = useState('')
  const [statistics, setStatistics] = useState(null)
  const [adminCalendarDate, setAdminCalendarDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [bookingModal, setBookingModal] = useState(null)
  const [selectedUserForBooking, setSelectedUserForBooking] = useState('')
  const [bookingNote, setBookingNote] = useState('')
  const [blockModal, setBlockModal] = useState(null)
  const [blockReason, setBlockReason] = useState('')
  const [noteModal, setNoteModal] = useState(null)
  const [editingNote, setEditingNote] = useState('')
  const [auditLog, setAuditLog] = useState([])
  const [appErrors, setAppErrors] = useState([])

  const today = getStartOfDay(new Date())

  const getAdminDisplayDates = () => {
    const dates = []
    for (let i = 0; i < 7; i++) dates.push(addDays(adminCalendarDate, i))
    return dates
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [res, blocked] = await Promise.all([
        getReservations(),
        getBlockedSlots()
      ])
      setReservations(res)
      setBlockedSlots(blocked)
    } catch (err) {
      showToast('Błąd ładowania danych: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // Osobna funkcja do ładowania eventów z filtrowaniem
  const loadEvents = useCallback(async () => {
    try {
      const evt = await getEvents(dateFrom || null, dateTo || null)
      setEvents(evt)
    } catch (err) {
      showToast('Błąd ładowania historii: ' + err.message, 'error')
    }
  }, [dateFrom, dateTo, showToast])

  useEffect(() => {
    loadData()
    const unsub1 = subscribeToReservations(() => loadData())
    const unsub2 = subscribeToBlockedSlots(() => loadData())
    return () => { unsub1(); unsub2() }
  }, [loadData])

  // Ładuj eventy gdy zmienią się filtry lub gdy przełączymy na zakładkę historia
  useEffect(() => {
    if (activeTab === 'history') {
      loadEvents()
    }
  }, [activeTab, dateFrom, dateTo, loadEvents])

  const getReservationsForDate = (date) => reservations.filter(r => isSameDay(parseDate(r.date), date)).sort((a, b) => a.hour - b.hour)
  const getBlockedSlotInfo = (date, hour) => blockedSlots.find(b => isSameDay(parseDate(b.date), date) && b.hour === hour)

  const handleAdminCancel = (reservation) => {
    setModal({
      title: 'Odwołanie rezerwacji (Admin)',
      message: `Czy na pewno chcesz odwołać rezerwację ${reservation.user_code} na ${formatDateTime(reservation.date, reservation.hour)}?`,
      onConfirm: async () => {
        try {
          setActionLoading(true)
          await cancelReservation(reservation.id, reservation.user_code, true, user)
          setModal(null)
          showToast('Rezerwacja odwołana', 'success')
          await loadData()
        } catch (err) { showToast('Błąd: ' + err.message, 'error') }
        finally { setActionLoading(false) }
      },
      onCancel: () => setModal(null)
    })
  }

  const handleAdminBooking = (date, hour) => { setBookingModal({ date, hour }); setSelectedUserForBooking(''); setBookingNote('') }

  const confirmAdminBooking = async () => {
    if (!selectedUserForBooking) { showToast('Wybierz apartament', 'error'); return }
    try {
      setActionLoading(true)
      await createReservation(selectedUserForBooking, bookingModal.date, bookingModal.hour, true, user, bookingNote || null)
      setBookingModal(null); setSelectedUserForBooking(''); setBookingNote('')
      showToast(`Rezerwacja dla ${selectedUserForBooking} dodana!`, 'success')
      await loadData()
    } catch (err) { showToast('Błąd: ' + err.message, 'error') }
    finally { setActionLoading(false) }
  }

  const handleBlockSlot = (date, hour) => { setBlockModal({ date, hour }); setBlockReason('') }

  const confirmBlockSlot = async () => {
    try {
      setActionLoading(true)
      await createBlockedSlot(blockModal.date, blockModal.hour, blockReason || 'Zablokowane', user)
      setBlockModal(null)
      setBlockReason('')
      showToast('Termin zablokowany', 'success')
      await loadData()
    } catch (err) { 
      showToast('Błąd: ' + err.message, 'error') 
      setBlockModal(null)
      setBlockReason('')
    }
    finally { setActionLoading(false) }
  }

  const handleUnblockSlot = (blockedSlot) => {
    setModal({
      title: 'Odblokowanie terminu',
      message: `Odblokować ${formatDateTime(blockedSlot.date, blockedSlot.hour)}?`,
      onConfirm: async () => {
        try {
          setActionLoading(true)
          await deleteBlockedSlot(blockedSlot.id, user)
          setModal(null)
          showToast('Termin odblokowany', 'success')
          await loadData()
        } catch (err) { 
          showToast('Błąd: ' + err.message, 'error')
          setModal(null)
        }
        finally { setActionLoading(false) }
      },
      onCancel: () => setModal(null)
    })
  }

  const handleEditNote = (reservation) => { setNoteModal(reservation); setEditingNote(reservation.note || '') }

  const confirmEditNote = async () => {
    try {
      setActionLoading(true)
      await updateReservationNote(noteModal.id, editingNote, user)
      setNoteModal(null); setEditingNote('')
      showToast('Notatka zapisana', 'success')
      await loadData()
    } catch (err) { showToast('Błąd: ' + err.message, 'error') }
    finally { setActionLoading(false) }
  }

  const loadStatistics = async () => {
    try {
      setLoading(true)
      const stats = await getStatistics(statsDateFrom || null, statsDateTo || null)
      setStatistics(stats)
    } catch (err) { showToast('Błąd statystyk: ' + err.message, 'error') }
    finally { setLoading(false) }
  }

  const generateMonthOptions = () => {
    const options = []
    const currentDate = new Date()
    for (let i = -24; i <= 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1)
      options.push({ value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label: `${MONTHS_PL[date.getMonth()]} ${date.getFullYear()}` })
    }
    return options
  }

  const getMonthRange = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number)
    return { firstDay: new Date(year, month - 1, 1), lastDay: new Date(year, month, 0) }
  }

  const getMonthsBetween = (fromMonth, toMonth) => {
    const months = []
    const [fromYear, fromM] = fromMonth.split('-').map(Number)
    const [toYear, toM] = toMonth.split('-').map(Number)
    let current = new Date(fromYear, fromM - 1, 1)
    const end = new Date(toYear, toM - 1, 1)
    while (current <= end) {
      months.push({ value: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`, label: `${MONTHS_PL[current.getMonth()]} ${current.getFullYear()}`, shortLabel: `${MONTHS_PL[current.getMonth()].substring(0, 3)} ${current.getFullYear()}` })
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
    }
    return months
  }

  const loadAnalysisData = async () => {
    if (!analysisMonthFrom || !analysisMonthTo) { showToast('Wybierz zakres', 'error'); return }
    if (analysisMonthFrom > analysisMonthTo) { showToast('Zła kolejność dat', 'error'); return }
    try {
      setLoading(true)
      const { firstDay } = getMonthRange(analysisMonthFrom)
      const { lastDay } = getMonthRange(analysisMonthTo)
      const [reservationsData] = await Promise.all([getReservationsByDateRange(formatDate(firstDay), formatDate(lastDay))])
      const months = getMonthsBetween(analysisMonthFrom, analysisMonthTo)
      const apartmentData = USERS.map(apartment => {
        const monthlyData = months.map(month => {
          const { firstDay: mFirst, lastDay: mLast } = getMonthRange(month.value)
          const count = reservationsData.filter(r => r.user_code === apartment && r.status === 'active' && r.date >= formatDate(mFirst) && r.date <= formatDate(mLast)).length
          return { month: month.value, count }
        })
        return { apartment, monthlyData, total: monthlyData.reduce((sum, m) => sum + m.count, 0) }
      })
      const monthlyTotals = months.map(month => ({ month: month.value, label: month.shortLabel, total: apartmentData.reduce((sum, apt) => sum + (apt.monthlyData.find(m => m.month === month.value)?.count || 0), 0) }))
      setAnalysisData({ months, apartmentData, monthlyTotals, grandTotal: apartmentData.reduce((sum, apt) => sum + apt.total, 0), dateRange: { from: formatDatePL(firstDay), to: formatDatePL(lastDay) } })
    } catch (err) { showToast('Błąd raportu: ' + err.message, 'error') }
    finally { setLoading(false) }
  }

  const exportToExcel = async () => {
    try {
      const data = await getReservationsByDateRange(dateFrom || null, dateTo || null)
      const exportData = data.map(r => ({ 'Data': r.date, 'Godzina': `${r.hour}:00`, 'Apartament': r.user_code, 'Status': r.status === 'active' ? 'Aktywna' : 'Anulowana', 'Notatka': r.note || '', 'Admin': r.created_by || '-' }))
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Rezerwacje')
      XLSX.writeFile(wb, `rezerwacje_${dateFrom || 'all'}_${dateTo || 'all'}.xlsx`)
      showToast('Excel wyeksportowany!', 'success')
    } catch (err) { showToast('Błąd eksportu: ' + err.message, 'error') }
  }

  // Mapowanie polskich znaków na ASCII dla PDF
  const removeDiacritics = (str) => {
    const map = { 'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
                  'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z' }
    return str.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, c => map[c] || c)
  }

  const exportAnalysisToPDF = () => {
    if (!analysisData) return
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 8
    const numMonths = analysisData.months.length
    const fontSize = numMonths > 6 ? 6 : 8
    const rowHeight = numMonths > 6 ? 4.5 : 5.5
    const apartmentColWidth = 30
    const totalColWidth = 12
    const availableWidth = pageWidth - 2 * margin - apartmentColWidth - totalColWidth
    const monthColWidth = Math.min(availableWidth / numMonths, 18)
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Raport rezerwacji Wellness', pageWidth / 2, margin + 4, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Okres: ${removeDiacritics(analysisData.dateRange.from)} - ${removeDiacritics(analysisData.dateRange.to)}`, pageWidth / 2, margin + 9, { align: 'center' })
    
    let startY = margin + 14
    let startX = margin
    
    doc.setFillColor(34, 197, 94)
    doc.rect(startX, startY, apartmentColWidth + numMonths * monthColWidth + totalColWidth, rowHeight + 1, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(fontSize)
    doc.setFont('helvetica', 'bold')
    doc.text('Apartament', startX + 1, startY + rowHeight - 0.5)
    
    let xPos = startX + apartmentColWidth
    analysisData.months.forEach(month => {
      doc.text(removeDiacritics(month.shortLabel).substring(0, 7), xPos + monthColWidth / 2, startY + rowHeight - 0.5, { align: 'center' })
      xPos += monthColWidth
    })
    doc.text('Suma', xPos + totalColWidth / 2, startY + rowHeight - 0.5, { align: 'center' })
    
    startY += rowHeight + 1
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    
    analysisData.apartmentData.forEach((apt, index) => {
      if (index % 2 === 0) { doc.setFillColor(240, 253, 244); doc.rect(startX, startY, apartmentColWidth + numMonths * monthColWidth + totalColWidth, rowHeight, 'F') }
      doc.text(apt.apartment, startX + 1, startY + rowHeight - 1)
      xPos = startX + apartmentColWidth
      apt.monthlyData.forEach(m => { doc.text(String(m.count), xPos + monthColWidth / 2, startY + rowHeight - 1, { align: 'center' }); xPos += monthColWidth })
      doc.setFont('helvetica', 'bold')
      doc.text(String(apt.total), xPos + totalColWidth / 2, startY + rowHeight - 1, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      startY += rowHeight
    })
    
    doc.setFillColor(34, 197, 94)
    doc.rect(startX, startY, apartmentColWidth + numMonths * monthColWidth + totalColWidth, rowHeight + 1, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text('SUMA', startX + 1, startY + rowHeight - 0.5)
    xPos = startX + apartmentColWidth
    analysisData.monthlyTotals.forEach(m => { doc.text(String(m.total), xPos + monthColWidth / 2, startY + rowHeight - 0.5, { align: 'center' }); xPos += monthColWidth })
    doc.text(String(analysisData.grandTotal), xPos + totalColWidth / 2, startY + rowHeight - 0.5, { align: 'center' })
    
    doc.setTextColor(128, 128, 128)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(`Wygenerowano: ${new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })} | Admin: ${user}`, pageWidth / 2, pageHeight - 4, { align: 'center' })
    
    doc.save(`raport_wellness_${analysisMonthFrom}_${analysisMonthTo}.pdf`)
    showToast('PDF wygenerowany!', 'success')
  }

  const exportAnalysisToExcel = () => {
    if (!analysisData) return
    const headers = ['Apartament', ...analysisData.months.map(m => m.shortLabel), 'Suma']
    const data = analysisData.apartmentData.map(apt => [apt.apartment, ...apt.monthlyData.map(m => m.count), apt.total])
    data.push(['SUMA', ...analysisData.monthlyTotals.map(m => m.total), analysisData.grandTotal])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Raport')
    XLSX.writeFile(wb, `raport_wellness_${analysisMonthFrom}_${analysisMonthTo}.xlsx`)
    showToast('Excel wygenerowany!', 'success')
  }

  // Obsługa wyboru daty z date picker
  const handleDatePickerChange = (e) => {
    const selectedDate = new Date(e.target.value)
    setAdminCalendarDate(selectedDate)
    setShowDatePicker(false)
  }

  if (loading && reservations.length === 0) return <div className="flex-1 flex items-center justify-center"><div className="loader"></div></div>

  return (
    <div className="flex-1 p-4 md:p-8">
      <div className="flex flex-wrap gap-2 mb-6">
        {[{ id: 'calendar', label: '📅 Kalendarz' }, { id: 'blocked', label: '🚫 Blokady' }, { id: 'stats', label: '📊 Statystyki' }, { id: 'history', label: '📋 Historia' }, { id: 'analysis', label: '📈 Raport' }, { id: 'errors', label: '⚠️ Błędy' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 rounded-xl font-semibold transition-all ${activeTab === tab.id ? 'bg-green-500 text-white shadow-lg' : 'bg-white text-green-700 border-2 border-green-200 hover:border-green-400'}`}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'calendar' && (
        <div className="bg-white rounded-3xl p-4 md:p-8 shadow-xl border-2 border-green-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h2 className="font-display text-xl md:text-2xl text-green-800">📅 Zarządzanie rezerwacjami</h2>
            <div className="flex flex-wrap gap-2">
              <button className="px-3 py-2 bg-green-100 text-green-800 rounded-lg font-semibold hover:bg-green-200 text-sm" onClick={() => setAdminCalendarDate(addDays(adminCalendarDate, -7))}>← Tydz</button>
              <button className="px-3 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 text-sm" onClick={() => setAdminCalendarDate(today)}>Dziś</button>
              <button className="px-3 py-2 bg-green-100 text-green-800 rounded-lg font-semibold hover:bg-green-200 text-sm" onClick={() => setAdminCalendarDate(addDays(adminCalendarDate, 7))}>Tydz →</button>
              <div className="relative">
                <button className="px-3 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 text-sm" onClick={() => setShowDatePicker(!showDatePicker)}>📆 Wybierz datę</button>
                {showDatePicker && (
                  <div className="absolute top-12 right-0 z-50 bg-white rounded-xl shadow-2xl p-4 border-2 border-blue-200">
                    <input 
                      type="date" 
                      className="px-4 py-2 border-2 border-blue-200 rounded-xl"
                      onChange={handleDatePickerChange}
                      defaultValue={formatDate(adminCalendarDate)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-8 gap-1 md:gap-2 min-w-[600px]">
              {/* Header - godzina sticky na mobile */}
              <div className="p-2 md:p-3 font-bold text-green-800 text-center text-sm sticky left-0 bg-white z-10">Godz.</div>
              {getAdminDisplayDates().map(date => (
                <div key={date.toISOString()} className={`p-2 md:p-3 font-bold text-center rounded-xl text-xs md:text-sm ${isSameDay(date, today) ? 'bg-green-500 text-white' : 'bg-green-100 text-green-800'}`}>
                  <div className="hidden md:block">{formatDatePL(date)}</div>
                  <div className="md:hidden">{date.getDate()}.{date.getMonth()+1}</div>
                  <div className="text-xs opacity-75">{['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'][date.getDay()]}</div>
                </div>
              ))}
              {TIME_SLOTS.filter(s => s.bookable).map(slot => (
                <div key={`row-${slot.hour}`} className="contents">
                  <div className="p-2 md:p-3 font-bold text-green-800 text-center bg-green-50 rounded-xl text-sm sticky left-0 z-10">{slot.hour}:00</div>
                  {getAdminDisplayDates().map(date => {
                    const reservation = getReservationsForDate(date).find(r => r.hour === slot.hour)
                    const blocked = getBlockedSlotInfo(date, slot.hour)
                    if (blocked) return (
                      <div key={`${date.toISOString()}-${slot.hour}`} className="p-1 md:p-2 bg-orange-100 border-2 border-orange-300 rounded-xl text-center cursor-pointer hover:bg-orange-200" onClick={() => handleUnblockSlot(blocked)} title={`Zablokowane przez: ${blocked.created_by}`}>
                        <div className="text-orange-800 font-semibold text-xs">🚫</div>
                        <div className="text-orange-600 text-xs truncate hidden md:block">{blocked.reason}</div>
                        <div className="text-orange-500 text-xs hidden md:block">({blocked.created_by})</div>
                      </div>
                    )
                    if (reservation) return (
                      <div key={`${date.toISOString()}-${slot.hour}`} className="p-1 md:p-2 bg-green-100 border-2 border-green-300 rounded-xl">
                        <div className="text-green-800 font-bold text-sm md:text-base text-center" title={reservation.user_code}>
                          <span className="md:hidden">{shortApartmentName(reservation.user_code)}</span>
                          <span className="hidden md:inline text-xs">{reservation.user_code}</span>
                        </div>
                        {reservation.created_by && <div className="text-blue-600 text-xs hidden md:block">Admin: {reservation.created_by}</div>}
                        {reservation.note && <div className="text-gray-500 text-xs truncate hidden md:block" title={reservation.note}>📝 {reservation.note}</div>}
                        <div className="flex gap-1 mt-1">
                          <button className="flex-1 px-1 md:px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600" onClick={() => handleEditNote(reservation)}>📝</button>
                          <button className="flex-1 px-1 md:px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600" onClick={() => handleAdminCancel(reservation)}>✕</button>
                        </div>
                      </div>
                    )
                    return (
                      <div key={`${date.toISOString()}-${slot.hour}`} className="p-1 md:p-2 bg-gray-50 border-2 border-gray-200 rounded-xl text-center">
                        <div className="flex flex-col gap-1">
                          <button className="w-full px-1 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600" onClick={() => handleAdminBooking(date, slot.hour)}>+</button>
                          <button className="w-full px-1 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600" onClick={() => handleBlockSlot(date, slot.hour)}>🚫</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'blocked' && (
        <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-orange-200">
          <h2 className="font-display text-2xl text-orange-800 mb-6">🚫 Zablokowane terminy</h2>
          {blockedSlots.length === 0 ? <div className="text-center py-10 text-gray-500">Brak zablokowanych terminów</div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-orange-100"><th className="p-4 text-left font-bold text-orange-800">Data</th><th className="p-4 text-left font-bold text-orange-800">Godzina</th><th className="p-4 text-left font-bold text-orange-800">Powód</th><th className="p-4 text-left font-bold text-orange-800">Zablokował</th><th className="p-4 text-left font-bold text-orange-800">Akcja</th></tr></thead>
                <tbody>{blockedSlots.map(slot => (
                  <tr key={slot.id} className="border-b-2 border-orange-100 hover:bg-orange-50">
                    <td className="p-4">{formatDatePL(slot.date)}</td><td className="p-4">{slot.hour}:00</td><td className="p-4">{slot.reason}</td><td className="p-4 font-semibold">{slot.created_by}</td>
                    <td className="p-4"><button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600" onClick={() => handleUnblockSlot(slot)}>Odblokuj</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-blue-200">
          <h2 className="font-display text-2xl text-blue-800 mb-6">📊 Statystyki</h2>
          <div className="flex flex-wrap gap-4 mb-6">
            <div><label className="block text-sm font-semibold text-gray-700 mb-1">Od</label><input type="date" value={statsDateFrom} onChange={(e) => setStatsDateFrom(e.target.value)} className="px-4 py-2 border-2 border-blue-200 rounded-xl focus:outline-none focus:border-blue-400" /></div>
            <div><label className="block text-sm font-semibold text-gray-700 mb-1">Do</label><input type="date" value={statsDateTo} onChange={(e) => setStatsDateTo(e.target.value)} className="px-4 py-2 border-2 border-blue-200 rounded-xl focus:outline-none focus:border-blue-400" /></div>
            <div className="flex items-end"><button className="px-6 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600" onClick={loadStatistics}>Generuj</button></div>
          </div>
          {statistics && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-green-100 rounded-2xl p-6 text-center"><div className="text-4xl font-bold text-green-800">{statistics.totalActive}</div><div className="text-green-600">Aktywnych</div></div>
                <div className="bg-red-100 rounded-2xl p-6 text-center"><div className="text-4xl font-bold text-red-800">{statistics.totalCancelled}</div><div className="text-red-600">Anulowanych ({statistics.cancellationRate}%)</div></div>
                <div className="bg-blue-100 rounded-2xl p-6 text-center"><div className="text-4xl font-bold text-blue-800">{statistics.mostPopularHour[0]}:00</div><div className="text-blue-600">Popularna godzina</div></div>
                <div className="bg-purple-100 rounded-2xl p-6 text-center"><div className="text-4xl font-bold text-purple-800">{statistics.adminBookings}</div><div className="text-purple-600">Rez. przez admina</div></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="font-bold text-gray-800 mb-4">Wg dnia tygodnia</h3>
                  <div className="space-y-2">{DAYS_PL_FULL.map((day, idx) => {
                    const count = statistics.byDayOfWeek[idx]; const maxCount = Math.max(...statistics.byDayOfWeek, 1)
                    return (<div key={day} className="flex items-center gap-2"><div className="w-24 text-sm text-gray-600">{day}</div><div className="flex-1 bg-gray-200 rounded-full h-6"><div className="bg-blue-500 rounded-full h-6 flex items-center justify-end pr-2" style={{ width: `${Math.max((count / maxCount) * 100, 10)}%` }}><span className="text-white text-xs font-bold">{count}</span></div></div></div>)
                  })}</div>
                </div>
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="font-bold text-gray-800 mb-4">Wg godziny</h3>
                  <div className="space-y-2">{TIME_SLOTS.filter(s => s.bookable).map(slot => {
                    const count = statistics.byHour[slot.hour] || 0; const maxCount = Math.max(...Object.values(statistics.byHour), 1)
                    return (<div key={slot.hour} className="flex items-center gap-2"><div className="w-16 text-sm text-gray-600">{slot.hour}:00</div><div className="flex-1 bg-gray-200 rounded-full h-6"><div className="bg-green-500 rounded-full h-6 flex items-center justify-end pr-2" style={{ width: `${Math.max((count / maxCount) * 100, 10)}%` }}><span className="text-white text-xs font-bold">{count}</span></div></div></div>)
                  })}</div>
                </div>
                <div className="bg-gray-50 rounded-2xl p-6 lg:col-span-2">
                  <h3 className="font-bold text-gray-800 mb-4">Top 5 apartamentów</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">{statistics.topApartments.map(([apt, count], idx) => (
                    <div key={apt} className="bg-white rounded-xl p-4 text-center shadow"><div className="text-2xl mb-2">{['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][idx]}</div><div className="font-bold text-gray-800 text-sm">{apt}</div><div className="text-2xl font-bold text-green-600">{count}</div></div>
                  ))}</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-purple-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h2 className="font-display text-2xl text-purple-800">📋 Historia zdarzeń</h2>
            <div className="flex flex-wrap gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-4 py-2 border-2 border-purple-200 rounded-xl" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-4 py-2 border-2 border-purple-200 rounded-xl" />
              <button className="px-4 py-2 bg-purple-500 text-white rounded-xl font-semibold hover:bg-purple-600" onClick={loadEvents}>Filtruj</button>
              <button className="px-4 py-2 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600" onClick={exportToExcel}>📊 Excel</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-purple-100"><th className="p-4 text-left font-bold text-purple-800 text-sm">Data</th><th className="p-4 text-left font-bold text-purple-800 text-sm">Typ</th><th className="p-4 text-left font-bold text-purple-800 text-sm">Apartament</th><th className="p-4 text-left font-bold text-purple-800 text-sm">Termin</th><th className="p-4 text-left font-bold text-purple-800 text-sm">Admin</th><th className="p-4 text-left font-bold text-purple-800 text-sm">Notatka</th></tr></thead>
              <tbody>{events.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-gray-500">Brak zdarzeń w wybranym okresie</td></tr>
              ) : events.map(e => (
                <tr key={e.id} className="border-b-2 border-purple-100 hover:bg-purple-50">
                  <td className="p-4">{new Date(e.created_at).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}</td>
                  <td className="p-4"><span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${e.type === 'reservation' ? 'bg-green-100 text-green-800' : e.type === 'admin-booking' ? 'bg-blue-100 text-blue-800' : e.type === 'cancellation' ? 'bg-red-100 text-red-800' : e.type === 'admin-cancel' ? 'bg-orange-100 text-orange-800' : e.type === 'block' ? 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800'}`}>
                    {e.type === 'reservation' ? 'Rezerwacja' : e.type === 'admin-booking' ? 'Rez. (Admin)' : e.type === 'cancellation' ? 'Odwołanie' : e.type === 'admin-cancel' ? 'Odw. (Admin)' : e.type === 'block' ? 'Blokada' : e.type === 'unblock' ? 'Odblokowanie' : e.type}
                  </span></td>
                  <td className="p-4">{e.user_code || '-'}</td>
                  <td className="p-4">{formatDatePL(e.date)}, {e.hour}:00</td>
                  <td className="p-4 font-semibold text-blue-600">{e.admin_user || '-'}</td>
                  <td className="p-4 text-sm text-gray-600">{e.note || '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'analysis' && (
        <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-indigo-200">
          <h2 className="font-display text-2xl text-indigo-800 mb-6">📈 Raport miesięczny</h2>
          <div className="flex flex-wrap gap-4 mb-6">
            <div><label className="block text-sm font-semibold text-gray-700 mb-1">Od</label><select value={analysisMonthFrom} onChange={(e) => setAnalysisMonthFrom(e.target.value)} className="px-4 py-2 border-2 border-indigo-200 rounded-xl bg-white"><option value="">Wybierz...</option>{generateMonthOptions().map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
            <div><label className="block text-sm font-semibold text-gray-700 mb-1">Do</label><select value={analysisMonthTo} onChange={(e) => setAnalysisMonthTo(e.target.value)} className="px-4 py-2 border-2 border-indigo-200 rounded-xl bg-white"><option value="">Wybierz...</option>{generateMonthOptions().map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
            <div className="flex items-end"><button className="px-6 py-2 bg-indigo-500 text-white rounded-xl font-semibold hover:bg-indigo-600" onClick={loadAnalysisData}>Generuj raport</button></div>
          </div>
          {analysisData && (
            <>
              <div className="flex gap-2 mb-4">
                <button className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600" onClick={exportAnalysisToPDF}>📄 PDF</button>
                <button className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600" onClick={exportAnalysisToExcel}>📊 Excel</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-indigo-100"><th className="p-3 text-left font-bold text-indigo-800">Apartament</th>{analysisData.months.map(m => <th key={m.value} className="p-3 text-center font-bold text-indigo-800">{m.shortLabel}</th>)}<th className="p-3 text-center font-bold text-indigo-800 bg-indigo-200">SUMA</th></tr></thead>
                  <tbody>
                    {analysisData.apartmentData.map((apt, idx) => <tr key={apt.apartment} className={idx % 2 === 0 ? 'bg-indigo-50' : 'bg-white'}><td className="p-3 font-semibold">{apt.apartment}</td>{apt.monthlyData.map(m => <td key={m.month} className="p-3 text-center">{m.count}</td>)}<td className="p-3 text-center font-bold bg-indigo-100">{apt.total}</td></tr>)}
                    <tr className="bg-indigo-500 text-white"><td className="p-3 font-bold">SUMA</td>{analysisData.monthlyTotals.map(m => <td key={m.month} className="p-3 text-center font-bold">{m.total}</td>)}<td className="p-3 text-center font-bold bg-indigo-600">{analysisData.grandTotal}</td></tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'errors' && (
        <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-red-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-display text-2xl text-red-800">⚠️ Błędy aplikacji</h2>
            <button className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600" onClick={async () => { try { const data = await getAppErrors(50); setAppErrors(data); showToast('Odświeżone', 'success') } catch (err) { showToast('Błąd: ' + err.message, 'error') } }}>🔄 Odśwież</button>
          </div>
          {appErrors.length === 0 ? <div className="text-center py-10"><div className="text-6xl mb-4">🎉</div><div className="text-gray-500">Kliknij "Odśwież" lub brak błędów</div></div> : (
            <div className="space-y-4">{appErrors.map(err => (
              <div key={err.id} className="bg-red-50 rounded-xl p-4 border border-red-200">
                <div className="flex justify-between items-start mb-2"><span className="font-semibold text-red-800">{err.error_type}</span><span className="text-sm text-gray-500">{new Date(err.created_at).toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}</span></div>
                <p className="text-red-700 mb-2 font-mono text-sm">{err.error_message}</p>
                {err.user_code && <p className="text-sm text-gray-600">👤 {err.user_code}</p>}
                {err.error_stack && <details className="mt-2"><summary className="text-sm text-gray-500 cursor-pointer">Stack trace</summary><pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">{err.error_stack}</pre></details>}
              </div>
            ))}</div>
          )}
        </div>
      )}

      {modal && <Modal {...modal} loading={actionLoading} />}

      {bookingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="font-display text-2xl text-green-800 mb-4">Rezerwacja dla użytkownika</h3>
            <p className="text-green-600 mb-6">Termin: <strong>{formatDateTime(bookingModal.date, bookingModal.hour)}</strong></p>
            <div className="mb-4"><label className="block font-semibold text-green-800 mb-2">Apartament</label><select className="w-full px-4 py-3 border-2 border-green-200 rounded-xl bg-white" value={selectedUserForBooking} onChange={(e) => setSelectedUserForBooking(e.target.value)}><option value="">-- Wybierz --</option>{USERS.map(u => <option key={u} value={u}>{u}</option>)}</select></div>
            <div className="mb-6"><label className="block font-semibold text-green-800 mb-2">Notatka</label><textarea className="w-full px-4 py-3 border-2 border-green-200 rounded-xl resize-none" rows={2} value={bookingNote} onChange={(e) => setBookingNote(e.target.value)} placeholder="Opcjonalnie..." /></div>
            <div className="flex gap-4 justify-center">
              <button className="px-8 py-3 rounded-xl font-semibold border-2 border-green-200 text-green-800 hover:bg-green-50" onClick={() => { setBookingModal(null); setSelectedUserForBooking(''); setBookingNote('') }} disabled={actionLoading}>Anuluj</button>
              <button className="px-8 py-3 rounded-xl font-semibold bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 flex items-center gap-2" onClick={confirmAdminBooking} disabled={actionLoading || !selectedUserForBooking}>{actionLoading && <div className="loader w-4 h-4 border-2"></div>}Rezerwuj</button>
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">Admin: {user}</p>
          </div>
        </div>
      )}

      {blockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="font-display text-2xl text-orange-800 mb-4">🚫 Blokowanie terminu</h3>
            <p className="text-orange-600 mb-6">Termin: <strong>{formatDateTime(blockModal.date, blockModal.hour)}</strong></p>
            <div className="mb-6"><label className="block font-semibold text-orange-800 mb-2">Powód</label><input type="text" className="w-full px-4 py-3 border-2 border-orange-200 rounded-xl" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="np. Konserwacja" /></div>
            <div className="flex gap-4 justify-center">
              <button className="px-8 py-3 rounded-xl font-semibold border-2 border-orange-200 text-orange-800 hover:bg-orange-50" onClick={() => { setBlockModal(null); setBlockReason('') }} disabled={actionLoading}>Anuluj</button>
              <button className="px-8 py-3 rounded-xl font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2" onClick={confirmBlockSlot} disabled={actionLoading}>{actionLoading && <div className="loader w-4 h-4 border-2"></div>}Zablokuj</button>
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">Admin: {user}</p>
          </div>
        </div>
      )}

      {noteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="font-display text-2xl text-blue-800 mb-4">📝 Edycja notatki</h3>
            <p className="text-blue-600 mb-6">{noteModal.user_code} - {formatDateTime(noteModal.date, noteModal.hour)}</p>
            <div className="mb-6"><label className="block font-semibold text-blue-800 mb-2">Notatka</label><textarea className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl resize-none" rows={3} value={editingNote} onChange={(e) => setEditingNote(e.target.value)} placeholder="Dodaj notatkę..." /></div>
            <div className="flex gap-4 justify-center">
              <button className="px-8 py-3 rounded-xl font-semibold border-2 border-blue-200 text-blue-800 hover:bg-blue-50" onClick={() => { setNoteModal(null); setEditingNote('') }} disabled={actionLoading}>Anuluj</button>
              <button className="px-8 py-3 rounded-xl font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2" onClick={confirmEditNote} disabled={actionLoading}>{actionLoading && <div className="loader w-4 h-4 border-2"></div>}Zapisz</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
