import { useState, useEffect, useCallback } from 'react'
import Modal from './Modal'
import { TIME_SLOTS, USERS } from '../lib/supabase'
import { 
  getReservations, 
  getReservationsByDateRange,
  cancelReservation,
  getEvents,
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

  const today = getStartOfDay(new Date())
  const displayDates = [today, addDays(today, 1), addDays(today, 2)]

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
                 e.type === 'cancellation' ? 'Odwołanie' : 'Odwołanie (Admin)',
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
                          e.type === 'cancellation' ? 'Odwolanie' : 'Odwolanie (Admin)'
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

  if (loading) {
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
          { id: 'full', label: '📊 Full Raport' }
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

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-green-200">
          <h2 className="font-display text-2xl text-green-800 mb-6">📅 Podgląd rezerwacji</h2>
          
          <div className="space-y-6">
            {displayDates.map(date => {
              const dayReservations = getReservationsForDate(date)
              return (
                <div key={formatDate(date)} className="bg-green-50 rounded-2xl p-6 border-2 border-green-200">
                  <h3 className="font-display text-xl text-green-800 mb-4">
                    {formatDatePL(date)} {isSameDay(date, today) && '(dziś)'}
                  </h3>
                  
                  {TIME_SLOTS.filter(s => s.bookable).map(slot => {
                    const reservation = dayReservations.find(r => r.hour === slot.hour)
                    return (
                      <div 
                        key={slot.hour} 
                        className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white rounded-xl mb-3 gap-3"
                      >
                        <div className="flex gap-6 items-center">
                          <span className="font-bold text-green-800 w-20">{slot.hour}:00</span>
                          <span className="text-green-600">
                            {reservation ? reservation.user_code : 'Wolne'}
                          </span>
                        </div>
                        {reservation && (
                          <button
                            className="px-4 py-2 bg-red-50 text-red-700 rounded-lg font-semibold hover:bg-red-600 hover:text-white transition-all text-sm"
                            onClick={() => handleAdminCancel(reservation)}
                          >
                            Odwołaj
                          </button>
                        )}
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
                        e.type === 'cancellation' ? 'bg-red-100 text-red-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {e.type === 'reservation' ? 'Rezerwacja' : 
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

      {modal && <Modal {...modal} loading={actionLoading} />}
    </div>
  )
}
