import { useState, useEffect, useCallback } from 'react'
import Modal from './Modal'
import { TIME_SLOTS, USERS, MONTHS_PL } from '../lib/supabase'
import { 
  getReservations, 
  getReservationsByDateRange,
  cancelReservation,
  createReservation,
  getEvents,
  getAuditLog,
  getAppErrors,
  subscribeToReservations 
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

export default function AdminPanel({ user, showToast }) {
  const [activeTab, setActiveTab] = useState('calendar')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [reservations, setReservations] = useState([])
  const [events, setEvents] = useState([])
  
  // Analysis report state
  const [analysisMonthFrom, setAnalysisMonthFrom] = useState('')
  const [analysisMonthTo, setAnalysisMonthTo] = useState('')
  const [analysisData, setAnalysisData] = useState(null)

  // Admin calendar - unlimited range
  const [adminCalendarDate, setAdminCalendarDate] = useState(new Date())
  
  // Admin booking for users
  const [bookingModal, setBookingModal] = useState(null)
  const [selectedUserForBooking, setSelectedUserForBooking] = useState('')
  
  // Audit log state
  const [auditLog, setAuditLog] = useState([])
  const [appErrors, setAppErrors] = useState([])

  const today = getStartOfDay(new Date())

  // Generate dates for admin calendar view (7 days from selected date)
  const getAdminDisplayDates = () => {
    const dates = []
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(adminCalendarDate, i))
    }
    return dates
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [res, evt] = await Promise.all([
        getReservations(),
        getEvents(dateFrom || null, dateTo || null)
      ])
      setReservations(res)
      setEvents(evt)
    } catch (err) {
      showToast('Błąd ładowania danych: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, showToast])

  useEffect(() => {
    loadData()
    
    const unsubscribe = subscribeToReservations(() => {
      loadData()
    })
    
    return () => unsubscribe()
  }, [loadData])

  // Get reservations for a specific date
  const getReservationsForDate = (date) => {
    return reservations.filter(r => 
      isSameDay(parseDate(r.date), date)
    ).sort((a, b) => a.hour - b.hour)
  }

  // Handle admin cancel
  const handleAdminCancel = (reservation) => {
    setModal({
      title: 'Odwołanie rezerwacji (Admin)',
      message: `Czy na pewno chcesz odwołać rezerwację użytkownika ${reservation.user_code} na ${formatDateTime(reservation.date, reservation.hour)}?`,
      onConfirm: async () => {
        try {
          setActionLoading(true)
          await cancelReservation(reservation.id, reservation.user_code, true, user)
          setModal(null)
          showToast('Rezerwacja została odwołana', 'success')
          await loadData()
        } catch (err) {
          showToast('Błąd: ' + err.message, 'error')
        } finally {
          setActionLoading(false)
        }
      },
      onCancel: () => setModal(null)
    })
  }

  // Handle admin booking for user
  const handleAdminBooking = (date, hour) => {
    setBookingModal({ date, hour })
    setSelectedUserForBooking('')
  }

  const confirmAdminBooking = async () => {
    if (!selectedUserForBooking) {
      showToast('Wybierz apartament', 'error')
      return
    }

    try {
      setActionLoading(true)
      await createReservation(selectedUserForBooking, bookingModal.date, bookingModal.hour, true, user)
      setBookingModal(null)
      setSelectedUserForBooking('')
      showToast(`Rezerwacja dla ${selectedUserForBooking} została dodana!`, 'success')
      await loadData()
    } catch (err) {
      showToast('Błąd: ' + err.message, 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Filter completed reservations
  const getCompletedReservations = async () => {
    try {
      return await getReservationsByDateRange(dateFrom || null, dateTo || null)
    } catch (err) {
      showToast('Błąd: ' + err.message, 'error')
      return []
    }
  }

  // Get summary by apartment
  const getSummaryByApartment = (reservations) => {
    const summary = {}
    USERS.forEach(u => {
      summary[u] = reservations.filter(r => r.user_code === u && r.status === 'active').length
    })
    return summary
  }

  // ============ ANALYSIS REPORT FUNCTIONS ============
  
  // Generate month options for select
  const generateMonthOptions = () => {
    const options = []
    const currentDate = new Date()
    // Go back 24 months and forward 12 months
    for (let i = -24; i <= 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1)
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const label = `${MONTHS_PL[date.getMonth()]} ${date.getFullYear()}`
      options.push({ value, label })
    }
    return options
  }

  // Get first and last day of month
  const getMonthRange = (monthStr) => {
    const [year, month] = monthStr.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    return { firstDay, lastDay }
  }

  // Generate months between two dates
  const getMonthsBetween = (fromMonth, toMonth) => {
    const months = []
    const [fromYear, fromM] = fromMonth.split('-').map(Number)
    const [toYear, toM] = toMonth.split('-').map(Number)
    
    let current = new Date(fromYear, fromM - 1, 1)
    const end = new Date(toYear, toM - 1, 1)
    
    while (current <= end) {
      months.push({
        value: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`,
        label: `${MONTHS_PL[current.getMonth()]} ${current.getFullYear()}`,
        shortLabel: `${MONTHS_PL[current.getMonth()].substring(0, 3)} ${current.getFullYear()}`
      })
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
    }
    return months
  }

  // Load analysis data
  const loadAnalysisData = async () => {
    if (!analysisMonthFrom || !analysisMonthTo) {
      showToast('Wybierz zakres miesięcy', 'error')
      return
    }

    // Validate range
    if (analysisMonthFrom > analysisMonthTo) {
      showToast('Data początkowa musi być przed datą końcową', 'error')
      return
    }

    try {
      setLoading(true)
      const { firstDay } = getMonthRange(analysisMonthFrom)
      const { lastDay } = getMonthRange(analysisMonthTo)
      
      const res = await getReservationsByDateRange(
        formatDate(firstDay),
        formatDate(lastDay)
      )
      
      const activeRes = res.filter(r => r.status === 'active')
      const months = getMonthsBetween(analysisMonthFrom, analysisMonthTo)
      
      // Build data structure
      const data = {
        months,
        apartments: USERS.map(apt => {
          const row = { name: apt, months: {}, total: 0 }
          months.forEach(m => {
            const { firstDay, lastDay } = getMonthRange(m.value)
            const count = activeRes.filter(r => {
              const rDate = parseDate(r.date)
              return r.user_code === apt && rDate >= firstDay && rDate <= lastDay
            }).length
            row.months[m.value] = count
            row.total += count
          })
          return row
        }),
        monthTotals: {},
        grandTotal: 0
      }
      
      // Calculate month totals
      months.forEach(m => {
        data.monthTotals[m.value] = data.apartments.reduce((sum, apt) => sum + apt.months[m.value], 0)
        data.grandTotal += data.monthTotals[m.value]
      })
      
      setAnalysisData(data)
    } catch (err) {
      showToast('Błąd ładowania danych: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Export Analysis to Excel
  const exportAnalysisToExcel = () => {
    if (!analysisData) return
    
    const headers = ['Apartament', ...analysisData.months.map(m => m.shortLabel), 'Suma wejść']
    const rows = analysisData.apartments.map(apt => [
      apt.name,
      ...analysisData.months.map(m => apt.months[m.value]),
      apt.total
    ])
    
    // Add totals row
    rows.push([
      'SUMA',
      ...analysisData.months.map(m => analysisData.monthTotals[m.value]),
      analysisData.grandTotal
    ])
    
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Analiza')
    XLSX.writeFile(wb, `analiza_${analysisMonthFrom}_${analysisMonthTo}.xlsx`)
    showToast('Raport wyeksportowany do Excel', 'success')
  }

  // Export Analysis to PDF
  const exportAnalysisToPDF = () => {
    if (!analysisData) return
    
    const doc = new jsPDF('landscape')
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('ANALIZA - Raport miesieczny', 20, 20)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Okres: ${analysisMonthFrom} - ${analysisMonthTo}`, 20, 30)
    doc.text(`Wygenerowano: ${new Date().toLocaleString('pl-PL')}`, 20, 36)
    
    // Summary
    doc.setFont('helvetica', 'bold')
    doc.text(`Laczna liczba wejsc: ${analysisData.grandTotal}`, 20, 46)
    
    let yPos = 60
    
    // Table header
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    let xPos = 20
    doc.text('Apartament', xPos, yPos)
    xPos += 35
    
    analysisData.months.forEach(m => {
      doc.text(m.shortLabel, xPos, yPos)
      xPos += 22
    })
    doc.text('Suma', xPos, yPos)
    
    yPos += 8
    doc.setFont('helvetica', 'normal')
    
    // Data rows
    analysisData.apartments.forEach(apt => {
      if (yPos > 180) {
        doc.addPage()
        yPos = 20
      }
      
      xPos = 20
      doc.text(apt.name, xPos, yPos)
      xPos += 35
      
      analysisData.months.forEach(m => {
        doc.text(String(apt.months[m.value]), xPos, yPos)
        xPos += 22
      })
      doc.text(String(apt.total), xPos, yPos)
      
      yPos += 6
    })
    
    // Totals row
    yPos += 4
    doc.setFont('helvetica', 'bold')
    xPos = 20
    doc.text('SUMA', xPos, yPos)
    xPos += 35
    
    analysisData.months.forEach(m => {
      doc.text(String(analysisData.monthTotals[m.value]), xPos, yPos)
      xPos += 22
    })
    doc.text(String(analysisData.grandTotal), xPos, yPos)
    
    doc.save(`analiza_${analysisMonthFrom}_${analysisMonthTo}.pdf`)
    showToast('Raport wyeksportowany do PDF', 'success')
  }

  // ============ OTHER EXPORT FUNCTIONS ============

  // Export to Excel
  const exportToExcel = async (reportType) => {
    try {
      let exportData
      let filename
      
      if (reportType === 'completed') {
        const res = await getCompletedReservations()
        const activeRes = res.filter(r => r.status === 'active')
        exportData = activeRes.map(r => ({
          'Data': formatDatePL(r.date),
          'Godzina': `${r.hour}:00`,
          'Użytkownik': r.user_code,
          'Status': 'Zarezerwowane'
        }))
        filename = 'raport_zrealizowane.xlsx'
      } else {
        const evt = await getEvents(dateFrom || null, dateTo || null)
        exportData = evt.map(e => ({
          'Data zdarzenia': new Date(e.created_at).toLocaleString('pl-PL'),
          'Typ': e.type === 'reservation' ? 'Rezerwacja' : 
                 e.type === 'cancellation' ? 'Odwołanie' : 
                 e.type === 'admin-cancel' ? 'Odwołanie (Admin)' :
                 e.type === 'admin-booking' ? 'Rezerwacja (Admin)' : e.type,
          'Użytkownik': e.user_code,
          'Data rezerwacji': formatDatePL(e.date),
          'Godzina': `${e.hour}:00`,
          'Admin': e.admin_user || '-'
        }))
        filename = 'raport_pelny.xlsx'
      }

      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Raport')
      XLSX.writeFile(wb, filename)
      showToast('Raport wyeksportowany do Excel', 'success')
    } catch (err) {
      showToast('Błąd eksportu: ' + err.message, 'error')
    }
  }

  // Export to PDF
  const exportToPDF = async (reportType) => {
    try {
      const doc = new jsPDF()
      
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.text(reportType === 'completed' ? 'Raport - Zrealizowane' : 'Raport - Full', 20, 20)
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Wygenerowano: ${new Date().toLocaleString('pl-PL')}`, 20, 30)
      
      if (dateFrom || dateTo) {
        doc.text(`Okres: ${dateFrom || 'poczatek'} - ${dateTo || 'koniec'}`, 20, 38)
      }
      
      let yPos = 50
      
      if (reportType === 'completed') {
        const res = await getCompletedReservations()
        const activeRes = res.filter(r => r.status === 'active')
        const summary = getSummaryByApartment(res)
        
        doc.setFont('helvetica', 'bold')
        doc.text(`Lacznie wejsc: ${activeRes.length}`, 20, yPos)
        yPos += 15
        
        doc.setFontSize(12)
        doc.text('Podsumowanie wg apartamentow:', 20, yPos)
        yPos += 10
        
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        Object.entries(summary).forEach(([apt, count]) => {
          if (count > 0) {
            doc.text(`${apt}: ${count} wejsc`, 25, yPos)
            yPos += 6
            if (yPos > 270) {
              doc.addPage()
              yPos = 20
            }
          }
        })
      } else {
        const evt = await getEvents(dateFrom || null, dateTo || null)
        evt.forEach(e => {
          const typeText = e.type === 'reservation' ? 'Rezerwacja' : 
                          e.type === 'cancellation' ? 'Odwolanie' : 
                          e.type === 'admin-cancel' ? 'Odwolanie (Admin)' :
                          e.type === 'admin-booking' ? 'Rezerwacja (Admin)' : e.type
          const text = `${new Date(e.created_at).toLocaleString('pl-PL')} - ${typeText} - ${e.user_code} - ${e.hour}:00`
          doc.text(text, 20, yPos)
          yPos += 8
          if (yPos > 270) {
            doc.addPage()
            yPos = 20
          }
        })
      }
      
      doc.save(reportType === 'completed' ? 'raport_zrealizowane.pdf' : 'raport_pelny.pdf')
      showToast('Raport wyeksportowany do PDF', 'success')
    } catch (err) {
      showToast('Błąd eksportu: ' + err.message, 'error')
    }
  }

  // Get active reservations for reports
  const [reportReservations, setReportReservations] = useState([])
  
  useEffect(() => {
    if (activeTab === 'completed') {
      getCompletedReservations().then(res => {
        setReportReservations(res.filter(r => r.status === 'active'))
      })
    }
  }, [activeTab, dateFrom, dateTo])

  const monthOptions = generateMonthOptions()

  if (loading && activeTab !== 'analysis') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="loader"></div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
      {/* Tabs */}
      <div className="flex flex-wrap gap-3 mb-8">
        {[
          { id: 'calendar', label: '📅 Kalendarz' },
          { id: 'completed', label: '✅ Zrealizowane' },
          { id: 'analysis', label: '📈 Analiza' },
          { id: 'full', label: '📊 Full Raport' },
          { id: 'audit', label: '🔍 Audit Log' }
        ].map(tab => (
          <button
            key={tab.id}
            className={`px-6 py-3 rounded-full font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-green-500 to-green-700 text-white'
                : 'bg-white border-2 border-green-200 text-green-800 hover:border-green-400'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Calendar Tab - Updated with unlimited date navigation */}
      {activeTab === 'calendar' && (
        <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-green-200">
          <h2 className="font-display text-2xl text-green-800 mb-6">📅 Podgląd rezerwacji</h2>
          
          {/* Date Navigation */}
          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-green-50 rounded-xl">
            <button
              className="px-4 py-2 bg-white border-2 border-green-400 rounded-lg font-semibold text-green-800 hover:bg-green-400 hover:text-white transition-all"
              onClick={() => setAdminCalendarDate(addDays(adminCalendarDate, -7))}
            >
              ← Poprzedni tydzień
            </button>
            <button
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all"
              onClick={() => setAdminCalendarDate(today)}
            >
              Dziś
            </button>
            <button
              className="px-4 py-2 bg-white border-2 border-green-400 rounded-lg font-semibold text-green-800 hover:bg-green-400 hover:text-white transition-all"
              onClick={() => setAdminCalendarDate(addDays(adminCalendarDate, 7))}
            >
              Następny tydzień →
            </button>
            <input
              type="date"
              className="px-4 py-2 border-2 border-green-200 rounded-lg focus:outline-none focus:border-green-400"
              value={formatDate(adminCalendarDate)}
              onChange={(e) => setAdminCalendarDate(parseDate(e.target.value))}
            />
          </div>
          
          <div className="space-y-6">
            {getAdminDisplayDates().map(date => {
              const dayReservations = getReservationsForDate(date)
              const isPast = date < today
              return (
                <div 
                  key={formatDate(date)} 
                  className={`rounded-2xl p-6 border-2 ${isPast ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200'}`}
                >
                  <h3 className={`font-display text-xl mb-4 ${isPast ? 'text-gray-600' : 'text-green-800'}`}>
                    {formatDatePL(date)} {isSameDay(date, today) && '(dziś)'}
                    {isPast && ' - miniony'}
                  </h3>
                  
                  {TIME_SLOTS.filter(s => s.bookable).map(slot => {
                    const reservation = dayReservations.find(r => r.hour === slot.hour)
                    const canBook = !isPast && !reservation
                    return (
                      <div 
                        key={slot.hour} 
                        className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white rounded-xl mb-3 gap-3"
                      >
                        <div className="flex gap-6 items-center">
                          <span className="font-bold text-green-800 w-20">{slot.hour}:00</span>
                          <span className={reservation ? 'text-green-700 font-semibold' : 'text-gray-400'}>
                            {reservation ? reservation.user_code : 'Wolne'}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {canBook && (
                            <button
                              className="px-4 py-2 bg-green-50 text-green-700 rounded-lg font-semibold hover:bg-green-600 hover:text-white transition-all text-sm"
                              onClick={() => handleAdminBooking(date, slot.hour)}
                            >
                              + Rezerwuj
                            </button>
                          )}
                          {reservation && !isPast && (
                            <button
                              className="px-4 py-2 bg-red-50 text-red-700 rounded-lg font-semibold hover:bg-red-600 hover:text-white transition-all text-sm"
                              onClick={() => handleAdminCancel(reservation)}
                            >
                              Odwołaj
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  
                  <div className="p-4 bg-green-100 rounded-xl italic text-green-700">
                    <span className="font-bold">20:00 - 21:00</span> — OTWARTE DLA POZOSTAŁYCH
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Completed Tab */}
      {activeTab === 'completed' && (
        <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-green-200">
          <h2 className="font-display text-2xl text-green-800 mb-6">✅ Raport - Zrealizowane</h2>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-8 items-end">
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-green-800 text-sm">Od daty</label>
              <input
                type="date"
                className="px-4 py-3 border-2 border-green-200 rounded-xl focus:outline-none focus:border-green-400"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-green-800 text-sm">Do daty</label>
              <input
                type="date"
                className="px-4 py-3 border-2 border-green-200 rounded-xl focus:outline-none focus:border-green-400"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <button 
              className="px-6 py-3 bg-white border-2 border-green-400 rounded-xl font-semibold text-green-800 hover:bg-green-400 hover:text-white transition-all"
              onClick={() => exportToExcel('completed')}
            >
              📥 Export Excel
            </button>
            <button 
              className="px-6 py-3 bg-white border-2 border-green-400 rounded-xl font-semibold text-green-800 hover:bg-green-400 hover:text-white transition-all"
              onClick={() => exportToPDF('completed')}
            >
              📄 Export PDF
            </button>
          </div>

          {/* Summary */}
          <div className="bg-green-100 rounded-2xl p-6 mb-8 border-2 border-green-200">
            <h3 className="font-display text-xl text-green-800 mb-4">Podsumowanie</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="bg-white p-4 rounded-xl text-center">
                <div className="text-3xl font-bold text-green-800">{reportReservations.length}</div>
                <div className="text-sm text-green-600 mt-1">Łącznie wejść</div>
              </div>
              {Object.entries(getSummaryByApartment(reportReservations))
                .filter(([_, count]) => count > 0)
                .map(([apt, count]) => (
                  <div key={apt} className="bg-white p-4 rounded-xl text-center">
                    <div className="text-2xl font-bold text-green-800">{count}</div>
                    <div className="text-xs text-green-600 mt-1">{apt}</div>
                  </div>
                ))
              }
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-green-100">
                  <th className="p-4 text-left font-bold text-green-800 uppercase text-sm">Data</th>
                  <th className="p-4 text-left font-bold text-green-800 uppercase text-sm">Godzina</th>
                  <th className="p-4 text-left font-bold text-green-800 uppercase text-sm">Użytkownik</th>
                </tr>
              </thead>
              <tbody>
                {reportReservations.map(r => (
                  <tr key={r.id} className="border-b-2 border-green-100 hover:bg-green-50">
                    <td className="p-4">{formatDatePL(r.date)}</td>
                    <td className="p-4">{r.hour}:00</td>
                    <td className="p-4">{r.user_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analysis Tab - NEW */}
      {activeTab === 'analysis' && (
        <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-green-200">
          <h2 className="font-display text-2xl text-green-800 mb-6">📈 Analiza - Raport miesięczny</h2>
          
          {/* Month Filters */}
          <div className="flex flex-wrap gap-4 mb-8 items-end">
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-green-800 text-sm">Od miesiąca</label>
              <select
                className="px-4 py-3 border-2 border-green-200 rounded-xl focus:outline-none focus:border-green-400 bg-white min-w-[200px]"
                value={analysisMonthFrom}
                onChange={(e) => setAnalysisMonthFrom(e.target.value)}
              >
                <option value="">Wybierz miesiąc</option>
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-green-800 text-sm">Do miesiąca</label>
              <select
                className="px-4 py-3 border-2 border-green-200 rounded-xl focus:outline-none focus:border-green-400 bg-white min-w-[200px]"
                value={analysisMonthTo}
                onChange={(e) => setAnalysisMonthTo(e.target.value)}
              >
                <option value="">Wybierz miesiąc</option>
                {monthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <button 
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
              onClick={loadAnalysisData}
            >
              🔍 Generuj raport
            </button>
            {analysisData && (
              <>
                <button 
                  className="px-6 py-3 bg-white border-2 border-green-400 rounded-xl font-semibold text-green-800 hover:bg-green-400 hover:text-white transition-all"
                  onClick={exportAnalysisToExcel}
                >
                  📥 Export Excel
                </button>
                <button 
                  className="px-6 py-3 bg-white border-2 border-green-400 rounded-xl font-semibold text-green-800 hover:bg-green-400 hover:text-white transition-all"
                  onClick={exportAnalysisToPDF}
                >
                  📄 Export PDF
                </button>
              </>
            )}
          </div>

          {loading && (
            <div className="flex justify-center py-12">
              <div className="loader"></div>
            </div>
          )}

          {analysisData && !loading && (
            <>
              {/* Summary */}
              <div className="bg-green-100 rounded-2xl p-6 mb-8 border-2 border-green-200">
                <h3 className="font-display text-xl text-green-800 mb-4">Podsumowanie okresu</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-xl text-center">
                    <div className="text-4xl font-bold text-green-800">{analysisData.grandTotal}</div>
                    <div className="text-sm text-green-600 mt-2">Łączna liczba wejść</div>
                  </div>
                  <div className="bg-white p-6 rounded-xl text-center">
                    <div className="text-4xl font-bold text-green-800">{analysisData.months.length}</div>
                    <div className="text-sm text-green-600 mt-2">Liczba miesięcy</div>
                  </div>
                  <div className="bg-white p-6 rounded-xl text-center">
                    <div className="text-4xl font-bold text-green-800">
                      {analysisData.months.length > 0 
                        ? (analysisData.grandTotal / analysisData.months.length).toFixed(1) 
                        : 0}
                    </div>
                    <div className="text-sm text-green-600 mt-2">Średnia wejść/miesiąc</div>
                  </div>
                  <div className="bg-white p-6 rounded-xl text-center">
                    <div className="text-4xl font-bold text-green-800">
                      {USERS.length > 0 
                        ? (analysisData.grandTotal / USERS.length).toFixed(1) 
                        : 0}
                    </div>
                    <div className="text-sm text-green-600 mt-2">Średnia wejść/apartament</div>
                  </div>
                </div>
              </div>

              {/* Analysis Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-green-600 text-white">
                      <th className="p-4 text-left font-bold uppercase text-sm border border-green-700 sticky left-0 bg-green-600 z-10">
                        Apartament
                      </th>
                      {analysisData.months.map(m => (
                        <th key={m.value} className="p-4 text-center font-bold uppercase text-sm border border-green-700 min-w-[100px]">
                          {m.shortLabel}
                        </th>
                      ))}
                      <th className="p-4 text-center font-bold uppercase text-sm border border-green-700 bg-green-700 min-w-[100px]">
                        Suma wejść
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisData.apartments.map((apt, idx) => (
                      <tr key={apt.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-green-50'}>
                        <td className={`p-4 font-semibold text-green-800 border border-green-200 sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-white' : 'bg-green-50'}`}>
                          {apt.name}
                        </td>
                        {analysisData.months.map(m => (
                          <td key={m.value} className={`p-4 text-center border border-green-200 ${apt.months[m.value] > 0 ? 'font-semibold text-green-800' : 'text-gray-400'}`}>
                            {apt.months[m.value]}
                          </td>
                        ))}
                        <td className="p-4 text-center font-bold text-green-800 border border-green-200 bg-green-100">
                          {apt.total}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-green-600 text-white font-bold">
                      <td className="p-4 border border-green-700 sticky left-0 bg-green-600 z-10">
                        SUMA
                      </td>
                      {analysisData.months.map(m => (
                        <td key={m.value} className="p-4 text-center border border-green-700">
                          {analysisData.monthTotals[m.value]}
                        </td>
                      ))}
                      <td className="p-4 text-center border border-green-700 bg-green-700 text-xl">
                        {analysisData.grandTotal}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!analysisData && !loading && (
            <div className="text-center py-12 text-green-600">
              <p className="text-lg">Wybierz zakres miesięcy i kliknij "Generuj raport"</p>
            </div>
          )}
        </div>
      )}

      {/* Full Report Tab */}
      {activeTab === 'full' && (
        <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-green-200">
          <h2 className="font-display text-2xl text-green-800 mb-6">📊 Full Raport - Wszystkie zdarzenia</h2>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-8 items-end">
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-green-800 text-sm">Od daty</label>
              <input
                type="date"
                className="px-4 py-3 border-2 border-green-200 rounded-xl focus:outline-none focus:border-green-400"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-semibold text-green-800 text-sm">Do daty</label>
              <input
                type="date"
                className="px-4 py-3 border-2 border-green-200 rounded-xl focus:outline-none focus:border-green-400"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <button 
              className="px-6 py-3 bg-white border-2 border-green-400 rounded-xl font-semibold text-green-800 hover:bg-green-400 hover:text-white transition-all"
              onClick={() => exportToExcel('full')}
            >
              📥 Export Excel
            </button>
            <button 
              className="px-6 py-3 bg-white border-2 border-green-400 rounded-xl font-semibold text-green-800 hover:bg-green-400 hover:text-white transition-all"
              onClick={() => exportToPDF('full')}
            >
              📄 Export PDF
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-green-100">
                  <th className="p-4 text-left font-bold text-green-800 uppercase text-sm">Data zdarzenia</th>
                  <th className="p-4 text-left font-bold text-green-800 uppercase text-sm">Typ</th>
                  <th className="p-4 text-left font-bold text-green-800 uppercase text-sm">Użytkownik</th>
                  <th className="p-4 text-left font-bold text-green-800 uppercase text-sm">Data rezerwacji</th>
                  <th className="p-4 text-left font-bold text-green-800 uppercase text-sm">Godzina</th>
                </tr>
              </thead>
              <tbody>
                {events.map(e => (
                  <tr key={e.id} className="border-b-2 border-green-100 hover:bg-green-50">
                    <td className="p-4">{new Date(e.created_at).toLocaleString('pl-PL')}</td>
                    <td className="p-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                        e.type === 'reservation' ? 'bg-green-100 text-green-800' :
                        e.type === 'admin-booking' ? 'bg-blue-100 text-blue-800' :
                        e.type === 'cancellation' ? 'bg-red-100 text-red-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {e.type === 'reservation' ? 'Rezerwacja' : 
                         e.type === 'admin-booking' ? 'Rezerwacja (Admin)' :
                         e.type === 'cancellation' ? 'Odwołanie' : 'Odwołanie (Admin)'}
                      </span>
                    </td>
                    <td className="p-4">{e.user_code}</td>
                    <td className="p-4">{formatDatePL(e.date)}</td>
                    <td className="p-4">{e.hour}:00</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          {/* Audit Log Section */}
          <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-green-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-display text-2xl text-green-800">🔍 Audit Log - Historia zmian</h2>
              <button 
                className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all"
                onClick={async () => {
                  try {
                    const data = await getAuditLog(100)
                    setAuditLog(data)
                    showToast('Audit log odświeżony', 'success')
                  } catch (err) {
                    showToast('Błąd: ' + err.message, 'error')
                  }
                }}
              >
                🔄 Odśwież
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-green-100">
                    <th className="p-3 text-left font-bold text-green-800 text-sm">Data</th>
                    <th className="p-3 text-left font-bold text-green-800 text-sm">Akcja</th>
                    <th className="p-3 text-left font-bold text-green-800 text-sm">Tabela</th>
                    <th className="p-3 text-left font-bold text-green-800 text-sm">Użytkownik</th>
                    <th className="p-3 text-left font-bold text-green-800 text-sm">Szczegóły</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-green-600">
                        Kliknij "Odśwież" aby załadować audit log
                      </td>
                    </tr>
                  ) : (
                    auditLog.map(log => (
                      <tr key={log.id} className="border-b border-green-100 hover:bg-green-50">
                        <td className="p-3 text-sm">{new Date(log.created_at).toLocaleString('pl-PL')}</td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                            log.action === 'INSERT' ? 'bg-green-100 text-green-800' :
                            log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                            log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-sm">{log.table_name}</td>
                        <td className="p-3 text-sm font-medium">{log.user_code || '-'}</td>
                        <td className="p-3 text-sm">
                          {log.new_data && (
                            <span className="text-gray-600">
                              {log.new_data.date && `${log.new_data.date} ${log.new_data.hour}:00`}
                              {log.new_data.status && ` (${log.new_data.status})`}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* App Errors Section */}
          <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-red-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-display text-2xl text-red-800">⚠️ Błędy aplikacji</h2>
              <button 
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all"
                onClick={async () => {
                  try {
                    const data = await getAppErrors(50)
                    setAppErrors(data)
                    showToast('Błędy odświeżone', 'success')
                  } catch (err) {
                    showToast('Błąd: ' + err.message, 'error')
                  }
                }}
              >
                🔄 Odśwież
              </button>
            </div>
            
            {appErrors.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Kliknij "Odśwież" aby załadować błędy lub brak zarejestrowanych błędów 🎉
              </div>
            ) : (
              <div className="space-y-4">
                {appErrors.map(err => (
                  <div key={err.id} className="bg-red-50 rounded-xl p-4 border border-red-200">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-red-800">{err.error_type}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(err.created_at).toLocaleString('pl-PL')}
                      </span>
                    </div>
                    <p className="text-red-700 mb-2">{err.error_message}</p>
                    {err.user_code && (
                      <p className="text-sm text-gray-600">Użytkownik: {err.user_code}</p>
                    )}
                    {err.page_url && (
                      <p className="text-sm text-gray-500 truncate">URL: {err.page_url}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {modal && <Modal {...modal} loading={actionLoading} />}

      {/* Admin Booking Modal */}
      {bookingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-10 max-w-md w-full shadow-2xl animate-fade-in">
            <h3 className="font-display text-2xl text-green-800 mb-4">
              Rezerwacja dla użytkownika
            </h3>
            <p className="text-green-600 mb-6">
              Termin: <strong>{formatDateTime(bookingModal.date, bookingModal.hour)}</strong>
            </p>
            
            <div className="mb-6">
              <label className="block font-semibold text-green-800 mb-2">
                Wybierz apartament
              </label>
              <select
                className="w-full px-4 py-3 border-2 border-green-200 rounded-xl focus:outline-none focus:border-green-400 bg-white"
                value={selectedUserForBooking}
                onChange={(e) => setSelectedUserForBooking(e.target.value)}
              >
                <option value="">-- Wybierz --</option>
                {USERS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            
            <div className="flex gap-4 justify-center">
              <button
                className="px-8 py-3 rounded-xl font-semibold border-2 border-green-200 text-green-800 hover:bg-green-50 transition-all"
                onClick={() => {
                  setBookingModal(null)
                  setSelectedUserForBooking('')
                }}
                disabled={actionLoading}
              >
                Anuluj
              </button>
              <button
                className="px-8 py-3 rounded-xl font-semibold bg-gradient-to-r from-green-500 to-green-700 text-white hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center gap-2"
                onClick={confirmAdminBooking}
                disabled={actionLoading || !selectedUserForBooking}
              >
                {actionLoading && <div className="loader w-4 h-4 border-2"></div>}
                Rezerwuj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
